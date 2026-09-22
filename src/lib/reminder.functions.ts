/**
 * 이사 전날 안내 문자 — 화면에서 상태를 보고, 실패한 건을 다시 보냅니다.
 *
 * 실제 발송은 크론이 부르는 send-move-reminders 가 하고,
 * 통신사 전달 결과는 check-move-reminder-results 가 확인합니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ReminderStatus =
  | "scheduled"
  | "processing"
  | "sending"
  | "accepted"
  | "delivered"
  | "success"
  | "failed"
  | "canceled"
  | "cancelled"
  | "unknown";

export const REMINDER_STATUS_LABEL: Record<string, string> = {
  scheduled: "전날 문자 예정",
  processing: "발송 처리 중",
  sending: "발송 처리 중",
  accepted: "문자업체 접수 완료",
  delivered: "통신사 전달 완료",
  success: "문자업체 접수 완료",
  failed: "발송 실패",
  canceled: "발송 취소",
  cancelled: "발송 취소",
  unknown: "결과 확인 필요",
};

export interface MoveReminderRow {
  id: string;
  estimateId: string;
  companyId: string;
  customerName: string;
  moveDate: string;
  startTime: string | null;
  scheduledAt: string;
  scheduledDate: string;
  requestedAt: string | null;
  acceptedAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  sentAt: string | null;
  lastCheckedAt: string | null;
  customerViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  status: ReminderStatus;
  messageType: string | null;
  toMasked: string | null;
  providerMessageId: string | null;
  errorCode: string | null;
  errorReason: string | null;
  missedReason: string | null;
  retryCount: number;
  /** 계약이 삭제된 건인지 (기록은 보존합니다) */
  contractDeleted: boolean;
  /** 관리자 화면에서만 채웁니다 */
  companyName?: string | null;
}

const SELECT_COLS =
  "id, estimate_id, company_id, customer_name, move_date, start_time, scheduled_at, scheduled_date, requested_at, accepted_at, delivered_at, failed_at, sent_at, last_checked_at, customer_viewed_at, last_viewed_at, view_count, status, message_type, to_masked, provider_message_id, error_code, error_reason, missed_reason, retry_count";

function mapRow(raw: unknown): MoveReminderRow {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r["id"]),
    estimateId: String(r["estimate_id"] ?? ""),
    companyId: String(r["company_id"] ?? ""),
    customerName: String(r["customer_name"] ?? ""),
    moveDate: String(r["move_date"] ?? ""),
    startTime: (r["start_time"] as string | null) ?? null,
    scheduledAt: String(r["scheduled_at"] ?? ""),
    scheduledDate: String(r["scheduled_date"] ?? ""),
    requestedAt: (r["requested_at"] as string | null) ?? null,
    acceptedAt: (r["accepted_at"] as string | null) ?? null,
    deliveredAt: (r["delivered_at"] as string | null) ?? null,
    failedAt: (r["failed_at"] as string | null) ?? null,
    sentAt: (r["sent_at"] as string | null) ?? null,
    lastCheckedAt: (r["last_checked_at"] as string | null) ?? null,
    customerViewedAt: (r["customer_viewed_at"] as string | null) ?? null,
    lastViewedAt: (r["last_viewed_at"] as string | null) ?? null,
    viewCount: Number(r["view_count"] ?? 0) || 0,
    status: String(r["status"] ?? "scheduled") as ReminderStatus,
    messageType: (r["message_type"] as string | null) ?? null,
    toMasked: (r["to_masked"] as string | null) ?? null,
    providerMessageId: (r["provider_message_id"] as string | null) ?? null,
    errorCode: (r["error_code"] as string | null) ?? null,
    errorReason: (r["error_reason"] as string | null) ?? null,
    missedReason: (r["missed_reason"] as string | null) ?? null,
    retryCount: Number(r["retry_count"] ?? 0) || 0,
    contractDeleted: false,
  };
}

/** 내 업체의 전날 안내 문자 상태 */
export const listMoveReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ estimateId: z.string().max(80).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; rows: MoveReminderRow[] }> => {
    let q = context.supabase
      .from("move_reminders")
      .select(SELECT_COLS)
      .eq("company_id", context.userId);
    if (data?.estimateId) q = q.eq("estimate_id", data.estimateId);
    const { data: rows, error } = await q.order("scheduled_at", { ascending: false }).limit(300);
    if (error || !rows) {
      if (error) console.error("[listMoveReminders]", error.message);
      return { ok: false, rows: [] };
    }
    return { ok: true, rows: rows.map(mapRow) };
  });

/**
 * 관리자·업체 「전날 문자 현황」.
 * 최고관리자는 모든 업체, 일반 사장님은 자기 업체만 보입니다(RLS 로도 분리됩니다).
 */
