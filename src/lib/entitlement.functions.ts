/**
 * 이용 권한(무료체험 · 유료구독) 검사.
 *
 * - 신규 가입자는 가입 시각부터 정확히 168시간(7일) 동안 모든 기능을 씁니다.
 * - 7일이 지나고 결제하지 않으면 「읽기 전용」이 됩니다.
 *   (기존 고객·견적·문자·결제 기록은 그대로 두고, 새로 만들거나 보내는 것만 막습니다)
 * - 서비스 소유자·관리자 계정은 기간 제한 없이 씁니다. 관리자 여부는 서버에서 확인합니다.
 */
import { createServerFn, createMiddleware } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/** 무료체험 기간 (일) */
export const TRIAL_DAYS = 7;
/** 무료체험 기간 (시간) */
export const TRIAL_HOURS = TRIAL_DAYS * 24;

export const TRIAL_EXPIRED_MESSAGE =
  "7일 무료체험이 종료되었습니다. 구독 후 계속 사용할 수 있습니다";

export type EntitlementState = "admin" | "trial" | "active" | "expired";

export interface Entitlement {
  /** 지금 기능을 쓸 수 있는지 */
  allowed: boolean;
  /** JIMPICK 서비스 최고관리자 계정인지 (서버에서 확인) */
  isSuperAdmin: boolean;
  state: EntitlementState;
  /** 체험 종료 일시 */
  trialEndsAt: string | null;
  /** 구독 이용기간 종료 일시 */
  periodEnd: string | null;
  /** 종료까지 남은 시간(밀리초) — 지났으면 0 */
  remainingMs: number;
  /** 막혔을 때 보여 줄 안내 */
  message?: string;
}

interface SubRow {
  plan: string;
  status: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
}

/** 체험 종료 일시 — 저장된 값이 없으면 시작 시각 + 7일로 계산합니다 */
function trialEnd(sub: SubRow): number {
  if (sub.trial_ends_at) return new Date(sub.trial_ends_at).getTime();
  const start = sub.trial_started_at ?? sub.current_period_start ?? sub.created_at;
  return new Date(start).getTime() + TRIAL_HOURS * 3600_000;
}

export function computeEntitlement(
  sub: SubRow | null,
  isAdmin: boolean,
  now: number = Date.now(),
): Entitlement {
  if (isAdmin) {
    return {
      allowed: true,
      isSuperAdmin: true,
      state: "admin",
      trialEndsAt: null,
      periodEnd: null,
      remainingMs: 0,
    };
  }
  if (!sub) {
    return {
      allowed: false,
      isSuperAdmin: false,
      state: "expired",
      trialEndsAt: null,
      periodEnd: null,
      remainingMs: 0,
      message: TRIAL_EXPIRED_MESSAGE,
    };
  }

  const periodEnd = new Date(sub.current_period_end).getTime();
  const paid = sub.plan !== "free" && sub.status === "active" && periodEnd > now;
  if (paid) {
    return {
      allowed: true,
      isSuperAdmin: false,
      state: "active",
      trialEndsAt: sub.trial_ends_at ?? null,
      periodEnd: sub.current_period_end,
      remainingMs: Math.max(0, periodEnd - now),
    };
  }

  const end = trialEnd(sub);
  if (sub.status === "trialing" && end > now) {
    return {
      allowed: true,
      isSuperAdmin: false,
      state: "trial",
      trialEndsAt: new Date(end).toISOString(),
      periodEnd: sub.current_period_end,
      remainingMs: end - now,
    };
  }

  return {
    allowed: false,
    state: "expired",
    trialEndsAt: new Date(end).toISOString(),
    periodEnd: sub.current_period_end,
    remainingMs: 0,
    message: TRIAL_EXPIRED_MESSAGE,
  };
}

const SELECT =
  "plan, status, trial_started_at, trial_ends_at, current_period_start, current_period_end, created_at";

/** 지금 로그인한 계정의 이용 권한을 서버에서 읽습니다 */
export async function loadEntitlement(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Entitlement> {
  const [subRes, roleRes] = await Promise.all([
    supabase.from("subscriptions").select(SELECT).eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
  ]);
  return computeEntitlement((subRes.data as SubRow | null) ?? null, !!roleRes.data);
}

/**
 * 이 기능은 「체험 중 · 구독 중 · 관리자」만 쓸 수 있습니다.
 * 기간이 끝난 계정은 서버에서도 막힙니다.
 */
export const requireActiveEntitlement = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const ent = await loadEntitlement(
      context.supabase,
      context.userId,
    );
    if (!ent.allowed) throw new Error(ent.message ?? TRIAL_EXPIRED_MESSAGE);
    return next({ context: { entitlement: ent } });
  });

/** 화면에서 이용 권한을 확인합니다 */
export const getMyEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Entitlement> =>
    loadEntitlement(context.supabase, context.userId),
  );
