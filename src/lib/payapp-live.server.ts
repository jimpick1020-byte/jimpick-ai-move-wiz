import { authenticatePayappNotice, kstStamp, payappDate, payappNextDate, payappFirstApprovalMatches, payappKstDate, sha256 } from "./payapp-live";

export class PayappRequestError extends Error {
  constructor(readonly definitive: boolean, readonly code: string | null = null) {
    super(definitive ? `페이앱이 등록 요청을 거절했습니다${code ? ` (오류 코드 ${code})` : ""}. 설정 확인 후 다시 시도할 수 있습니다.` : "페이앱 요청 결과를 확인하지 못했습니다. 중복 신청하지 말고 기존 요청을 확인해 주세요.");
    this.name = "PayappRequestError";
  }
}

export function payappRegistrationFields(order: {id:string;user_id:string;requested_day:number;rebill_expire:string}, phone:string) {
  return {
    goodname:"견적잇 업체 월 구독",goodprice:"30000",recvphone:phone,rebillCycleType:"Month",rebillCycleMonth:String(order.requested_day),
    rebillExpire:order.rebill_expire,smsuse:"n",openpaytype:"card",var1:order.id,var2:order.user_id,
    feedbackurl:"https://gyeonjeokit.lovable.app/api/public/payapp/feedback",failurl:"https://gyeonjeokit.lovable.app/api/public/payapp/feedback",
    returnurl:"https://gyeonjeokit.lovable.app/api/public/payapp/return",
  };
}

export async function payappRequest(cmd: "rebillRegist" | "rebillCancel", fields: Record<string,string>) {
  const user = process.env["PAYAPP_USER_ID"];
  const key = process.env["PAYAPP_LINK_KEY"];
  const request = process.env["PAYAPP_REQUEST_KEY"];
  if (!user || !key || !request) throw new Error("페이앱 연동 설정을 확인해 주세요.");
  const stamp = kstStamp(new Date());
  const body = new URLSearchParams({ ...fields,cmd,userid:user,linkkey:key,requestdate:stamp,hash:await sha256(user+stamp+request) });
  let response: Response;
  let text: string;
  try {
    response = await fetch("https://api.payapp.kr/oapi/v2", { method:"POST",body,signal:AbortSignal.timeout(30000) });
    if (!response.ok) throw new PayappRequestError(false);
    text = await response.text();
  } catch { throw new PayappRequestError(false); }
  const result = new URLSearchParams(text);
  // Never expose provider responses, which may contain merchant credentials or PII.
  const code = result.get("errno");
  const safeCode = code && /^\d{5}$/.test(code) ? code : null;
  const hasRegistration = Boolean(result.get("rebill_no") || result.get("payurl"));
  if (result.getAll("state").length !== 1 || result.get("state") !== "1") {
    throw new PayappRequestError(result.getAll("state").length === 1 && result.get("state") === "0" && !hasRegistration && safeCode !== "99999", safeCode);
  }
  // Allowlist response fields; errorMessage/card/customer/credential fields never escape.
  return new URLSearchParams(["rebill_no", "payurl"].flatMap(k => result.getAll(k).length === 1 ? [[k, result.get(k) ?? ""]] : []));
}
export async function handlePayappFeedback(request: Request) {
  const headers = { "Cache-Control":"no-store" };
  if (!(request.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) return new Response("Invalid content type",{status:415,headers});
  // No payload logs, including the optional card_num field sent by PayApp.
  const reader = request.body?.getReader();
  if (!reader) return new Response("Invalid request",{status:400,headers});
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if (size>16384) { await reader.cancel(); return new Response("Request too large",{status:413,headers}); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset=0; for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.length; }
  const params = new URLSearchParams(new TextDecoder().decode(bytes));
  for (const k of params.keys()) if (params.getAll(k).length !== 1) return new Response("Invalid request",{status:400,headers});
  let notice;
  try { notice = await authenticatePayappNotice(Object.fromEntries(params),process.env); }
  catch { return new Response("Invalid notice",{status:401,headers}); }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order,error } = await supabaseAdmin.from("payapp_orders").select("*").eq("id",notice.var1).eq("user_id",notice.var2).maybeSingle();
    if (error) throw new Error("Read failure");
    const partial = notice.pay_state === "70" || notice.pay_state === "71";
    if (!order || order.rebill_no !== notice.rebill_no || order.amount !== (partial ? notice.orig_price : notice.price)) return new Response("Payment mismatch",{status:409,headers});
    const paid = notice.pay_date ? payappDate(notice.pay_date) : null;
    if (notice.pay_state === "4" && paid && order.rebill_expire && payappKstDate(paid) >= order.rebill_expire) return new Response("Expired registration requires reconciliation",{status:409,headers});
    const next = paid ? payappNextDate(order.first_paid_at ?? paid,paid) : null;
    const dates = paid && next ? { p_paid: paid, p_next: next } : {};
    const { data: applied, error: saveError } = await supabaseAdmin.rpc("apply_payapp_notice",{
      p_order:order.id,p_user:order.user_id,p_rebill:notice.rebill_no,p_mul:notice.mul_no,p_state:notice.pay_state,p_amount:notice.price,...dates,
      ...(partial ? {p_orig_mul:notice.orig_mul_no,p_orig_price:notice.orig_price} : {}),
    });
    if (saveError) throw new Error("Apply failure");
    // A link approved on a different KST day cannot silently use the request-day schedule.
    // Stop provider renewal, retain the verified paid month, and require reconciliation.
    const isolated = typeof applied === "object" && applied !== null && !Array.isArray(applied) && applied.isolated === true;
    if (notice.pay_state === "4" && !isolated && !order.canceled_at && paid && !payappFirstApprovalMatches(order,paid)) {
      await payappRequest("rebillCancel",{rebill_no:notice.rebill_no});
      const { error: cancelError } = await supabaseAdmin.rpc("finish_payapp_cancel",{p_order:order.id,p_user:order.user_id});
      if (cancelError) throw new Error("Cancellation persistence failure");
    }
    return new Response("SUCCESS",{status:200,headers});
  } catch { return new Response("Payment verification pending",{status:503,headers}); }
}