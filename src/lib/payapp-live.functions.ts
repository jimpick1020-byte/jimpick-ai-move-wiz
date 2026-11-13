import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { payappReadiness, payappPendingReusable, payappBillingSchedule, payappNextDate, safePayappUrl } from "./payapp-live";
import { payappRequest, payappRegistrationFields, PayappRequestError } from "./payapp-live.server";

export const getPayappSubscription = createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
  const { data: orders,error } = await context.supabase.from("payapp_orders").select("id,status,first_paid_at,last_paid_at,canceled_at,created_at,request_date,rebill_expire,requested_day").eq("user_id",context.userId).order("created_at",{ascending:false}).limit(1);
  if (error) throw new Error("페이앱 구독 상태를 불러오지 못했습니다.");
  const order = orders?.[0] ?? null;
  const readiness = payappReadiness(process.env);
  const next = order?.first_paid_at && order.last_paid_at ? payappNextDate(order.first_paid_at, order.last_paid_at) : null;
  return { ...readiness, order, pendingReusable: order ? payappPendingReusable(order) : false,
    schedule: order ? payappBillingSchedule(order, next) : null };
});
export const startPayappSubscription = createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator((input:unknown) => z.object({consent:z.literal(true),requestDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),expire:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).parse(input))
  .handler(async ({context,data:consent}) => {
    const readiness = payappReadiness(process.env);
    if (consent.requestDate !== readiness.quote.requestDate || consent.expire !== readiness.quote.expire) throw new Error("요청 날짜가 변경되었습니다. 오늘의 결제 안내를 다시 확인하고 동의해 주세요.");
    if (!readiness.ready) throw new Error(readiness.issues.join(" "));
    const { data: profile,error: profileError } = await context.supabase.from("profiles").select("phone").eq("id",context.userId).single();
    const phone = profile?.phone?.replace(/\D/g,"") ?? "";
    if (profileError || !/^01[016789]\d{7,8}$/.test(phone)) throw new Error("업체 연락처를 먼저 확인해 주세요.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const day = readiness.quote.day;
    const {data,error} = await supabaseAdmin.rpc("reserve_payapp_order",{p_user:context.userId,p_day:day});
    if (error) throw new Error("이미 구독 중이거나 확인 중인 결제 요청이 있습니다. 기존 구독 상태를 확인해 주세요.");
    const reserved = z.object({created:z.boolean(),order:z.object({id:z.string().uuid(),payurl:z.string().nullable(),status:z.string(),created_at:z.string(),request_date:z.string().nullable(),rebill_expire:z.string().nullable(),first_paid_at:z.string().nullable()})}).parse(data);
    if (!reserved.created) {
      if (payappPendingReusable(reserved.order) && reserved.order.payurl) return {payurl:safePayappUrl(reserved.order.payurl)};
      if (reserved.order.status === "pending") throw new Error("이전 날짜의 미승인 요청은 다시 열 수 없습니다. 기존 요청을 확인·취소한 뒤 새로 동의해 주세요. 페이앱 직접 링크 만료 여부는 별도 확인이 필요합니다.");
      throw new Error("기존 결제 요청 확인 중입니다. 중복 신청하지 말고 잠시 후 다시 확인해 주세요.");
    }
    if (reserved.order.request_date !== consent.requestDate || reserved.order.rebill_expire !== consent.expire) {
      await supabaseAdmin.rpc("reject_payapp_registration",{p_order:reserved.order.id,p_user:context.userId});
      throw new Error("요청 날짜가 변경되었습니다. 오늘의 결제 안내를 다시 확인해 주세요.");
    }
    // Provider lacks a documented idempotency key: a network-ambiguous create stays locked.
    let result: URLSearchParams;
    try { result = await payappRequest("rebillRegist",payappRegistrationFields({id:reserved.order.id,user_id:context.userId,requested_day:day,rebill_expire:consent.expire},phone)); } catch (error) {
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