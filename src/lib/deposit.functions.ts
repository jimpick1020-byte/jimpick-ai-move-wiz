/**
 * 예약금 입금 확인.
 *
 *  - registerDeposit : 은행 입금알림 문자를 붙여넣으면 입금자·금액을 읽어 기록합니다.
 *                      이름 일치 여부와 무관하게 「확인 대기」로 남깁니다.
 *  - confirmDeposit  : 사장님이 직접 확인한 입금을 반영합니다.
 *  - rejectDeposit   : 우리 고객 입금이 아닌 것으로 처리합니다.
 *  - listDeposits    : 입금 기록을 읽습니다.
 *
 * 입금 확인은 해당 기록의 확인 상태·시각·담당자만 저장합니다. 문자와 견적 금액은 변경하지 않습니다.
 */
import { calcDeposit } from "@/lib/deposit-rule";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { parseDepositSms, isSameName, normalizeName } from "./deposit-parse";
import { receiptPaymentKind } from "./payment-review";

export interface DepositRow {
  id: string;
  estimateId: string;
  sheetNo: string | null;
  depositorName: string;
  customerName: string;
  amount: number;
  depositedAt: string | null;
  status: "confirmed" | "pending_review" | "rejected";
  nameMatched: boolean;
  source: string;
  paymentKind?: string;
  rawText: string | null;
  notifiedAt: string | null;
  notifyError: string | null;
  createdAt: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
}

interface RowDb {
  id: string;
  estimate_id: string;
  sheet_no: string | null;
  depositor_name: string | null;
  customer_name: string | null;
  amount: number | null;
  deposited_at: string | null;
  status: string | null;
  name_matched: boolean | null;
  source: string | null;
  payment_kind?: string | null;
  raw_text: string | null;
  notified_at: string | null;
  notify_error: string | null;
  created_at: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
}

function toRow(d: RowDb): DepositRow {
  const s = String(d.status ?? "pending_review");
  return {
    id: d.id,
    estimateId: d.estimate_id,
    sheetNo: d.sheet_no,
    depositorName: String(d.depositor_name ?? ""),
    customerName: String(d.customer_name ?? ""),
    amount: Number(d.amount ?? 0),
    depositedAt: d.deposited_at,
    status: (s === "confirmed" || s === "rejected" ? s : "pending_review") as DepositRow["status"],
    nameMatched: d.name_matched === true,
    source: String(d.source ?? "sms_paste"),
    paymentKind: d.payment_kind ?? "deposit",
    rawText: d.raw_text,
    notifiedAt: d.notified_at,
    notifyError: d.notify_error,
    createdAt: d.created_at,
    confirmedAt: d.confirmed_at,
    confirmedBy: d.confirmed_by,
  };
}

const SELECT =
  "id,estimate_id,sheet_no,depositor_name,customer_name,amount,deposited_at,status,name_matched,source,raw_text,notified_at,notify_error,created_at,payment_kind,confirmed_at,confirmed_by";

/**
 * 확인된 입금만 더해서 견적서의 「받은 예약금」을 다시 계산합니다.
 * 확인 대기·거절된 입금은 절대 금액에 넣지 않습니다.
 */


async function recalcAndSave(
  context: { supabase: any; userId: string },
  estimateId: string,
): Promise<number> {
  const { data } = await context.supabase
    .from("deposit_records")
    .select("amount")
    .eq("user_id", context.userId)
    .eq("estimate_id", estimateId)
    .eq("payment_kind", "deposit")
    .eq("status", "confirmed");
  const paid = (data ?? []).reduce(
    (s: number, r: { amount: number | null }) => s + (Number(r.amount) || 0),
    0,
  );
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    deposit_paid: paid,
    deposit_paid_at: paid > 0 ? now : null,
  };
  // 예약금이 확인되면 결제 상태도 「예약금 완료」로 올려 줍니다.
  // 이미 결제완료·환불·취소 등으로 저장된 상태는 건드리지 않습니다.
  if (paid > 0) {
    const { data: cur } = await context.supabase
      .from("estimate_terms")
      .select("payment_status")
      .eq("user_id", context.userId)
      .eq("estimate_id", estimateId)
      .order("sheet_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const s = String((cur as { payment_status?: string } | null)?.payment_status ?? "unpaid");
    if (s === "unpaid" || s === "pending" || s === "awaiting_confirm") {
      patch["payment_status"] = "deposit_paid";
      patch["payment_confirmed_by"] = context.userId;
      patch["payment_confirmed_at"] = now;
    }
  }
  await context.supabase
    .from("estimate_terms")
    .update(patch)
    .eq("user_id", context.userId)
    .eq("estimate_id", estimateId);
  if (paid > 0) {
    const { data: latest } = await context.supabase
      .from("estimate_terms")
      .select("id")
      .eq("user_id", context.userId)
      .eq("estimate_id", estimateId)
      .order("sheet_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.id) {
      try {
        const { syncMoveReminder } = await import("./reminder.server");
        await syncMoveReminder(String(latest.id));
      } catch (error) {
        console.error("[recalcAndSave] 전날 안내 예약 실패", error instanceof Error ? error.message : error);
      }
    }
  }
  return paid;
}

