import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlanId = "free" | "basic" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  desc: string;
  features: string[];
  aiLimit: number;
}

/** 무료 체험 기간(일) */
export const TRIAL_DAYS = 3;

/** 업체용 월 구독 요금제 (VAT 포함 월 22,000원 단일 요금제) */
export const PLANS: Plan[] = [
  {
    id: "free",
    name: "무료 체험",
    price: 0,
    desc: `가입 후 ${TRIAL_DAYS}일 동안 모든 기능 체험`,
    features: ["견적 작성 무제한", "AI 공간 스캔 체험", "카카오맵 실거리 계산"],
    aiLimit: 20,
  },
  {
    id: "pro",
    name: "업체 구독",
    price: 22000,
    desc: "월 22,000원 (부가세 포함) · 약정 없음",
    features: [
      "견적 작성 무제한",
      "AI 공간 스캔 무제한",
      "카카오맵 실거리·경로 계산",
      "고객 관리 · 견적 통계",
      "고객용 공유 링크",
    ],
    aiLimit: 999999,
  },
];


export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: sub }, { data: profile }, { data: payments }] = await Promise.all([
      context.supabase.from("subscriptions").select("*").eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase.from("payments").select("*").eq("user_id", context.userId).order("paid_at", { ascending: false }).limit(20),
    ]);
    return { subscription: sub ?? null, profile: profile ?? null, payments: payments ?? [] };
  });

/**
 * 구독 결제 처리.
 * 지금은 테스트(모의) 결제로 구독과 결제 내역을 기록합니다.
 * 실제 카드 결제 연동 시 이 핸들러 안에서 결제사 승인 후 동일하게 기록하면 됩니다.
 */
export const subscribePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ plan: z.enum(["free", "basic", "pro"]), method: z.enum(["card", "transfer"]).default("card") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const plan = PLANS.find((p) => p.id === data.plan) ?? PLANS[PLANS.length - 1];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    // 무료 체험은 3일, 유료 구독은 30일 주기
    const end = new Date(now.getTime() + (plan.price === 0 ? TRIAL_DAYS : 30) * 86400000);


    const { error: subErr } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: context.userId,
        plan: plan.id,
        status: plan.price === 0 ? "trialing" : "active",
        price: plan.price,
        interval: "month",
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        cancel_at_period_end: false,
      },
      { onConflict: "user_id" },
    );
    if (subErr) throw new Error(subErr.message);

    if (plan.price > 0) {
      const { error: payErr } = await supabaseAdmin.from("payments").insert({
        user_id: context.userId,
        plan: plan.id,
        amount: plan.price,
        method: data.method,
        status: "paid",
        receipt_no: `JP${now.getTime()}`,
      });
      if (payErr) throw new Error(payErr.message);
    }

    return { ok: true, plan: plan.id, periodEnd: end.toISOString() };
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("subscriptions")
      .update({ cancel_at_period_end: true })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
