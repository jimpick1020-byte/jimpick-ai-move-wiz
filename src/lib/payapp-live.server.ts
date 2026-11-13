import { authenticatePayappNotice, kstStamp, payappDate, payappNextDate, sha256 } from "./payapp-live";

export async function payappRequest(cmd: "rebillRegist" | "rebillCancel", fields: Record<string,string>) {
  const user = process.env["PAYAPP_USER_ID"];
  const key = process.env["PAYAPP_LINK_KEY"];
  const request = process.env["PAYAPP_REQUEST_KEY"];
  if (!user || !key || !request) throw new Error("페이앱 연동 설정을 확인해 주세요.");
  const stamp = kstStamp(new Date());
  const body = new URLSearchParams({ ...fields,cmd,userid:user,linkkey:key,requestdate:stamp,hash:await sha256(user+stamp+request) });
  const response = await fetch("https://api.payapp.kr/oapi/v2", { method:"POST",body,signal:AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error("페이앱 응답을 확인하지 못했습니다. 다시 신청하지 말고 기존 요청을 확인해 주세요.");
  const result = new URLSearchParams(await response.text());
  // Never expose provider responses, which may contain merchant credentials or PII.
  if (result.get("state") !== "1") throw new Error("페이앱에서 요청을 승인하지 않았습니다. 기존 요청 상태를 확인해 주세요.");
  return result;
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
    if (!order || order.rebill_no !== notice.rebill_no || order.amount !== notice.price) return new Response("Payment mismatch",{status:409,headers});
    const paid = notice.pay_date ? payappDate(notice.pay_date) : null;
    const next = paid ? payappNextDate(order.first_paid_at ?? paid,paid) : null;
    const dates = paid && next ? { p_paid: paid, p_next: next } : {};
    const { error: saveError } = await supabaseAdmin.rpc("apply_payapp_event",{
      p_order:order.id,p_user:order.user_id,p_rebill:notice.rebill_no,p_mul:notice.mul_no,p_state:notice.pay_state,p_amount:notice.price,...dates,
    });
    if (saveError) throw new Error("Apply failure");
    // A link approved on a different KST day cannot silently use the request-day schedule.
    // Stop provider renewal, retain the verified paid month, and require reconciliation.
    if (notice.pay_state === "4" && !order.canceled_at && paid && Number(kstStamp(new Date(order.first_paid_at ?? paid)).slice(6,8)) !== order.requested_day) {
      await payappRequest("rebillCancel",{rebill_no:notice.rebill_no});
      const { error: cancelError } = await supabaseAdmin.rpc("finish_payapp_cancel",{p_order:order.id,p_user:order.user_id});
      if (cancelError) throw new Error("Cancellation persistence failure");
    }
    return new Response("SUCCESS",{status:200,headers});
  } catch { return new Response("Payment verification pending",{status:503,headers}); }
}