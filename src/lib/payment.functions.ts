/**
 * 예약금·잔금 결제 상태 (사장님이 직접 확인하는 방식) + 달력 일정 보관.
 *
 * 금액을 자동으로 바꾸지 않습니다. 사장님이 확인한 값만 저장합니다.
 * 예약금(deposit_paid)은 기존 입금 확인 기능이 계산하고,
 * 여기서는 잔금·진행 상태·메모·확인 담당자·달력 보관만 다룹니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const PAYMENT_STATUSES = [
  "unpaid",
  "pending",
  "deposit_paid",
  "partial",
  "completed",
  "refunded",
  "canceled",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** 화면에서 사장님이 고를 수 있는 상태 (미결제·결제대기·일부결제는 표시하지 않습니다) */
export const PAYMENT_STATUS_CHOICES = [
  "deposit_paid",
  "completed",
  "refunded",
  "canceled",
] as const satisfies readonly PaymentStatus[];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "미결제",
  pending: "결제대기",
  deposit_paid: "예약금 완료",
  partial: "일부결제",
  completed: "결제완료",
  refunded: "환불",
  canceled: "결제취소",
};

/** 화면에서 쓰는 배지 색 (한 가지 배지만 씁니다) */
export const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  unpaid: "bg-[#F3F4F6] text-[#6B7280]",
  pending: "bg-[#FDF6E3] text-[#8A6D1B]",
  deposit_paid: "bg-[#EAF2FC] text-[#1D4ED8]",
  partial: "bg-[#E8F1FF] text-[#3578C8]",
  completed: "bg-[#E4F4EC] text-[#2F7A5E]",
  refunded: "bg-[#FEECEC] text-[#B91C1C]",
  canceled: "bg-[#FEECEC] text-[#B91C1C]",
};

/** 예전에 저장된 값(balance_paid 등)도 새 목록으로 읽어 줍니다 */
export function normalizePaymentStatus(v: string | null | undefined): PaymentStatus {
  const s = (v ?? "").trim();
  if (s === "balance_paid") return "partial";
  return (PAYMENT_STATUSES as readonly string[]).includes(s) ? (s as PaymentStatus) : "unpaid";
}

/** 실제 확인된 금액으로 계산한 결제 상태 (사장님이 고른 값과 비교용) */
export function paymentStatusFromAmounts(
  total: number,
  depositPaid: number,
  balancePaid: number,
): PaymentStatus {
  const paid = Math.max(0, depositPaid) + Math.max(0, balancePaid);
  if (paid <= 0) return "unpaid";
  if (total > 0 && paid >= total) return "completed";
  if (balancePaid > 0) return "partial";
  return "deposit_paid";
}

/** 사장님이 확인한 결제 상태를 저장합니다 */
export const setPaymentState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        estimateId: z.string().min(1).max(80),
        status: z.enum(PAYMENT_STATUSES),
        /** 확인한 잔금 (원) */
        balancePaid: z.number().int().min(0).max(1_000_000_000).optional(),
        note: z.string().max(300).optional(),
        method: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: boolean; error?: string; balancePaid?: number; confirmedAt?: string }> => {
      const { data: terms, error: findErr } = await context.supabase
        .from("estimate_terms")
        .select("id, total, deposit_paid, balance_paid")
        .eq("user_id", context.userId)
        .eq("estimate_id", data.estimateId)
        .order("sheet_version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (findErr || !terms) {
        return { ok: false, error: "이 견적서를 찾지 못했습니다. 먼저 견적서를 발송해 주세요." };
      }

      const row = terms as {
        id: string;
        total: number | null;
        deposit_paid: number | null;
        balance_paid: number | null;
      };
      const now = new Date().toISOString();
      const balance = data.balancePaid;
      const total = Number(row.total ?? 0);
      const deposit = Number(row.deposit_paid ?? 0);
      const nextBalance = typeof balance === "number" ? balance : Number(row.balance_paid ?? 0);

      // 실제 금액과 맞지 않는 「결제완료」는 저장하지 않습니다.
      if (data.status === "completed" && total > 0 && deposit + nextBalance < total) {
        return {
          ok: false,
          error: `확인된 금액(${(deposit + nextBalance).toLocaleString("ko-KR")}원)이 총액(${total.toLocaleString("ko-KR")}원)보다 적어 결제완료로 저장할 수 없습니다.`,
        };
      }

      const patch: Record<string, unknown> = {
        payment_status: data.status,
        payment_note: data.note?.trim() ? data.note.trim() : null,
        payment_confirmed_by: context.userId,
        payment_confirmed_at: now,
        paid_at: data.status === "completed" ? now : null,
        calendar_archived: data.status === "completed",
        calendar_archived_at: data.status === "completed" ? now : null,
        calendar_archived_by: data.status === "completed" ? context.userId : null,
        calendar_selected: false,
      };
      if (typeof data.method === "string") {
        patch["payment_method"] = data.method.trim() ? data.method.trim() : null;
      }
      if (typeof balance === "number") {
        patch["balance_paid"] = balance;
        patch["balance_paid_at"] = balance > 0 ? now : null;
      }

      const { error } = await context.supabase
        .from("estimate_terms")
        .update(patch as never)
        .eq("id", row.id);
      if (error) {
        console.error("[setPaymentState]", error.message);
        return { ok: false, error: "결제 상태를 저장하지 못했습니다." };
      }

      // 예약이 취소·환불되면 전날 안내 문자도 보내지 않습니다.
      // 다시 진행 상태로 돌아오면 확정된 예약에 한해 다시 예약합니다.
      try {
        if (data.status === "canceled" || data.status === "refunded") {
          const { cancelMoveReminders } = await import("./reminder.server");
          await cancelMoveReminders(data.estimateId, context.userId, "예약이 취소되었습니다.");
        } else {
          const { syncMoveReminder } = await import("./reminder.server");
          await syncMoveReminder(row.id);
        }
      } catch (e) {
        console.error(
          "[setPaymentState] 안내 문자 예약 변경 실패",
          e instanceof Error ? e.message : e,
        );
      }
      return { ok: true, balancePaid: balance, confirmedAt: now };
    },
  );

