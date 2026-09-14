/**
 * 이사 전날 안내 문자 — 관리자 화면에서 상태를 보고, 실패한 건을 다시 보냅니다.
 *
 * 실제 발송은 크론이 부르는 send-move-reminders 가 합니다.
 * 여기서는 상태를 읽고, 실패한 예약을 「발송 예정」으로 되돌리는 일만 합니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ReminderStatus = "scheduled" | "sending" | "success" | "failed" | "canceled";

export const REMINDER_STATUS_LABEL: Record<ReminderStatus, string> = {
  scheduled: "발송 예정",
  sending: "발송 중",
  success: "발송 성공",
  failed: "발송 실패",
  canceled: "예약 취소",
};

export interface MoveReminderRow {
  id: string;
  estimateId: string;
  customerName: string;
  moveDate: string;
  startTime: string | null;
  scheduledAt: string;
  sentAt: string | null;
  status: ReminderStatus;
  aligoMessageId: string | null;
  errorReason: string | null;
  retryCount: number;
}

/** 내 견적들의 전날 안내 문자 예약 상태 */
export const listMoveReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ estimateId: z.string().max(80).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; rows: MoveReminderRow[] }> => {
    let q = context.supabase
      .from("move_reminders")
      .select(
        "id, estimate_id, customer_name, move_date, start_time, scheduled_at, sent_at, status, aligo_message_id, error_reason, retry_count",
      )
      .eq("company_id", context.userId);
    if (data?.estimateId) q = q.eq("estimate_id", data.estimateId);
    const { data: rows, error } = await q.order("scheduled_at", { ascending: false }).limit(200);
    if (error || !rows) {
      if (error) console.error("[listMoveReminders]", error.message);
      return { ok: false, rows: [] };
    }
    return {
      ok: true,
      rows: rows.map((raw) => {
        const r = raw as Record<string, unknown>;
        return {
          id: String(r["id"]),
          estimateId: String(r["estimate_id"] ?? ""),
          customerName: String(r["customer_name"] ?? ""),
          moveDate: String(r["move_date"] ?? ""),
          startTime: (r["start_time"] as string | null) ?? null,
          scheduledAt: String(r["scheduled_at"] ?? ""),
          sentAt: (r["sent_at"] as string | null) ?? null,
          status: String(r["status"] ?? "scheduled") as ReminderStatus,
          aligoMessageId: (r["aligo_message_id"] as string | null) ?? null,
          errorReason: (r["error_reason"] as string | null) ?? null,
          retryCount: Number(r["retry_count"] ?? 0) || 0,
        };
      }),
    };
  });

/** 실패한 안내 문자를 다시 보냅니다 (「발송 예정」으로 되돌립니다) */
export const retryMoveReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { data: row, error } = await context.supabase
      .from("move_reminders")
      .select("id, status")
      .eq("id", data.id)
      .eq("company_id", context.userId)
      .maybeSingle();
    if (error || !row) return { ok: false, error: "안내 문자 예약을 찾지 못했습니다." };
    const status = String((row as { status?: string }).status ?? "");
    if (status === "success") return { ok: false, error: "이미 발송된 문자입니다." };
    if (status === "sending") return { ok: false, error: "지금 발송 중입니다. 잠시 후 확인해 주세요." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin
      .from("move_reminders")
      .update({
        status: "scheduled",
        error_reason: null,
        scheduled_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id)
      .eq("company_id", context.userId);
    if (upErr) {
      console.error("[retryMoveReminder]", upErr.message);
      return { ok: false, error: "다시 발송하도록 바꾸지 못했습니다." };
    }
    return { ok: true };
  });
