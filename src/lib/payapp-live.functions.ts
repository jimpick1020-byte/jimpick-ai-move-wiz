import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { kstStamp, payappReadiness, safePayappUrl } from "./payapp-live";
import { payappRequest, PayappRequestError } from "./payapp-live.server";

export const getPayappSubscription = createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
  const { data: orders,error } = await context.supabase.from("payapp_orders").select("id,status,first_paid_at,last_paid_at,canceled_at,payurl,created_at").eq("user_id",context.userId).order("created_at",{ascending:false}).limit(1);
  if (error) throw new Error("페이앱 구독 상태를 불러오지 못했습니다.");
  return { ...payappReadiness(process.env),order:orders?.[0] ?? null };
});
export const startPayappSubscription = createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator((input:unknown) => z.object({consent:z.literal(true)}).parse(input))
  .handler(async ({context}) => {
    const readiness = payappReadiness(process.env);
    if (!readiness.ready) throw new Error(readiness.issues.join(" "));
    const { data: profile,error: profileError } = await context.supabase.from("profiles").select("phone").eq("id",context.userId).single();
    const phone = profile?.phone?.replace(/\D/g,"") ?? "";
    if (profileError || !/^01[016789]\d{7,8}$/.test(phone)) throw new Error("업체 연락처를 먼저 확인해 주세요.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const day = Number(kstStamp(new Date()).slice(6,8));
    const {data,error} = await supabaseAdmin.rpc("reserve_payapp_order",{p_user:context.userId,p_day:day});
    if (error) throw new Error("이미 구독 중이거나 확인 중인 결제 요청이 있습니다. 기존 구독 상태를 확인해 주세요.");
    const reserved = z.object({created:z.boolean(),order:z.object({id:z.string().uuid(),payurl:z.string().nullable(),status:z.string()})}).parse(data);
    if (!reserved.created) {
      if (reserved.order.status === "pending" && reserved.order.payurl) return {payurl:safePayappUrl(reserved.order.payurl)};
      throw new Error("기존 결제 요청 확인 중입니다. 중복 신청하지 말고 잠시 후 다시 확인해 주세요.");
    }
    // Provider lacks a documented idempotency key: a network-ambiguous create stays locked.
    let result: URLSearchParams;
    try { result = await payappRequest("rebillRegist",{
      goodname:"견적잇 업체 월 구독",goodprice:"30000",recvphone:phone,rebillCycleType:"Month",rebillCycleMonth:String(day),
      rebillExpire:process.env["PAYAPP_REBILL_EXPIRE"] ?? "",smsuse:"n",openpaytype:"card",var1:reserved.order.id,var2:context.userId,
      feedbackurl:"https://gyeonjeokit.lovable.app/api/public/payapp/feedback",failurl:"https://gyeonjeokit.lovable.app/api/public/payapp/feedback",
      returnurl:"https://gyeonjeokit.lovable.app/api/public/payapp/return",
    }); } catch (error) {
      if (error instanceof PayappRequestError && error.definitive) {
        const {error: releaseError} = await supabaseAdmin.rpc("reject_payapp_registration",{p_order:reserved.order.id,p_user:context.userId});
        if (releaseError) throw new Error("등록 거절 후 상태 저장을 확인하지 못했습니다. 중복 신청하지 마세요.");
      }
      throw error;
    }
    const rebill = result.get("rebill_no") ?? "";
    if (!/^\d+$/.test(rebill)) throw new Error("페이앱 등록 번호 확인 중입니다. 다시 신청하지 마세요.");
    const url = safePayappUrl(result.get("payurl") ?? "");
    const { error: saveError } = await supabaseAdmin.from("payapp_orders").update({rebill_no:rebill,payurl:url,status:"pending"}).eq("id",reserved.order.id).eq("status","creating");
    if (saveError) throw new Error("결제 요청 저장을 확인하지 못했습니다. 중복 신청하지 마세요.");
    return {payurl:url};
  });
export const cancelPayappSubscription = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
  const {data:order,error} = await context.supabase.from("payapp_orders").select("id,rebill_no,canceled_at").eq("user_id",context.userId).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if (error || !order?.rebill_no) throw new Error("페이앱 구독 정보를 확인하지 못했습니다.");
  if (order.canceled_at) return {ok:true};
  await payappRequest("rebillCancel",{rebill_no:order.rebill_no});
  const {supabaseAdmin} = await import("@/integrations/supabase/client.server");
  const {error:saveError} = await supabaseAdmin.rpc("finish_payapp_cancel",{p_order:order.id,p_user:context.userId});
  if (saveError) throw new Error("페이앱 해지 후 저장 확인이 필요합니다. 다시 상태를 확인해 주세요.");
  return {ok:true};
});