/**
 * 오류 기록 — 화면에서 문제가 생겼을 때 무슨 화면에서 언제 어떤 오류가 났는지만 남깁니다.
 *
 * 개인정보 보호 규칙:
 *  - 고객 이름·전화번호·주소·카드번호·이메일·인증키는 저장하기 전에 지웁니다(마스킹).
 *  - 견적 내용이나 결제 정보 원본은 저장하지 않습니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** 로그에 남기면 안 되는 값들을 지웁니다 */
export function maskSensitive(input: string): string {
  return (input || "")
    .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, "[카드번호]")
    .replace(/\b01\d[- ]?\d{3,4}[- ]?\d{4}\b/g, "[전화번호]")
    .replace(/\b\d{2,3}-\d{3,4}-\d{4}\b/g, "[전화번호]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[이메일]")
    .replace(/\b(sb_[A-Za-z0-9_-]{6,}|eyJ[A-Za-z0-9._-]{10,}|test_[A-Za-z0-9_]{6,}|live_[A-Za-z0-9_]{6,})\b/g, "[비밀키]")
    .replace(/(access[_-]?token|api[_-]?key|secret|password|billingKey|customerKey|authorization)"?\s*[:=]\s*"?[^\s",}]+/gi, "$1=[숨김]")
    .slice(0, 1000);
}

/** 최고관리자인지 서버에서 확인합니다 (화면에서 숨기는 것과 별개로 서버가 막습니다) */
async function assertSuperAdmin(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("is_super_admin", { _user_id: userId });
  if (data !== true) throw new Error("Forbidden: 서비스 관리자만 사용할 수 있습니다");
}

export interface ErrorLogRow {
  id: string;
  /** 오류가 난 업체 이름 (최고관리자 화면 표시용) */
  companyName: string | null;
  screen: string;
  kind: string;
  message: string;
  detail: string | null;
  recovery: string;
  attempts: number;
  resolved: boolean;
  resolvedAt: string | null;
  occurredAt: string;
}

export const logAppError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        screen: z.string().min(1).max(80),
        kind: z.string().min(1).max(40).default("render"),
        message: z.string().min(1).max(2000),
        detail: z.string().max(4000).optional(),
        recovery: z.string().max(40).default("none"),
        attempts: z.number().int().min(0).max(20).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; id?: string }> => {
    const { data: row, error } = await context.supabase
      .from("error_logs")
      .insert({
        user_id: context.userId,
        screen: data.screen.slice(0, 80),
        kind: data.kind,
        message: maskSensitive(data.message),
        detail: data.detail ? maskSensitive(data.detail) : null,
        recovery: data.recovery,
        attempts: data.attempts,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[logAppError]", error.message);
      return { ok: false };
    }
    return { ok: true, id: row?.id };
  });

/** 오류 기록 조회 — 서비스 최고관리자만 볼 수 있습니다 (서버에서 권한을 확인합니다) */
export const listAppErrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ErrorLogRow[]> => {
    await assertSuperAdmin(context.userId);
    const { data, error } = await context.supabase
      .from("error_logs")
      .select("id, user_id, screen, kind, message, detail, recovery, attempts, resolved, resolved_at, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const names = new Map<string, string | null>();
    if (rows.length) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("id, company_name")
        .in("id", Array.from(new Set(rows.map((r) => r.user_id))));
      for (const p of profiles ?? []) names.set(p.id, p.company_name);
    }
    return rows.map((r) => ({
      id: r.id,
      companyName: names.get(r.user_id) ?? null,
      screen: r.screen,
      kind: r.kind,
      message: r.message,
      detail: r.detail,
      recovery: r.recovery,
      attempts: r.attempts,
      resolved: r.resolved,
      resolvedAt: r.resolved_at,
      occurredAt: r.occurred_at,
    }));
  });

/** 오류를 "해결됨"으로 표시합니다 (서비스 최고관리자만) */
export const resolveAppError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), recovery: z.string().max(40).default("manual") }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    await assertSuperAdmin(context.userId);
    const { error } = await context.supabase
      .from("error_logs")
      .update({ resolved: true, resolved_at: new Date().toISOString(), recovery: data.recovery })
      .eq("id", data.id);
    if (error) {
      console.error("[resolveAppError]", error.message);
      return { ok: false };
    }
    return { ok: true };
  });
