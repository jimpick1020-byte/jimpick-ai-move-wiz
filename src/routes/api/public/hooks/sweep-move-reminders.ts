/**
 * 누락 점검 — 크론이 한국시간 18:10 에 하루 한 번 부릅니다.
 *
 * 내일 이사 예정인 확정 계약 중 전날 안내 문자가 빠진 건을 찾아
 * 한 번만 다시 처리하고, 실행 기록을 남깁니다.
 */
import { createFileRoute } from "@tanstack/react-router";

async function allowed(request: Request): Promise<boolean> {
  const given = String(request.headers.get("x-reminder-secret") ?? "").trim();
  if (!given) return false;
  const envSecret = String(process.env["JIMPICK_PROXY_SECRET"] ?? "").trim();
  if (envSecret && given === envSecret) return true;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_cron_secrets")
    .select("secret")
    .eq("name", "move_reminders")
    .maybeSingle();
  const dbSecret = String((data as { secret?: string } | null)?.secret ?? "").trim();
  return !!dbSecret && given === dbSecret;
}

export const Route = createFileRoute("/api/public/hooks/sweep-move-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await allowed(request))) {
          return new Response(JSON.stringify({ ok: false, error: "권한이 없습니다." }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { sweepMissedReminders } = await import("@/lib/reminder-send.server");
        const result = await sweepMissedReminders();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
