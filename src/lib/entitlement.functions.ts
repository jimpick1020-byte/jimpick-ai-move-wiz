/**
 * 이용 권한(무료체험 · 유료구독) 검사.
 *
 * - 신규 가입자는 가입 시각부터 정확히 30일(한 달) 동안 모든 기능을 씁니다.
 * - 한 달이 지나고 결제하지 않으면 「읽기 전용」이 됩니다.
 *   (기존 고객·견적·문자·결제 기록은 그대로 두고, 새로 만들거나 보내는 것만 막습니다)
 * - 체험 기간에는 문자를 건수 제한 없이 보낼 수 있습니다 (사용량은 기록합니다).
 * - 서비스 소유자·관리자 계정은 기간 제한 없이 씁니다. 관리자 여부는 서버에서 확인합니다.
 */
import { createServerFn, createMiddleware } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/** 무료체험 기간 (일) */
export const TRIAL_DAYS = 30;
/** 무료체험 기간 (시간) */
export const TRIAL_HOURS = TRIAL_DAYS * 24;

export const TRIAL_EXPIRED_MESSAGE =
  "한 달 무료체험이 종료되었습니다. 계속 이용하려면 구독해 주세요.";

/** 무료 문자 사용량 표시용 참고 값 (체험 중에는 건수 제한이 없습니다) */
export const FREE_SMS_LIMIT = 20;

export const SMS_LIMIT_MESSAGE =
  "무료 문자 사용량을 확인해 주세요. 계속 이용하려면 구독해 주세요.";

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
  /** 체험 종료까지 남은 날 수 (올림) */
  trialDaysLeft: number;
  /** 서버에 기록된 무료 문자 사용 건수 */
  freeSmsUsed: number;
  /** 무료 문자 상한 (20) */
  freeSmsLimit: number;
  /** 남은 무료 문자 건수 */
  freeSmsRemaining: number;
  /** 무료 문자 상한을 적용받는 계정인지 (관리자·유료 구독은 false) */
  freeSmsLimited: boolean;
  /** 지금 문자를 보낼 수 있는지 */
  canSendSms: boolean;
  /** 문자를 보낼 수 없을 때 보여 줄 안내 */
  smsMessage?: string;
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

/** 무료 문자 사용량 (서버가 준 실제 값) */
export interface SmsQuota {
  used: number;
  limit: number;
  remaining: number;
  limited: boolean;
}

/** 체험 종료 일시 — 저장된 값이 없으면 시작 시각 + 7일로 계산합니다 */
function trialEnd(sub: SubRow): number {
  if (sub.trial_ends_at) return new Date(sub.trial_ends_at).getTime();
  const start = sub.trial_started_at ?? sub.current_period_start ?? sub.created_at;
  return new Date(start).getTime() + TRIAL_HOURS * 3600_000;
}

/** 남은 날 수 (올림) */
function daysLeft(ms: number): number {
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

export function computeEntitlement(
  sub: SubRow | null,
  isAdmin: boolean,
  now: number = Date.now(),
  quota: SmsQuota = { used: 0, limit: FREE_SMS_LIMIT, remaining: FREE_SMS_LIMIT, limited: true },
): Entitlement {
  const sms = {
    freeSmsUsed: quota.used,
    freeSmsLimit: quota.limit,
    freeSmsRemaining: quota.remaining,
    freeSmsLimited: quota.limited,
  };
  if (isAdmin) {
    return {
      allowed: true,
      isSuperAdmin: true,
      state: "admin",
      trialEndsAt: null,
      periodEnd: null,
      remainingMs: 0,
      trialDaysLeft: 0,
      ...sms,
      freeSmsLimited: false,
      canSendSms: true,
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
      trialDaysLeft: 0,
      ...sms,
      canSendSms: false,
      smsMessage: TRIAL_EXPIRED_MESSAGE,
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
      trialDaysLeft: 0,
      ...sms,
      freeSmsLimited: false,
      canSendSms: true,
    };
  }

  const end = trialEnd(sub);
  if (sub.status === "trialing" && end > now) {
    const outOfSms = quota.limited && quota.remaining <= 0;
    return {
      allowed: true,
      isSuperAdmin: false,
      state: "trial",
      trialEndsAt: new Date(end).toISOString(),
      periodEnd: sub.current_period_end,
      remainingMs: end - now,
      trialDaysLeft: daysLeft(end - now),
      ...sms,
      canSendSms: !outOfSms,
      ...(outOfSms ? { smsMessage: SMS_LIMIT_MESSAGE } : {}),
    };
  }

  return {
    allowed: false,
    isSuperAdmin: false,
    state: "expired",
    trialEndsAt: new Date(end).toISOString(),
    periodEnd: sub.current_period_end,
    remainingMs: 0,
    trialDaysLeft: 0,
    ...sms,
    canSendSms: false,
    smsMessage: TRIAL_EXPIRED_MESSAGE,
    message: TRIAL_EXPIRED_MESSAGE,
  };
}

const SELECT =
  "plan, status, trial_started_at, trial_ends_at, current_period_start, current_period_end, created_at";

/** 지금 로그인한 계정의 이용 권한과 무료 문자 사용량을 서버에서 읽습니다 */
export async function loadEntitlement(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Entitlement> {
  // 권한·사용량 확인 함수는 서버에서만 실행합니다(브라우저에서는 부를 수 없습니다).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [subRes, adminRes, quotaRes] = await Promise.all([
    supabase.from("subscriptions").select(SELECT).eq("user_id", userId).maybeSingle(),
    supabaseAdmin.rpc("is_super_admin", { _user_id: userId }),
    supabaseAdmin.rpc("sms_quota", { _user_id: userId }),
  ]);
  const q = (quotaRes.data ?? null) as Record<string, unknown> | null;
  const used = Number(q?.["free_sms_used"] ?? 0);
  const limit = Number(q?.["free_sms_limit"] ?? FREE_SMS_LIMIT);
  const quota: SmsQuota = {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    limited: q?.["limited"] !== false,
  };
  return computeEntitlement(
    (subRes.data as SubRow | null) ?? null,
    adminRes.data === true,
    Date.now(),
    quota,
  );
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
