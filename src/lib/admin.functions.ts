/**
 * 최고관리자(super_admin) 전용 기능.
 *
 * - 관리자 여부는 반드시 서버에서 확인합니다(데이터베이스 함수 is_super_admin).
 * - 화면에서 버튼을 숨기는 것만으로 막지 않습니다. 관리자가 아니면 서버가 거부합니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CompanyAccount {
  userId: string;
  email: string | null;
  companyName: string | null;
  ownerName: string | null;
  phone: string | null;
  /** 가입일 */
  joinedAt: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  /** trialing | active | past_due | canceled | expired */
  subscriptionStatus: string;
  plan: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** 마지막 결제 상태 (없으면 null) */
  paymentStatus: string | null;
  lastPaidAt: string | null;
  /** 문자 발송 건수 (성공/전체) */
  smsSent: number;
  smsTotal: number;
  /** 계정 사용 가능 여부 */
  active: boolean;
  role: string;
}

/** 최고관리자인지 서버에서 확인합니다 */
export const amISuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ superAdmin: boolean }> => {
    const { data } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    return { superAdmin: data === true };
  });

/** 업체 계정 목록 — 최고관리자만 볼 수 있습니다 */
export const listCompanyAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanyAccount[]> => {
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (isAdmin !== true) throw new Error("Forbidden: 관리자만 사용할 수 있습니다");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [usersRes, profilesRes, subsRes, paymentsRes, deliveriesRes, rolesRes] =
      await Promise.all([
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
        supabaseAdmin.from("profiles").select("id, company_name, owner_name, phone, created_at"),
        supabaseAdmin
          .from("subscriptions")
          .select(
            "user_id, plan, status, trial_started_at, trial_ends_at, current_period_end, cancel_at_period_end",
          ),
        supabaseAdmin
          .from("payments")
          .select("user_id, status, paid_at")
          .order("paid_at", { ascending: false }),
        supabaseAdmin.from("estimate_deliveries").select("user_id, status"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
      ]);

    const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
    const subs = new Map((subsRes.data ?? []).map((s) => [s.user_id, s]));
    const roles = new Map((rolesRes.data ?? []).map((r) => [r.user_id, r.role as string]));
    const firstPayment = new Map<string, { status: string; paid_at: string }>();
    for (const p of paymentsRes.data ?? []) {
      if (!firstPayment.has(p.user_id)) {
        firstPayment.set(p.user_id, { status: p.status, paid_at: p.paid_at });
      }
    }
    const sms = new Map<string, { sent: number; total: number }>();
    for (const d of deliveriesRes.data ?? []) {
      if (!d.user_id) continue;
      const cur = sms.get(d.user_id) ?? { sent: 0, total: 0 };
      cur.total += 1;
      if (d.status === "success" || d.status === "sent") cur.sent += 1;
      sms.set(d.user_id, cur);
    }

    const now = Date.now();
    const users = usersRes.data?.users ?? [];

    return users.map((u) => {
      const profile = profiles.get(u.id);
      const sub = subs.get(u.id);
      const pay = firstPayment.get(u.id);
      const usage = sms.get(u.id) ?? { sent: 0, total: 0 };

      // 저장된 상태를 그대로 쓰고, 체험이 이미 지난 무료 계정만 expired 로 보여 줍니다.
      let status = sub?.status ?? "expired";
      const trialEnd = sub?.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : null;
      if (status === "trialing" && trialEnd !== null && trialEnd <= now) status = "expired";

      const banned = (u as { banned_until?: string | null }).banned_until ?? null;

      return {
        userId: u.id,
        email: u.email ?? null,
        companyName: profile?.company_name ?? null,
        ownerName: profile?.owner_name ?? null,
        phone: profile?.phone ?? null,
        joinedAt: u.created_at ?? profile?.created_at ?? null,
        trialStartedAt: sub?.trial_started_at ?? null,
        trialEndsAt: sub?.trial_ends_at ?? null,
        subscriptionStatus: status,
        plan: sub?.plan ?? null,
        periodEnd: sub?.current_period_end ?? null,
        cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
        paymentStatus: pay?.status ?? null,
        lastPaidAt: pay?.paid_at ?? null,
        smsSent: usage.sent,
        smsTotal: usage.total,
        active: !banned || new Date(banned).getTime() <= now,
        role: roles.get(u.id) ?? "subscriber",
      };
    });
  });