/**
 * 고객용 — 고객이 견적서에서 「입금했습니다」를 누른 기록을 남깁니다.
 *
 * 이 기록만으로 금액이 반영되지는 않습니다. 사장님이 통장을 보고
 * 「확인하기 → 입금 확인 완료」를 눌러야 예약금이 반영됩니다.
 */
export const claimCustomerDeposit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(80) }).parse(d))
  .handler(
    async ({
      data,
    }): Promise<{ ok: boolean; error?: string; already?: boolean; amount?: number }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await supabaseAdmin
        .from("estimate_terms")
        .select(
          "id, user_id, estimate_id, sheet_no, sheet_version, customer_name, total, deposit_paid, sheet_snapshot",
        )
        .eq("access_token", data.token)
        .is("deleted_at", null)
        .maybeSingle();
      if (!row) return { ok: false, error: "링크가 만료되었거나 잘못된 주소입니다." };

      const t = row as {
        user_id: string;
        estimate_id: string;
        sheet_no: string | null;
        sheet_version: number | null;
        customer_name: string | null;
        total: number | null;
        deposit_paid: number | null;
        sheet_snapshot: string | null;
      };

      // 예약금은 저장된 총액으로 공통 규칙(10%, 1만 원 미만 버림)에 따라 다시 계산합니다.
      const total = Number(t.total ?? 0);
      let amount = calcDeposit(total);
      if (total > 0 && amount > total) amount = total;

      const { data: exist } = await supabaseAdmin
        .from("deposit_records")
        .select("id, status")
        .eq("user_id", t.user_id)
        .eq("estimate_id", t.estimate_id)
        .eq("source", "customer_claim")
        .in("status", ["pending_review", "confirmed"])
        .limit(1)
        .maybeSingle();
      if (exist) return { ok: true, already: true, amount };

      const { error } = await supabaseAdmin.from("deposit_records").insert({
        user_id: t.user_id,
        estimate_id: t.estimate_id,
        sheet_no: t.sheet_no ?? null,
        estimate_version: Number(t.sheet_version ?? 1),
        depositor_name: String(t.customer_name ?? ""),
        customer_name: String(t.customer_name ?? ""),
        amount,
        deposited_at: new Date().toISOString(),
        source: "customer_claim",
        raw_text: null,
        name_matched: true,
        status: "pending_review",
        review_note: "고객이 견적서에서 「입금했습니다」를 눌렀습니다. 통장 확인이 필요합니다.",
        dedupe_key: `claim|${t.estimate_id}|${Number(t.sheet_version ?? 1)}`,
      } as never);
      if (error) {
        if (/duplicate key|unique/i.test(error.message)) {
          return { ok: true, already: true, amount };
        }
        console.error("[claimCustomerDeposit]", error.message);
        return { ok: false, error: "입금 알림을 저장하지 못했습니다. 다시 시도해 주세요." };
      }
      return { ok: true, amount };
    },
  );

export interface RegisterDepositResult {
  ok: boolean;
  error?: string;
  /** 등록만으로는 항상 false */
  applied?: boolean;
  /** 업체 확인이 필요한지 (이름 일치 여부와 무관) */
  needsReview?: boolean;
  row?: DepositRow;
  paid?: number;
  /** 고객 문자 결과 */
  smsError?: string;
  duplicated?: boolean;
}

