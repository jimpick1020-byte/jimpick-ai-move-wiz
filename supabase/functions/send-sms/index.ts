/**
 * 짐픽 문자발송 Edge Function.
 *
 *   짐픽 앱 → (여기) → 고정 IP 중계 서버 → 알리고 → 고객 휴대폰
 *
 * 이 함수는 알리고를 직접 부르지 않습니다.
 * Edge Function 은 나가는 IP 가 고정되지 않아 알리고 IP 등록을 할 수 없기 때문입니다.
 *
 * 필요한 환경변수 (Supabase > Edge Functions > Secrets)
 *   SMS_PROXY_URL          중계 서버 주소 (예: https://aligo-sms-proxy-xxxx.a.run.app)
 *   JIMPICK_PROXY_SECRET   중계 서버와 똑같은 비밀키
 */

interface SendBody {
  to?: string;
  text?: string;
  title?: string;
  idempotencyKey?: string;
  estimateId?: string;
  sheetNo?: string;
  imageBase64?: string;
  imageName?: string;
  imageType?: string;
  testMode?: boolean;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST 로 불러 주세요." }, 405);

  const proxyUrl = Deno.env.get("SMS_PROXY_URL");
  const secret = Deno.env.get("JIMPICK_PROXY_SECRET");

  const missing = [!proxyUrl && "SMS_PROXY_URL", !secret && "JIMPICK_PROXY_SECRET"].filter(Boolean);
  if (missing.length) {
    return json(
      { ok: false, error: `문자 발송 설정이 필요합니다. (${missing.join(", ")} 미설정)` },
      500,
    );
  }

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "요청 내용을 읽지 못했습니다." }, 400);
  }

  if (!body.to || !body.text) {
    return json({ ok: false, error: "받는 번호와 보낼 내용이 필요합니다." }, 400);
  }

  // 로그인한 사용자를 확인해 기록에 남깁니다 (없어도 발송은 됩니다)
  let userId: string | null = null;
  const auth = req.headers.get("Authorization");
  if (auth) {
    try {
      const payload = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1] ?? ""));
      userId = payload?.sub ?? null;
    } catch {
      userId = null;
    }
  }

  try {
    const res = await fetch(`${proxyUrl!.replace(/\/$/, "")}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-jimpick-secret": secret!,
      },
      body: JSON.stringify({ ...body, userId }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "중계 서버 응답을 읽지 못했습니다." }));
    return json(data, res.ok ? 200 : res.status);
  } catch (e) {
    console.error("[send-sms] 중계 서버 연결 실패", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "문자 중계 서버에 연결하지 못했습니다." }, 502);
  }
});
