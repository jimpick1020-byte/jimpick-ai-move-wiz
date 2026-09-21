/**
 * 이사 전날 안내 문자의 실제 발송 결과 확인 — 크론이 10분마다 부릅니다.
 *
 * 접수만 된 건의 통신사 전달 결과를 알리고에 물어보고 상태를 갱신합니다.
 * 비밀값(x-reminder-secret)이 맞지 않으면 아무 일도 하지 않습니다.
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

export const Route = createFileRoute("/api/public/hooks/check-move-reminder-results")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await allowed(request))) {
          return new Response(JSON.stringify({ ok: false, error: "권한이 없습니다." }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { checkReminderResults } = await import("@/lib/reminder-send.server");
        const result = await checkReminderResults(30);
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
