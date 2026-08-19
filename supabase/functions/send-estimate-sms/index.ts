/**
 * 짐픽 견적서 문자발송 (알리고).
 *
 *   짐픽 앱 → 이 함수 → 알리고 → 고객 휴대폰
 *
 * 알리고 아이디·키·발신번호는 Supabase Secrets 에서만 읽습니다.
 * 화면이나 브라우저로는 절대 나가지 않습니다.
 *
 * 필요한 값 (Supabase > Edge Functions > Secrets)
 *   ALIGO_USER_ID         알리고 아이디
 *   ALIGO_API_KEY         알리고 API 키
 *   ALIGO_SENDER_NUMBER   사전등록·승인된 발신번호
 *
 * 선택 (알리고에 발송 IP 를 등록해 두었을 때)
 *   SMS_PROXY_URL         고정 IP 중계 서버 주소
 *   JIMPICK_PROXY_SECRET  중계 서버와 같은 비밀키
 *   → 이 둘이 있으면 중계 서버를 거쳐 보냅니다.
 *     Edge Function 은 나가는 IP 가 고정되지 않아, 알리고에 발송 IP 를 등록해 둔 경우
 *     직접 부르면 거부당하기 때문입니다.
 *
 * 알리고가 "성공" 이라고 답했을 때만 성공으로 표시합니다.
 */

const ALIGO_ENDPOINT = "https://apis.aligo.in/send/";

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

interface SendBody {
  /** 받는 번호 — 화면에서 입력받습니다 (코드에 고정하지 않습니다) */
  to?: string;
  text?: string;
  title?: string;
  estimateId?: string;
  sheetNo?: string;
  /** 견적서 이미지 (있으면 MMS 로 보냅니다) */
  imageBase64?: string;
  imageName?: string;
  imageType?: string;
  /** 같은 발송을 두 번 하지 않기 위한 열쇠 */
  idempotencyKey?: string;
  /** 알리고 시험 모드 (실제로 나가지 않습니다) */
  testMode?: boolean;
}

/** 숫자만 남기고, 국가번호가 붙어 있으면 010… 으로 되돌립니다 */
function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/[^0-9]/g, "");
  if (d.startsWith("0082")) d = "0" + d.slice(4);
  else if (d.startsWith("82")) d = "0" + d.slice(2);
  return d;
}

/** 번호는 뒤 4자리만 기록에 남깁니다 */
function maskPhone(d: string): string {
  return d.length >= 4 ? `****${d.slice(-4)}` : "****";
}

/** 알리고 오류 코드를 쉬운 한국어로. 알리고가 준 원문도 함께 붙입니다. */
function aligoError(code: number, message: string): string {
  const raw = (message || "").trim();
  const known: Record<number, string> = {
    [-101]: "알리고 아이디 또는 API 키가 올바르지 않습니다.",
    [-102]: "등록되지 않은 발신번호입니다. 알리고에서 발신번호 사전등록·승인을 마쳐 주세요.",
    [-103]: "발송 요청 형식이 올바르지 않습니다.",
    [-111]: "문자 잔액이 부족합니다. 알리고에서 충전해 주세요.",
    [-201]: "문자 보유건수가 부족합니다. 알리고에서 충전해 주세요.",
    [-301]: "등록되지 않은 발송 IP 입니다. 알리고에 발송 서버 IP 를 등록해 주세요.",
  };
  const head = known[code] ?? "문자 발송에 실패했습니다.";
  return `${head} / 알리고 안내: ${raw || "(내용 없음)"} / 코드 ${code}`;
}

interface AligoResponse {
  result_code?: number | string;
  message?: string;
  msg_id?: string | number;
  success_cnt?: number;
  error_cnt?: number;
  msg_type?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST 로 불러 주세요." }, 405);

  const aligoUserId = Deno.env.get("ALIGO_USER_ID");
  const apiKey = Deno.env.get("ALIGO_API_KEY");
  const sender = Deno.env.get("ALIGO_SENDER_NUMBER");
  const proxyUrl = Deno.env.get("SMS_PROXY_URL");
  const proxySecret = Deno.env.get("JIMPICK_PROXY_SECRET");
  const viaProxy = !!(proxyUrl && proxySecret);

