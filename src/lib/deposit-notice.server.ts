// 예약금 입금 확인 후 고객 안내 문자(알리고) — 사장님이 확인 버튼을 누른 뒤에만, 영수 1건당 1회.
import { formatTel } from "./format-input";
import { paymentText } from "./customer-payment";
import { depositNoticeKey } from "./deposit-notice";

export interface DepositNoticeResult {
  sent: boolean;
  skipped?: "not_deposit" | "already" | "not_confirmed";
  error?: string;
}

const ADMIN_SENDER = "01075662542";

export async function sendDepositConfirmedSms(companyId: string, receiptId: string): Promise<DepositNoticeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendViaAligo, readCreds } = await import("./reminder-send.server");
  const { data: rec } = await supabaseAdmin
    .from("deposit_records")
    .select("id,estimate_id,payment_kind,status,amount,notified_at")
    .eq("id", receiptId).eq("user_id", companyId).maybeSingle();
  if (!rec) return { sent: false, error: "입금 기록을 찾지 못했습니다." };
  if (rec.payment_kind !== "deposit") return { sent: false, skipped: "not_deposit" };
  if (rec.status !== "confirmed") return { sent: false, skipped: "not_confirmed" };
  if (rec.notified_at) return { sent: false, skipped: "already" };

  const key = depositNoticeKey(String(rec.estimate_id));
  // 같은 견적에 이미 접수된 예약금 안내가 있으면 다시 보내지 않습니다.
  const { data: prior } = await supabaseAdmin.from("estimate_deliveries").select("id")
    .eq("idempotency_key", key).eq("status", "accepted").limit(1);
  if (prior && prior.length) {
    await supabaseAdmin.from("deposit_records").update({ notified_at: new Date().toISOString() } as never).eq("id", receiptId).is("notified_at", null);
    return { sent: false, skipped: "already" };
  }
  // 원자적 선점: 동시 클릭·새로고침 중복 방지
  const claimAt = new Date().toISOString();
  const { data: claimed } = await supabaseAdmin.from("deposit_records")
    .update({ notified_at: claimAt, notify_error: null } as never)
    .eq("id", receiptId).is("notified_at", null).select("id");
  if (!claimed || !claimed.length) return { sent: false, skipped: "already" };

  const fail = async (error: string, code: string, to = "", msgType = "SMS") => {
    await supabaseAdmin.from("deposit_records").update({ notified_at: null, notify_error: error.slice(0, 500) } as never).eq("id", receiptId);
    const now = new Date().toISOString();
    await supabaseAdmin.from("estimate_deliveries").insert({
      estimate_id: rec.estimate_id, user_id: companyId, company_id: companyId,
      to_masked: `****${to.slice(-4)}`, delivery_method: "deposit_confirmed", provider: "aligo",
      msg_type: msgType, status: "failed", requested_at: now, sent_at: now, failed_at: now,
      error_code: code, error_message: error.slice(0, 500), idempotency_key: key,
    } as never);
    return { sent: false, error };
  };

  const { data: terms } = await supabaseAdmin.from("estimate_terms")
    .select("customer_name,contact_phone,deposit_paid,sheet_version")
    .eq("user_id", companyId).eq("estimate_id", rec.estimate_id).is("deleted_at", null)
    .order("sheet_version", { ascending: false }).limit(1).maybeSingle();
  const to = String(terms?.contact_phone ?? "").replace(/[^0-9]/g, "");
  if (!terms || !String(terms.customer_name ?? "").trim()) return fail("견적의 고객 정보를 찾지 못했습니다.", "no_terms", to);
  if (!/^01[016789][0-9]{7,8}$/.test(to)) return fail("고객 휴대전화번호 형식이 올바르지 않습니다.", "invalid_phone", to);
  const creds = readCreds();
  if (!creds) return fail("문자 발송 설정(알리고 인증정보)이 없어 발송하지 않았습니다.", "no_creds", to);

  const { data: profile } = await supabaseAdmin.from("profiles").select("phone").eq("id", companyId).maybeSingle();
  const companyPhone = formatTel(String(profile?.phone ?? ""));
  const amount = Number(terms.deposit_paid ?? rec.amount ?? 0) || Number(rec.amount ?? 0);
  const text = [paymentText(String(terms.customer_name).trim(), amount, "deposit", true), companyPhone && `문의: ${companyPhone}`].filter(Boolean).join("\n");
  const msgType = new TextEncoder().encode(text).length > 90 ? "LMS" : "SMS";

  const usage = supabaseAdmin as unknown as { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: Record<string, unknown> | null }> };
  const usageKey = `usage:deposit-confirmed:${receiptId}`;
  const { data: reserved } = await usage.rpc("reserve_free_sms", { _user_id: companyId, _key: usageKey, _count: 1 });
  if (reserved?.["allowed"] !== true) {
    return fail(reserved?.["reason"] === "duplicate" ? "이미 처리된 발송 요청입니다." : "무료 문자 사용 기간이 끝나 발송하지 않았습니다.", String(reserved?.["reason"] ?? "quota"), to, msgType);
  }
  const out = await sendViaAligo({ to, text, title: "", msgType, ...creds, sender: ADMIN_SENDER, companyId });
  await usage.rpc(out.ok ? "confirm_free_sms" : "release_free_sms", { _user_id: companyId, _key: usageKey });
  if (!out.ok) return fail(out.error ?? "문자 발송에 실패했습니다.", String(out.code ?? "send_error"), to, msgType);

  const now = new Date().toISOString();
  await supabaseAdmin.from("estimate_deliveries").insert({
    estimate_id: rec.estimate_id, user_id: companyId, company_id: companyId,
    to_masked: `****${to.slice(-4)}`, delivery_method: "deposit_confirmed", provider: "aligo",
    provider_message_id: out.msgId ?? null, msg_id: out.msgId ?? null, msg_type: out.msgType ?? msgType,
    status: "accepted", requested_at: now, sent_at: now, idempotency_key: key,
    provider_result: { result_code: out.code ?? null },
  } as never);
  return { sent: true };
}
