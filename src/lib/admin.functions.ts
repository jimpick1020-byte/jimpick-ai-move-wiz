/**
 * 최고관리자(super_admin) 전용 기능.
 *
 * - 관리자 여부는 반드시 서버에서 확인합니다(데이터베이스 함수 is_super_admin).
 * - 화면에서 버튼을 숨기는 것만으로 막지 않습니다. 관리자가 아니면 서버가 거부합니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
  approvedSmsSender: string | null;
  smsSenderApprovedAt: string | null;
}

/** 최고관리자인지 서버에서 확인합니다 (확인 함수는 서버에서만 실행됩니다) */
export const amISuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ superAdmin: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    return { superAdmin: data === true };
  });

/** 업체 계정 목록 — 최고관리자만 볼 수 있습니다 */
export const listCompanyAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanyAccount[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (isAdmin !== true) throw new Error("Forbidden: 관리자만 사용할 수 있습니다");


    const [usersRes, profilesRes, subsRes, paymentsRes, deliveriesRes, rolesRes, sendersRes] =
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
        supabaseAdmin.from("company_sms_senders").select("company_id, sender_number, approved_at"),
      ]);

    if (sendersRes.error) throw new Error("승인 발신번호를 읽지 못했습니다.");

    const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
    const senders = new Map((sendersRes.data ?? []).map((s) => [s.company_id, s]));
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
      if (["success", "sent", "accepted", "delivered"].includes(d.status)) cur.sent += 1;
      sms.set(d.user_id, cur);
    }

    const now = Date.now();
    // 최근 가입 업체가 먼저 보이도록 가입일 내림차순으로 정렬합니다.
    const users = (usersRes.data?.users ?? [])
      .slice()
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

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
        approvedSmsSender: senders.get(u.id)?.sender_number ?? null,
        smsSenderApprovedAt: senders.get(u.id)?.approved_at ?? null,
      };
    });
  });

/** 승인 내역은 최고관리자가 알리고에서 직접 확인한 뒤에만 저장합니다. 업체 계정은 쓰기 권한이 없습니다. */
export const approveCompanySmsSender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    companyId: z.string().uuid(),
    senderNumber: z.string().regex(/^0[0-9]{8,10}$/),
    approvalConfirmed: z.literal(true),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ senderNumber: string; approvedAt: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (roleError || isAdmin !== true) throw new Error("최고관리자만 승인 발신번호를 등록할 수 있습니다.");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles").select("id, company_name").eq("id", data.companyId).maybeSingle();
    if (profileError || !profile?.company_name?.trim()) throw new Error("사업자 상호가 등록된 업체만 발신번호를 연결할 수 있습니다.");

    const approvedAt = new Date().toISOString();
    const { error } = await supabaseAdmin.from("company_sms_senders").upsert({
      company_id: data.companyId,
      sender_number: data.senderNumber,
      approved_at: approvedAt,
      approved_by: context.userId,
      provider: "aligo",
    }, { onConflict: "company_id" });
    if (error) throw new Error("승인 발신번호 저장에 실패했습니다.");
    return { senderNumber: data.senderNumber, approvedAt };
  });

/**
 * 업체 계정 삭제 — 최고관리자만 사용할 수 있습니다.
 * - 구독 이용 중(active/past_due)인 업체는 삭제하지 않습니다.
 * - 최고관리자 계정은 삭제하지 않습니다.
 * - 서버에 남은 해당 업체 데이터와 로그인 계정이 함께 삭제됩니다.
 */
export const deleteCompanyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    (d as { userId?: string })?.userId
      ? (d as { userId: string })
      : (() => {
          throw new Error("userId가 필요합니다");
        })(),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (isAdmin !== true) throw new Error("Forbidden: 관리자만 사용할 수 있습니다");

    const targetId = data.userId;
    if (targetId === context.userId) {
      throw new Error("내 계정은 여기서 삭제할 수 없습니다");
    }

    // 최고관리자 계정은 삭제 금지
    const { data: targetIsAdmin } = await supabaseAdmin.rpc("is_super_admin", {
      _user_id: targetId,
    });
    if (targetIsAdmin === true) {
      throw new Error("관리자 계정은 삭제할 수 없습니다");
    }

    // 구독으로 이용 중인 업체는 삭제 금지 (체험 중이거나 체험이 끝난 업체만 삭제 가능)
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("user_id", targetId)
      .maybeSingle();
    if (sub && (sub.status === "active" || sub.status === "past_due")) {
      throw new Error("구독 이용 중인 업체는 삭제할 수 없습니다. 먼저 구독이 해지되어야 합니다.");
    }

    // 문자 발송 기록은 계정 삭제를 막지 않도록 먼저 정리합니다.
    const { error: delErr } = await supabaseAdmin
      .from("estimate_deliveries")
      .delete()
      .eq("user_id", targetId);
    if (delErr) throw new Error(delErr.message);

    // 로그인 계정을 삭제하면 나머지 데이터(프로필·구독·견적·결제 등)도 함께 삭제됩니다.
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(targetId);
    if (authErr) throw new Error(authErr.message);
    return { ok: true };
  });
