/**
 * 은행 입금 문자 자동 전달 수신 주소.
 *
 * 휴대폰의 문자 전달 앱이 은행 문자를 이 주소로 보내면 업체별로 저장·매칭합니다.
 * 업체별 비밀 열쇠(k 또는 x-jimpick-key)가 맞지 않으면 아무것도 저장하지 않습니다.
 * 같은 이벤트 ID·같은 원문이 다시 오면 중복으로 처리합니다.
 */
import { createFileRoute } from "@tanstack/react-router";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/public/hooks/bank-sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const key = String(request.headers.get("x-jimpick-key") ?? url.searchParams.get("k") ?? "").trim();
        if (!/^[0-9a-f]{48}$/.test(key)) {
          console.warn("[bank-sms] rejected: key format");
          return json({ ok: false, error: "권한이 없습니다." }, 401);
        }
        const { sha256Hex, ingestBankSms } = await import("@/lib/bank-sms.server");
        const { extractForwardedText } = await import("@/lib/bank-sms-match");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: owner } = await supabaseAdmin.from("bank_sms_ingest_tokens").select("company_id").eq("token_hash", await sha256Hex(key)).maybeSingle();
        if (!owner) {
          console.warn("[bank-sms] rejected: unknown or replaced key");
          return json({ ok: false, error: "권한이 없습니다." }, 401);
        }

        let text = "", eventId: string | null = null, sender: string | null = null, receivedAt: string | null = null;
        const type = request.headers.get("content-type") ?? "";
        try {
          if (type.includes("form")) {
            const f = await request.formData();
            text = String(f.get("text") ?? f.get("message") ?? f.get("body") ?? "");
            eventId = (f.get("eventId") ?? f.get("id")) as string | null;
            sender = f.get("from") as string | null;
          } else {
            // JSON 이든 text/plain 으로 온 JSON 이든 같은 규칙으로 읽습니다.
            const parsed = extractForwardedText(await request.text());
            ({ text, eventId, sender, receivedAt } = parsed);
          }
        } catch {
          console.warn("[bank-sms] rejected: unreadable body", type);
          return json({ ok: false, error: "요청 내용을 읽지 못했습니다." }, 400);
        }
        // 키가 맞는 요청은 내용과 관계없이 수신 시각을 남겨 화면에서 연결 여부를 확인할 수 있게 합니다.
        await supabaseAdmin.from("bank_sms_ingest_tokens").update({ last_received_at: new Date().toISOString() }).eq("company_id", owner.company_id);
        if (!text.trim()) {
          console.warn("[bank-sms] rejected: empty text", type);
          return json({ ok: false, error: "문자 내용이 없습니다." }, 400);
        }
        const result = await ingestBankSms(supabaseAdmin, owner.company_id, { rawText: text, eventId: eventId ? String(eventId) : null, sender, receivedAt, channel: "forward" });
        console.log("[bank-sms] processed", JSON.stringify({ id: result.id ?? null, ok: result.ok, duplicated: result.duplicated ?? false, match: result.matchStatus ?? null, estimate: result.estimateId ?? null, kind: result.kind ?? null }));
        return json({ ok: result.ok, duplicated: result.duplicated ?? false, matchStatus: result.matchStatus ?? null }, result.ok ? 200 : 500);
      },
    },
  },
});