export const listReminderDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        filter: z
          .enum(["all", "today", "processing", "delivered", "viewed", "failed", "unknown"])
          .default("all"),
        search: z.string().max(60).optional(),
        moveDate: z.string().max(10).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      ok: boolean;
      isAdmin: boolean;
      rows: MoveReminderRow[];
      lastRuns: { job: string; ranAt: string; picked: number; sent: number; failed: number; note: string | null }[];
    }> => {
      // 관리자 여부는 서버 전용 계정으로 확인합니다 (로그인 계정 권한과 무관하게 항상 동작)
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: isAdminRaw } = await supabaseAdmin.rpc("is_super_admin", {
        _user_id: context.userId,
      });
      const isAdmin = isAdminRaw === true;

      let q = context.supabase.from("move_reminders").select(SELECT_COLS);
      if (!isAdmin) q = q.eq("company_id", context.userId);

      const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (data.filter === "today") q = q.eq("scheduled_date", kstToday);
      else if (data.filter === "processing") q = q.in("status", ["processing", "sending"]);
      else if (data.filter === "delivered") q = q.eq("status", "delivered");
      else if (data.filter === "failed") q = q.eq("status", "failed");
      else if (data.filter === "unknown") q = q.eq("status", "unknown");
      else if (data.filter === "viewed") q = q.not("customer_viewed_at", "is", null);

      if (data.moveDate) q = q.eq("move_date", data.moveDate);
      const s = (data.search ?? "").trim();
      if (s) {
        const digitsOnly = s.replace(/[^0-9]/g, "");
        if (digitsOnly.length >= 4) {
          q = q.or(`customer_name.ilike.%${s}%,to_masked.ilike.%${digitsOnly.slice(-4)}%`);
        } else {
          q = q.ilike("customer_name", `%${s}%`);
        }
      }

      const { data: rows, error } = await q.order("scheduled_at", { ascending: false }).limit(300);
      if (error || !rows) {
        if (error) console.error("[listReminderDashboard]", error.message);
        return { ok: false, isAdmin, rows: [], lastRuns: [] };
      }

      const mapped = rows.map(mapRow);

      // 삭제된 계약 표시 + 관리자에게는 업체 이름도 보여 줍니다
      const ids = [...new Set(mapped.map((r) => r.estimateId))].slice(0, 300);
      if (ids.length) {
        const { data: terms } = await context.supabase
          .from("estimate_terms")
          .select("estimate_id, deleted_at")
          .in("estimate_id", ids);
        const deleted = new Set(
          ((terms ?? []) as { estimate_id: string; deleted_at: string | null }[])
            .filter((t) => !!t.deleted_at)
            .map((t) => t.estimate_id),
        );
        for (const r of mapped) if (deleted.has(r.estimateId)) r.contractDeleted = true;
      }
      if (isAdmin) {
        const companyIds = [...new Set(mapped.map((r) => r.companyId))].slice(0, 200);
        if (companyIds.length) {
          const { data: profiles } = await context.supabase
            .from("profiles")
            .select("id, company_name")
            .in("id", companyIds);
          const byId = new Map(
            ((profiles ?? []) as { id: string; company_name: string | null }[]).map((p) => [
              p.id,
              p.company_name,
            ]),
          );
          for (const r of mapped) r.companyName = byId.get(r.companyId) ?? null;
        }
      }

      let lastRuns: {
        job: string;
        ranAt: string;
        picked: number;
        sent: number;
        failed: number;
        note: string | null;
      }[] = [];
      if (isAdmin) {
        const { data: runs } = await context.supabase
          .from("reminder_job_runs")
          .select("job, ran_at, picked, sent, failed, note")
          .order("ran_at", { ascending: false })
          .limit(10);
        lastRuns = ((runs ?? []) as Record<string, unknown>[]).map((r) => ({
          job: String(r["job"] ?? ""),
          ranAt: String(r["ran_at"] ?? ""),
          picked: Number(r["picked"] ?? 0) || 0,
          sent: Number(r["sent"] ?? 0) || 0,
          failed: Number(r["failed"] ?? 0) || 0,
          note: (r["note"] as string | null) ?? null,
        }));
      }

      return { ok: true, isAdmin, rows: mapped, lastRuns };
    },
  );

/** 실패(또는 확인 필요)한 안내 문자를 지금 다시 보냅니다 */
export const retryMoveReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), confirmResend: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { data: row, error } = await context.supabase
      .from("move_reminders")
      .select("id, status, company_id")
      .eq("id", data.id)
      .eq("company_id", context.userId)
      .maybeSingle();
    if (error || !row) return { ok: false, error: "안내 문자 예약을 찾지 못했습니다." };
    const status = String((row as { status?: string }).status ?? "");
    if (status === "processing" || status === "sending") {
      return { ok: false, error: "지금 발송 중입니다. 잠시 후 확인해 주세요." };
    }
    if (
      ["accepted", "delivered", "success"].includes(status) &&
      data.confirmResend !== true
    ) {
      return { ok: false, error: "이미 발송된 문자입니다. 다시 보내려면 확인이 필요합니다." };
    }

    const { resendReminderNow } = await import("./reminder-send.server");
    return resendReminderNow(data.id, context.userId);
  });

/**
 * 고객이 문자 속 보안 링크를 열었을 때 확인 시각을 남깁니다.
 * 토큰이 맞아야만 기록되고, 최초 확인 시각은 지우지 않습니다.
 */
export const markReminderViewed = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(16).max(80) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: out } = await (
      supabaseAdmin as unknown as {
        rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: { ok?: boolean } | null }>;
      }
    ).rpc("mark_reminder_viewed", { _token: data.token });
    return { ok: out?.ok === true };
  });
