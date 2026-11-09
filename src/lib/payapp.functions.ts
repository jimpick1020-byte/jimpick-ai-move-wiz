import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { PLANS } from "./subscription.functions";
import { registerTest, notifyTest, cancelTest, NEW_TRIAL_DAYS, type PayappTestState } from "./payapp-test";
import type { Json } from "@/integrations/supabase/types";

// Deliberately no external billing calls. Merchant test approval is required before live integration.
export const getPayappTest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("payapp_test_subscriptions")
      .select("state").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error("시험 구독을 불러오지 못했습니다.");
    const state = data?.state as unknown as PayappTestState | undefined;
    return { mode: "test" as const, state: state?.mode === "test" ? state : null };
  });

export const runPayappTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ action: z.enum(["register", "renew", "duplicate", "cancel"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("payapp_test_subscriptions")
      .select("state").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error("시험 구독을 읽지 못했습니다.");
    const old = row?.state ?? {};
    const state = old as unknown as PayappTestState;
    let next: PayappTestState;
    let duplicate = false;
    if (data.action === "register") {
      if (state.mode === "test" && state.status !== "canceled") return { state, duplicate: true };
      // Signup timestamp determines the trial; registration never restarts a trial.
      const { data: user, error: authError } = await context.supabase.auth.getUser();
      if (authError || !user.user) throw new Error("가입일을 확인하지 못했습니다.");
      const { data: sub, error: subError } = await context.supabase.from("subscriptions")
        .select("trial_ends_at").eq("user_id", context.userId).maybeSingle();
      if (subError) throw new Error("체험 기간을 확인하지 못했습니다.");
      const trialEnd = sub?.trial_ends_at ?? new Date(Date.parse(user.user.created_at) + NEW_TRIAL_DAYS * 86400000).toISOString();
      next = registerTest(new Date().toISOString(), trialEnd);
    } else {
      if (state.mode !== "test") throw new Error("시험 구독을 먼저 등록해 주세요.");
      if (data.action === "cancel") next = cancelTest(state);
      else {
        const last = state.events.at(-1);
        if (data.action === "duplicate" && !last) throw new Error("갱신 시험을 먼저 실행해 주세요.");
        const event = data.action === "duplicate" && last ? last : `mock:${state.nextBillingAt}`;
        const plan = PLANS.find(p => p.id === "pro");
        if (!plan) throw new Error("요금제를 찾지 못했습니다.");
        const r = notifyTest(state, event, plan.price);
        next = r.state; duplicate = r.duplicate;
      }
    }
    const { error: saveError } = await context.supabase.rpc("save_payapp_test_state", {
      p_expected: old, p_next: next as unknown as Json,
    });
    if (saveError) throw new Error("시험 결과 저장에 실패했습니다. 다시 시도해 주세요.");
    return { state: next, duplicate };
  });