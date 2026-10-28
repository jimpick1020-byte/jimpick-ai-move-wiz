/**
 * 알림이 저장되면 데이터베이스가 이 주소를 불러 휴대폰 푸시를 보냅니다.
 * 서버 전용 비밀값(x-reminder-secret)이 맞지 않으면 아무 일도 하지 않습니다.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const given = String(request.headers.get("x-reminder-secret") ?? "").trim();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.from("app_cron_secrets").select("secret").eq("name", "move_reminders").maybeSingle();
        const dbSecret = String((data as { secret?: string } | null)?.secret ?? "").trim();
        if (!given || !dbSecret || given !== dbSecret) {
          return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        let id: string | undefined;
        try {
          const body = (await request.json()) as { id?: unknown };
          if (typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id)) id = body.id;
        } catch { /* 본문이 없으면 밀린 알림 전체를 보냅니다 */ }
        try {
          const { dispatchOwnerNotifications } = await import("@/lib/push.server");
          const result = await dispatchOwnerNotifications(id);
          return new Response(JSON.stringify({ ok: true, ...result }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
        } catch (cause) {
          console.error("[push-dispatch]", cause);
          return new Response(JSON.stringify({ ok: false, error: cause instanceof Error ? cause.message : "failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
