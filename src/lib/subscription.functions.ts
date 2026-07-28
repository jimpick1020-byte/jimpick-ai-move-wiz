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

/** 업체용 월 구독 요금제 */
export const PLANS: Plan[] = [
  {
    id: "free",
    name: "무료 체험",
    price: 0,
    desc: "14일 동안 모든 기능 체험",
    features: ["견적 작성 무제한", "AI 인식 월 10회", "문자·카카오톡 발송"],
    aiLimit: 10,
  },
  {
    id: "basic",
    name: "베이직",
    price: 39000,
    desc: "1인 사업자·소규모 업체",
    features: ["견적 작성 무제한", "AI 인식 월 200회", "카카오맵 실거리 계산", "고객 관리"],
    aiLimit: 200,
  },
  {
    id: "pro",
    name: "프로",
    price: 89000,
    desc: "팀 단위 운영 업체",
    features: ["베이직 전체 기능", "AI 인식 무제한", "직원 계정 5개", "견적서 브랜딩", "우선 지원"],
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
    const plan = PLANS.find((p) => p.id === data.plan)!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const end = new Date(now.getTime() + 30 * 86400000);

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
