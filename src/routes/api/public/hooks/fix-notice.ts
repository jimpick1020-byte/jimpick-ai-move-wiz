/**
 * 수정 완료 통보 — 문제를 고친 뒤 관리자 연락처로 문자 한 통을 보냅니다.
 *
 * 오류가 났을 때 관리자를 부르지 않고, 고쳐진 뒤에만 알립니다.
 * 비밀값(x-fix-notice-secret)이 맞지 않으면 아무 일도 하지 않습니다.
 */
import { createFileRoute } from "@tanstack/react-router";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/public/hooks/fix-notice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const given = String(request.headers.get("x-fix-notice-secret") ?? "").trim();
        if (!given) return json({ ok: false, error: "권한이 없습니다." }, 401);

        const envSecret = String(process.env["JIMPICK_PROXY_SECRET"] ?? "").trim();
        let allowed = !!envSecret && given === envSecret;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (!allowed) {
          const { data } = await supabaseAdmin
            .from("app_cron_secrets")
            .select("secret")
            .eq("name", "fix_notice")
            .maybeSingle();
          const dbSecret = String((data as { secret?: string } | null)?.secret ?? "").trim();
          allowed = !!dbSecret && given === dbSecret;
        }
        if (!allowed) return json({ ok: false, error: "권한이 없습니다." }, 401);

        let body: { title?: string; summary?: string; error_log_id?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ ok: false, error: "요청 내용을 읽지 못했습니다." }, 400);
        }
        const title = String(body.title ?? "").trim().slice(0, 60);
        const summary = String(body.summary ?? "").trim().slice(0, 300);
        if (!title || !summary) {
          return json({ ok: false, error: "통보할 제목과 내용이 필요합니다." }, 400);
        }
        const errorLogId = String(body.error_log_id ?? "").trim() || null;

        // 고친 오류 기록은 해결됨으로 표시합니다 (기록 자체는 지우지 않습니다)
        if (errorLogId) {
          const { error } = await supabaseAdmin
            .from("error_logs")
            .update({
              resolved: true,
              resolved_at: new Date().toISOString(),
              recovery: "auto_fixed",
            })
            .eq("id", errorLogId);
          if (error) console.error("[fix-notice] 해결 표시 실패", error.message);
        }

        const { sendFixNoticeSms } = await import("@/lib/fix-notice.server");
        const r = await sendFixNoticeSms({ title, summary, errorLogId, source: "auto" });
        return json(r, r.ok ? 200 : 502);
      },
    },
  },
});
