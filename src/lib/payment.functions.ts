/**
 * 예약금·잔금 결제 상태 (사장님이 직접 확인하는 방식).
 *
 * 금액을 자동으로 바꾸지 않습니다. 사장님이 확인한 값만 저장합니다.
 * 예약금(deposit_paid)은 기존 입금 확인 기능이 계산하고,
 * 여기서는 잔금·진행 상태·메모·확인 담당자만 다룹니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const PAYMENT_STATUSES = [
  "unpaid",
  "deposit_paid",
  "balance_paid",
  "completed",
  "canceled",
  "refunded",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "미입금",
  deposit_paid: "예약금 입금 확인",
  balance_paid: "잔금 입금 확인",
  completed: "결제 완료",
  canceled: "취소",
  refunded: "환불",
};

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
        .select("id")
        .eq("user_id", context.userId)
        .eq("estimate_id", data.estimateId)
        .order("sheet_version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (findErr || !terms) {
        return { ok: false, error: "이 견적서를 찾지 못했습니다. 먼저 견적서를 발송해 주세요." };
      }

      const now = new Date().toISOString();
      const balance = data.balancePaid;
      const patch: Record<string, unknown> = {
        payment_status: data.status,
        payment_note: data.note?.trim() ? data.note.trim() : null,
        payment_confirmed_by: context.userId,
        payment_confirmed_at: now,
      };
      if (typeof balance === "number") {
        patch["balance_paid"] = balance;
        patch["balance_paid_at"] = balance > 0 ? now : null;
      }

      const { error } = await context.supabase
        .from("estimate_terms")
        .update(patch as never)
        .eq("id", (terms as { id: string }).id);
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
          await syncMoveReminder((terms as { id: string }).id);
        }
      } catch (e) {
        console.error("[setPaymentState] 안내 문자 예약 변경 실패", e instanceof Error ? e.message : e);
      }
      return { ok: true, balancePaid: balance, confirmedAt: now };
    },
  );

