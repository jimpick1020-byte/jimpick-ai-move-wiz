/**
 * 이사 전날 안내 문자 발송 — 크론(pg_cron)이 10분마다 부릅니다.
 *
 * 앱이 꺼져 있어도 서버가 스스로 보냅니다.
 * 비밀값(x-reminder-secret)이 맞지 않으면 아무 일도 하지 않습니다.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/send-move-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = String(process.env["JIMPICK_PROXY_SECRET"] ?? "").trim();
        const given = String(request.headers.get("x-reminder-secret") ?? "").trim();
        if (!expected || given !== expected) {
          return new Response(JSON.stringify({ ok: false, error: "권한이 없습니다." }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { runDueMoveReminders } = await import("@/lib/reminder-send.server");
        const result = await runDueMoveReminders(20);
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
