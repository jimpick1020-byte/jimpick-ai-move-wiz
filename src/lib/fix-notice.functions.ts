/**
 * 수정 통보 설정·기록 — 서비스 최고관리자만 쓸 수 있습니다.
 *
 * 오류가 났을 때는 알리지 않고, 고쳐진 뒤에 문자 한 통으로 통보합니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertSuperAdmin(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("is_super_admin", { _user_id: userId });
  if (data !== true) throw new Error("Forbidden: 서비스 관리자만 사용할 수 있습니다");
}

export interface FixNoticeSettings {
  /** 통보받을 연락처 (없으면 빈 값) */
  phone: string;
  enabled: boolean;
  updatedAt: string | null;
}

export interface FixNoticeRow {
  id: string;
  title: string;
  summary: string;
  toMasked: string | null;
  status: string;
  sentAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  source: string;
  createdAt: string;
}

const phoneOk = (v: string) => /^01\d{8,9}$/.test(v.replace(/\D/g, ""));

/** 통보 설정과 최근 통보 기록을 함께 읽습니다 */
export const getFixNoticeState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ settings: FixNoticeSettings; notices: FixNoticeRow[] }> => {
      await assertSuperAdmin(context.userId);
      const { data: s } = await context.supabase
        .from("service_ops_settings")
        .select("notice_phone, notify_enabled, updated_at")
        .eq("id", true)
        .maybeSingle();
      const { data: rows, error } = await context.supabase
        .from("service_fix_notices")
        .select(
          "id, title, summary, to_masked, status, sent_at, failed_at, error_message, source, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return {
        settings: {
          phone: s?.notice_phone ?? "",
          enabled: s?.notify_enabled !== false,
          updatedAt: s?.updated_at ?? null,
        },
        notices: (rows ?? []).map((r) => ({
          id: r.id,
          title: r.title,
          summary: r.summary,
          toMasked: r.to_masked,
          status: r.status,
          sentAt: r.sent_at,
          failedAt: r.failed_at,
          errorMessage: r.error_message,
          source: r.source,
          createdAt: r.created_at,
        })),
      };
    },
  );

/** 통보받을 연락처와 켜기/끄기를 저장합니다 */
export const saveFixNoticeSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ phone: z.string().max(20), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    await assertSuperAdmin(context.userId);
    const phone = data.phone.replace(/\D/g, "");
    if (phone && !phoneOk(phone)) {
      return { ok: false, error: "휴대전화 번호 형식이 올바르지 않습니다." };
    }
    const { error } = await context.supabase
      .from("service_ops_settings")
      .update({
        notice_phone: phone || null,
        notify_enabled: data.enabled,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .eq("id", true);
    if (error) {
      console.error("[saveFixNoticeSettings]", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  });

/** 통보 문자를 직접 한 통 보냅니다 (연결 확인·직접 통보용) */
export const sendFixNoticeNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().min(1).max(60),
        summary: z.string().min(1).max(300),
        errorLogId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(
    async ({ data, context }): Promise<{ ok: boolean; error?: string; recipientLast4?: string }> => {
      await assertSuperAdmin(context.userId);
      const { sendFixNoticeSms } = await import("./fix-notice.server");
      const r = await sendFixNoticeSms({
        title: data.title,
        summary: data.summary,
        errorLogId: data.errorLogId ?? null,
        source: "manual",
      });
      if (!r.ok) return { ok: false, error: r.error ?? "통보를 보내지 못했습니다." };
      return { ok: true, recipientLast4: r.recipientLast4 };
    },
  );