  // 설정이 없으면 성공한 척하지 않고, 무엇이 빠졌는지만 알려 줍니다 (값은 보여 주지 않습니다)
  const missing = [
    !aligoUserId && "ALIGO_USER_ID",
    !apiKey && "ALIGO_API_KEY",
    !sender && "ALIGO_SENDER_NUMBER",
  ].filter(Boolean);
  if (missing.length && !viaProxy) {
    return json(
      { ok: false, error: `문자 발송 설정이 필요합니다. 설정되지 않은 값: ${missing.join(", ")}` },
      500,
    );
  }

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "요청 내용을 읽지 못했습니다." }, 400);
  }

  // 설정 확인만 하는 요청 — 값은 알려 주지 않고 있는지만 알려 줍니다
  if ((body as { checkOnly?: boolean }).checkOnly) {
    return json({
      ok: missing.length === 0,
      config: {
        ALIGO_USER_ID: !!aligoUserId,
        ALIGO_API_KEY: !!apiKey,
        ALIGO_SENDER_NUMBER: !!sender,
        SMS_PROXY_URL: !!proxyUrl,
        JIMPICK_PROXY_SECRET: !!proxySecret,
        발송경로: viaProxy ? "고정 IP 중계 서버 경유" : "알리고 직접 호출",
      },
      missing,
    });
  }

  const to = normalizePhone(body.to ?? "");
  if (!/^01[016789][0-9]{7,8}$/.test(to)) {
    return json(
      { ok: false, error: "받는 번호 형식이 올바르지 않습니다. 010으로 시작하는 번호를 넣어 주세요." },
      400,
    );
  }
  const text = (body.text ?? "").trim();
  if (!text) return json({ ok: false, error: "보낼 내용이 비어 있습니다." }, 400);

  // 이미지가 붙어 있으면 MMS, 아니면 글자 수에 따라 SMS·LMS
  const hasImage = !!body.imageBase64;
  const byteLen = new TextEncoder().encode(text).length;
  const msgType = hasImage ? "MMS" : byteLen <= 90 ? "SMS" : "LMS";

  // 로그인한 사장님을 기록에 남깁니다 (없어도 발송은 됩니다)
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

  let result: {
    ok: boolean;
    msgId?: string;
    msgType?: string;
    successCount?: number;
    error?: string;
  };

  try {
    if (viaProxy) {
      // 알리고에 발송 IP 를 등록해 둔 경우 — 고정 IP 중계 서버를 거칩니다
      const res = await fetch(`${proxyUrl!.replace(/\/$/, "")}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-jimpick-secret": proxySecret! },
        body: JSON.stringify({ ...body, to, userId }),
      });
      result = await res
        .json()
        .catch(() => ({ ok: false, error: "중계 서버 응답을 읽지 못했습니다." }));
    } else {
      // 알리고를 직접 부릅니다
      const form = new FormData();
      form.append("user_id", aligoUserId!);
      form.append("key", apiKey!);
      form.append("sender", sender!);
      form.append("receiver", to);
      form.append("msg", text);
      form.append("msg_type", msgType);
      if (body.title) form.append("title", body.title.slice(0, 44));
      if (body.testMode) form.append("testmode_yn", "Y");
      if (hasImage) {
        // 그림을 실제 파일로 붙입니다. 여기서 실패하면 아래 catch 로 가서
        // MMS 성공으로 표시되지 않습니다.
        const bin = Uint8Array.from(atob(body.imageBase64!), (c) => c.charCodeAt(0));
        form.append(
          "image",
          new Blob([bin], { type: body.imageType || "image/jpeg" }),
          body.imageName || "estimate.jpg",
        );
      }

      const res = await fetch(ALIGO_ENDPOINT, { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as AligoResponse | null;
      if (!data) {
        result = { ok: false, error: "알리고 응답을 읽지 못했습니다." };
      } else {
        const code = Number(data.result_code ?? -1);
        // 알리고가 성공(1)이라고 답했을 때만 성공입니다
        result =
          code === 1
            ? {
                ok: true,
                msgId: data.msg_id != null ? String(data.msg_id) : undefined,
                msgType: data.msg_type || msgType,
                successCount: data.success_cnt ?? 0,
              }
            : { ok: false, error: aligoError(code, data.message ?? "") };
      }
    }
  } catch (e) {
    console.error("[send-estimate-sms] 발송 실패", e instanceof Error ? e.message : e);
    result = { ok: false, error: "문자 발송 중 연결 오류가 났습니다. 잠시 후 다시 시도해 주세요." };
  }

  // 그림을 붙였는데 알리고가 MMS 로 처리하지 않았으면 성공으로 표시하지 않습니다
  if (result.ok && hasImage && (result.msgType ?? "").toUpperCase() !== "MMS") {
    result = {
      ok: false,
      error: `견적서 이미지가 붙지 않았습니다. 알리고가 ${result.msgType ?? "알 수 없음"} 으로 처리했습니다.`,
      msgId: result.msgId,
      msgType: result.msgType,
    };
  }

  // 발송 결과를 남깁니다 (번호는 뒤 4자리만). 기록 실패가 발송 결과를 바꾸지는 않습니다.
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey) {
      await fetch(`${supabaseUrl}/rest/v1/estimate_deliveries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "resolution=ignore-duplicates",
        },
        body: JSON.stringify({
          estimate_id: body.estimateId ?? null,
          sheet_no: body.sheetNo ?? null,
          user_id: userId,
          to_masked: maskPhone(to),
          msg_type: result.msgType ?? msgType,
          msg_id: result.msgId ?? null,
          status: result.ok ? "success" : "failed",
          error_message: result.ok ? null : (result.error ?? "").slice(0, 500),
          test_mode: !!body.testMode,
          idempotency_key: body.idempotencyKey ?? null,
        }),
      });
    }
  } catch (e) {
    console.error("[send-estimate-sms] 발송 기록 저장 실패", e instanceof Error ? e.message : e);
  }

  return json({ ...result, sentAt: Date.now() }, result.ok ? 200 : 502);
});