/** 은행 입금알림 문자를 붙여넣어 입금을 기록합니다 */
export const registerDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        estimateId: z.string().min(1).max(80),
        /** 은행 입금알림 문자 원문 */
        text: z.string().max(4000).default(""),
        /** 직접 입력하는 경우 */
        depositorName: z.string().max(60).optional(),
        amount: z.number().int().min(0).max(1_000_000_000).optional(),
        depositedAt: z.string().max(40).optional(),
        paymentKind: z.enum(["deposit", "balance"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<RegisterDepositResult> => {
    const parsed = parseDepositSms(data.text ?? "");
    const depositorName = (data.depositorName?.trim() || parsed.depositorName || "").trim();
    const amount = Number(data.amount ?? parsed.amount ?? 0) || 0;
    const depositedAt = data.depositedAt ?? parsed.depositedAt ?? new Date().toISOString();
    if (amount <= 0) {
      return { ok: false, error: "입금 금액을 읽지 못했습니다. 금액을 직접 입력해 주세요." };
    }

    const { data: terms, error: tErr } = await context.supabase
      .from("estimate_terms")
      .select("id,estimate_id,sheet_no,sheet_version,customer_name,total,deposit_paid")
      .eq("user_id", context.userId)
      .eq("estimate_id", data.estimateId)
      .order("sheet_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tErr || !terms) {
      return { ok: false, error: "이 견적서를 찾지 못했습니다. 견적서를 먼저 확정·발송해 주세요." };
    }

    const customerName = String(terms.customer_name ?? "");
    const matched = isSameName(depositorName, customerName);
    const paymentKind = receiptPaymentKind(Number(terms.deposit_paid ?? 0), data.paymentKind);
    const dedupeKey = [
      data.estimateId,
      amount,
      depositedAt.slice(0, 16),
      normalizeName(depositorName),
    ].join("|");

    const insert = {
      user_id: context.userId,
      estimate_id: data.estimateId,
      sheet_no: terms.sheet_no ?? null,
      estimate_version: Number(terms.sheet_version ?? 1),
      depositor_name: depositorName,
      customer_name: customerName,
      amount,
      deposited_at: depositedAt,
      source: data.text ? "sms_paste" : "manual",
      raw_text: (data.text ?? "").slice(0, 2000) || null,
      name_matched: matched,
      payment_kind: paymentKind,
      status: "pending_review",
      confirmed_at: null,
      confirmed_by: null,
      dedupe_key: dedupeKey,
    };

    const { data: created, error: insErr } = await context.supabase
      .from("deposit_records")
      .insert(insert)
      .select(SELECT)
      .maybeSingle();
    if (insErr) {
      if (/duplicate key|unique/i.test(insErr.message)) {
        return { ok: false, duplicated: true, error: "이미 기록된 입금 문자입니다." };
      }
      console.error("[registerDeposit]", insErr.message);
      return { ok: false, error: `입금 기록을 저장하지 못했습니다: ${insErr.message}` };
    }

    if (created) {
      return {
        ok: true,
        applied: false,
        needsReview: true,
        row: created ? toRow(created as RowDb) : undefined,
      };
    }

    return { ok: false, error: "입금 기록 저장 결과를 확인하지 못했습니다. 다시 조회해 주세요." };
  });

/** 사장님이 직접 확인한 입금을 반영합니다 */
export const confirmDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().max(200).optional() }).parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: boolean; error?: string; paid?: number; confirmedAt?: string }> => {
      const { data: result, error } = await context.supabase.rpc("confirm_payment_receipt", { _receipt_id: data.id });
      if (error) return { ok: false, error: "입금 확인을 저장하지 못했습니다." };
      return result as { ok: boolean; error?: string; paid?: number; confirmedAt?: string };
    },
  );

/** 우리 고객 입금이 아닌 것으로 처리합니다 (금액에 넣지 않습니다) */
export const rejectDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string; paid?: number }> => {
    const { data: row, error } = await context.supabase
      .from("deposit_records")
      .update({
        status: "rejected",
        review_note: data.note ?? "사장님이 우리 입금이 아니라고 확인",
        confirmed_at: null,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id,estimate_id")
      .maybeSingle();
    if (error || !row) return { ok: false, error: "입금 기록을 찾지 못했습니다." };
    const paid = await recalcAndSave(context, String(row.estimate_id));
    return { ok: true, paid };
  });

/** 입금 기록을 읽습니다 */
export const listDeposits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ estimateId: z.string().max(80).optional() }).parse(d ?? {}),
  )
  .handler(
    async ({ data, context }): Promise<{ ok: boolean; rows: DepositRow[]; paid: number }> => {
      let q = context.supabase.from("deposit_records").select(SELECT).eq("user_id", context.userId);
      if (data?.estimateId) q = q.eq("estimate_id", data.estimateId);
      const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(300);
      if (error || !rows) {
        if (error) console.error("[listDeposits]", error.message);
        return { ok: false, rows: [], paid: 0 };
      }
      const list = (rows as RowDb[]).map(toRow);
      const paid = list
        .filter((r) => r.status === "confirmed")
        .reduce((s, r) => s + r.amount, 0);
      return { ok: true, rows: list, paid };
    },
  );