/** 달력에서 「정리 대상」으로 체크/해제합니다 (데이터는 지우지 않습니다) */
export const setCalendarSelected = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ termsId: z.string().uuid(), selected: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await context.supabase
      .from("estimate_terms")
      .update({ calendar_selected: data.selected } as never)
      .eq("id", data.termsId)
      .eq("user_id", context.userId);
    if (error) {
      console.error("[setCalendarSelected]", error.message);
      return { ok: false, error: "체크 상태를 저장하지 못했습니다." };
    }
    return { ok: true };
  });

/**
 * 결제완료이고 사장님이 체크한 일정만 달력에서 「완료 보관함」으로 옮깁니다.
 * 데이터는 그대로 남고, 달력에서만 보이지 않습니다.
 */
export const archiveCalendarSelected = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ termsIds: z.array(z.string().uuid()).min(1).max(200) }).parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: boolean; archived: number; skipped: string[]; error?: string }> => {
      const { data: rows, error } = await context.supabase
        .from("estimate_terms")
        .select("id, customer_name, payment_status, calendar_selected")
        .eq("user_id", context.userId)
        .in("id", data.termsIds);
      if (error) {
        console.error("[archiveCalendarSelected]", error.message);
        return { ok: false, archived: 0, skipped: [], error: "일정을 불러오지 못했습니다." };
      }

      const list = (rows ?? []) as {
        id: string;
        customer_name: string | null;
        payment_status: string | null;
        calendar_selected: boolean | null;
      }[];
      const ok: string[] = [];
      const skipped: string[] = [];
      for (const r of list) {
        if (normalizePaymentStatus(r.payment_status) === "completed" && r.calendar_selected) {
          ok.push(r.id);
        } else {
          skipped.push(r.customer_name || "이름 없음");
        }
      }
      if (ok.length === 0) {
        return {
          ok: false,
          archived: 0,
          skipped,
          error: "결제완료이며 체크한 일정만 보관할 수 있습니다.",
        };
      }

      const now = new Date().toISOString();
      const { error: upErr } = await context.supabase
        .from("estimate_terms")
        .update({
          calendar_archived: true,
          calendar_archived_at: now,
          calendar_archived_by: context.userId,
        } as never)
        .in("id", ok)
        .eq("user_id", context.userId);
      if (upErr) {
        console.error("[archiveCalendarSelected] update", upErr.message);
        return { ok: false, archived: 0, skipped, error: "보관 처리에 실패했습니다." };
      }
      return { ok: true, archived: ok.length, skipped };
    },
  );

export interface ArchivedContractRow {
  termsId: string;
  estimateId: string;
  customerName: string;
  moveDate: string;
  total: number;
  depositPaid: number;
  balancePaid: number;
  paymentStatus: PaymentStatus;
  sizeTab: string;
  archivedAt: string | null;
  accessToken: string;
}

/** 완료 보관함 목록 (본인 업체 기록만) */
export const listArchivedContracts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ArchivedContractRow[]> => {
    const { data, error } = await context.supabase
      .from("estimate_terms")
      .select(
        "id, estimate_id, customer_name, move_date, total, deposit_paid, balance_paid, payment_status, calendar_archived_at, paid_at, access_token, sheet_snapshot",
      )
      .eq("user_id", context.userId)
      .eq("payment_status", "completed")
      .is("deleted_at", null)
      .order("paid_at", { ascending: false })
      .limit(300);
    if (error) {
      console.error("[listArchivedContracts]", error.message);
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).map((r) => {
      let sizeTab = "";
      try {
        const snap = r["sheet_snapshot"] ? JSON.parse(String(r["sheet_snapshot"])) : null;
        const d = (snap?.draft ?? {}) as Record<string, unknown>;
        if (typeof d["sizeTab"] === "string") sizeTab = d["sizeTab"];
      } catch {
        /* 스냅샷을 읽지 못하면 평수는 비워 둡니다 */
      }
      return {
        termsId: String(r["id"]),
        estimateId: String(r["estimate_id"] ?? ""),
        customerName: String(r["customer_name"] ?? ""),
        moveDate: String(r["move_date"] ?? ""),
        total: Number(r["total"] ?? 0),
        depositPaid: Number(r["deposit_paid"] ?? 0),
        balancePaid: Number(r["balance_paid"] ?? 0),
        paymentStatus: normalizePaymentStatus(r["payment_status"] as string | null),
        sizeTab,
        archivedAt: (r["calendar_archived_at"] as string | null) ?? null,
        accessToken: String(r["access_token"] ?? ""),
      };
    });
  });
