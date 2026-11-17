import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const confirmCardReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ termsId: z.string().uuid(), complete: z.boolean().default(false), terminalConfirmed: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { data: result, error } = await context.supabase.rpc("confirm_onsite_card", {
      _terms_id: data.termsId, _complete: data.complete, _terminal_confirmed: data.terminalConfirmed,
    });
    if (error) return { ok: false, error: "카드 예약 확인을 저장하지 못했습니다." };
    return result as { ok: boolean; error?: string };
  });

/** Read-only native composer preparation; never sends or records delivery. */
export const prepareCardReservationSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ termsId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: t } = await context.supabase.from("estimate_terms")
      .select("user_id, contact_phone, customer_name, move_date, total, reservation_payment_choice, card_confirmed_at")
      .eq("id", data.termsId).is("deleted_at", null).neq("contract_status", "cancelled").maybeSingle();
    if (!t || t.reservation_payment_choice !== "onsite_card" || !t.card_confirmed_at) throw new Error("확정된 카드 예약을 찾지 못했습니다.");
    if (t.user_id !== context.userId) {
      const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
      const { data: superAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
      if (!admin && !superAdmin) throw new Error("문자를 준비할 권한이 없습니다.");
    }
    return { phone: t.contact_phone ?? "", body: `[견적잇 예약 확정]\n${t.customer_name} 고객님, ${t.move_date} 이사 예약이 확정되었습니다.\n예약금 없음 · 현장 카드 결제 예정 ${Number(t.total).toLocaleString("ko-KR")}원` };
  });