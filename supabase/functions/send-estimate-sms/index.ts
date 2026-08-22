/**
 * 짐픽 견적서 문자발송 (알리고).
 *
 *   짐픽 앱 → 이 함수 → 알리고 → 고객 휴대폰
 *
 * 앱에서는 「어느 견적서를 보낼지」만 알려 줍니다.
 * 받는 번호·고객 이름·금액·문자 내용은 이 함수가 데이터베이스에서 직접 읽어 만듭니다.
 * 그래야 앱 쪽에서 번호나 금액을 바꿔 보낼 수 없습니다.
 *
 * 받는 값
 *   estimate_id      보낼 견적서
 *   delivery_method  link (지금은 보안 링크 방식만)
 *   idempotency_key  같은 발송이 두 번 나가지 않게 하는 열쇠
 *
 * 필요한 값 (Supabase > Edge Functions > Secrets)
 *   ALIGO_USER_ID              알리고 아이디
 *   ALIGO_API_KEY              알리고 API 키
 *   ALIGO_SENDER_NUMBER        사전등록·승인된 발신번호
 *   APP_PUBLIC_URL             고객이 여는 앱 주소 (예: https://example.com)
 *   SUPABASE_URL               (자동으로 들어 있습니다)
 *   SUPABASE_SERVICE_ROLE_KEY  (자동으로 들어 있습니다)
 *
 * 선택
 *   SMS_PROXY_URL / JIMPICK_PROXY_SECRET
 *     알리고에 발송 IP 를 등록해 두었다면 고정 IP 중계 서버를 거칩니다.
 *
 * 알리고가 실제로 접수했다고 답했을 때만 성공으로 봅니다.
 * 키 값과 전체 전화번호는 응답에도 기록에도 남기지 않습니다.
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

/** 하이픈·공백 등 숫자가 아닌 글자를 모두 없앱니다 */
function onlyDigits(s: string): string {
  return (s || "").replace(/[^0-9]/g, "");
}

/** 숫자만 남기고, 국가번호가 붙어 있으면 010… 으로 되돌립니다 */
function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/[^0-9]/g, "");
  if (d.startsWith("0082")) d = "0" + d.slice(4);
  else if (d.startsWith("82")) d = "0" + d.slice(2);
  return d;
}

/** 대한민국 휴대전화 번호인지 */
function isKoreanMobile(d: string): boolean {
  return /^01[016789][0-9]{7,8}$/.test(d);
}

/** 기록에는 뒤 4자리만 남깁니다 */
function last4(d: string): string {
  return d.length >= 4 ? d.slice(-4) : "";
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

/** 데이터베이스에 REST 로 물어봅니다 (서비스 키는 이 함수 안에서만 씁니다) */
async function db(
  path: string,
  init: RequestInit & { supabaseUrl: string; serviceKey: string },
): Promise<Response> {
  const { supabaseUrl, serviceKey, ...rest } = init;
  return await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(rest.headers ?? {}),
    },
  });
}

interface SendOutcome {
  ok: boolean;
  msgId?: string;
  msgType?: string;
  successCount?: number;
  error?: string;
  code?: number;
  raw?: Record<string, unknown>;
}

/** 알리고에 실제로 보냅니다 (시험 모드를 쓰지 않습니다) */
async function sendViaAligo(v: {
  to: string;
  text: string;
  title: string;
  msgType: string;
  aligoUserId: string;
  apiKey: string;
  sender: string;
  proxyUrl?: string;
  proxySecret?: string;
  viaProxy: boolean;
  userId: string;
}): Promise<SendOutcome> {
  try {
    if (v.viaProxy) {
      const r = await fetch(`${v.proxyUrl!.replace(/\/$/, "")}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-jimpick-secret": v.proxySecret! },
        body: JSON.stringify({ to: v.to, text: v.text, title: v.title, userId: v.userId }),
      });
      return await r.json().catch(() => ({ ok: false, error: "중계 서버 응답을 읽지 못했습니다." }));
    }
    const form = new FormData();
    form.append("user_id", v.aligoUserId);
    form.append("key", v.apiKey);
    form.append("sender", v.sender);
    form.append("receiver", v.to);
    form.append("msg", v.text);
    form.append("msg_type", v.msgType);
    form.append("title", v.title);
    const r = await fetch(ALIGO_ENDPOINT, { method: "POST", body: form });
    const data = (await r.json().catch(() => null)) as AligoResponse | null;
    if (!data) return { ok: false, error: "알리고 응답을 읽지 못했습니다." };
    const code = Number(data.result_code ?? -1);
    // HTTP 200 만으로 성공으로 보지 않습니다. 알리고가 접수(1)해야 성공입니다.
    if (code === 1) {
      return {
        ok: true,
        msgId: data.msg_id != null ? String(data.msg_id) : undefined,
        msgType: data.msg_type || v.msgType,
        successCount: data.success_cnt ?? 0,
        code,
        raw: { result_code: code, message: data.message ?? "", msg_type: data.msg_type ?? v.msgType },
      };
    }
    return {
      ok: false,
      error: aligoError(code, data.message ?? ""),
      code,
      raw: { result_code: code, message: data.message ?? "" },
    };
  } catch (e) {
    console.error("[send-estimate-sms] 발송 실패", e instanceof Error ? e.message : e);
    return { ok: false, error: "문자 발송 중 연결 오류가 났습니다. 잠시 후 다시 시도해 주세요." };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST 로 불러 주세요." }, 405);

  const aligoUserId = Deno.env.get("ALIGO_USER_ID");
  const apiKey = Deno.env.get("ALIGO_API_KEY");
  // 새 이름을 먼저 보고, 예전에 넣어 둔 이름도 그대로 받아 줍니다
  const senderRaw = Deno.env.get("ALIGO_SENDER") ?? Deno.env.get("ALIGO_SENDER_NUMBER") ?? "";
  const sender = onlyDigits(senderRaw);
  const appUrl = (Deno.env.get("PUBLIC_APP_URL") ?? Deno.env.get("APP_PUBLIC_URL") ?? "")
    .trim()
    .replace(/\/$/, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const proxyUrl = Deno.env.get("SMS_PROXY_URL");
  const proxySecret = Deno.env.get("JIMPICK_PROXY_SECRET");
  const viaProxy = !!(proxyUrl && proxySecret);

  let body: {
    estimate_id?: string;
    delivery_method?: string;
    idempotency_key?: string;
    checkOnly?: boolean;
    /** 연결 시험 — 정해진 문구 한 줄만, 사장님이 넣은 번호로 보냅니다 */
    mode?: string;
    test_to?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "요청 내용을 읽지 못했습니다." }, 400);
  }

  // 설정이 되어 있는지만 확인하는 요청 — 값은 절대 알려 주지 않습니다
  const missing = [
    !aligoUserId && "ALIGO_USER_ID",
    !apiKey && "ALIGO_API_KEY",
    !sender && "ALIGO_SENDER",
    !appUrl && "PUBLIC_APP_URL",
    !supabaseUrl && "SUPABASE_URL",
    !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean) as string[];

  /**
   * 문자에 넣는 주소는 반드시 배포된 주소여야 합니다.
   * 편집기·미리보기·내 컴퓨터 주소로는 고객이 열 수 없습니다.
   */
  const badAppUrl =
    !!appUrl &&
    (/localhost|127\.0\.0\.1|\.local\b/i.test(appUrl) ||
      /lovable(project)?\.(dev|com)/i.test(appUrl) ||
      /preview|staging|sandbox/i.test(appUrl) ||
      !/^https:\/\//i.test(appUrl));

  if (body.checkOnly) {
    return json({
      ok: missing.length === 0,
      config: {
        ALIGO_USER_ID: !!aligoUserId,
        ALIGO_API_KEY: !!apiKey,
        ALIGO_SENDER: !!sender,
        PUBLIC_APP_URL: !!appUrl && !badAppUrl,
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!serviceKey,
        SMS_PROXY_URL: !!proxyUrl,
        JIMPICK_PROXY_SECRET: !!proxySecret,
        발송경로: viaProxy ? "고정 IP 중계 서버 경유" : "알리고 직접 호출",
      },
      missing,
      appUrlProblem: badAppUrl
        ? "PUBLIC_APP_URL 이 배포 주소가 아닙니다. https://jimpick-ai-move-wiz.lovable.app 처럼 배포된 주소로 넣어 주세요."
        : null,
    });
  }

  // ── 1. 누가 부르는지 확인합니다 (로그인한 사장님만) ──
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  let userId = "";
  if (jwt) {
    try {
      const payload = JSON.parse(atob(jwt.split(".")[1] ?? ""));
      userId = String(payload?.sub ?? "");
      const exp = Number(payload?.exp ?? 0);
      if (exp && exp * 1000 < Date.now()) userId = "";
    } catch {
      userId = "";
    }
  }
  if (!userId) {
    return json({ ok: false, error: "로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요." }, 401);
  }

  if (missing.length) {
    // 값은 절대 보여 주지 않고, 빠진 이름만 알려 줍니다
    return json(
      {
        ok: false,
        error: `알리고 API 설정이 필요합니다. 설정되지 않은 값: ${missing.join(", ")}`,
        missing,
      },
      500,
    );
  }
  if (badAppUrl) {
    return json(
      {
        ok: false,
        error:
          "PUBLIC_APP_URL 이 배포된 주소가 아닙니다. 편집기·미리보기·내 컴퓨터 주소로는 고객이 열 수 없어 발송하지 않았습니다.",
      },
      500,
    );
  }
  if (!isKoreanMobile(sender)) {
    return json(
      { ok: false, error: "발신번호 형식이 올바르지 않습니다. 알리고에 등록한 번호를 확인해 주세요." },
      500,
    );
  }

  // ── 연결 시험 발송 ──
  // 견적서와 무관하게, 정해진 문구만 사장님이 넣은 번호로 한 통 보냅니다.
  // 고객 정보가 섞이지 않으므로 안전합니다. 로그인은 위에서 이미 확인했습니다.
  if (body.mode === "test") {
    const to = normalizePhone(String(body.test_to ?? ""));
    if (!isKoreanMobile(to)) {
      return json({ ok: false, error: "받는 번호 형식이 올바르지 않습니다." }, 400);
    }
    const testText = "[JIMPICK 짐픽]\n문자발송 연결 테스트입니다.";
    const sent = await sendViaAligo({
      to,
      text: testText,
      title: "짐픽 연결 테스트",
      msgType: "SMS",
      aligoUserId: aligoUserId!,
      apiKey: apiKey!,
      sender: sender!,
      proxyUrl,
      proxySecret,
      viaProxy,
      userId,
    });
    const nowT = new Date().toISOString();
    try {
      await db("estimate_deliveries", {
        supabaseUrl,
        serviceKey,
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({
          estimate_id: null,
          user_id: userId,
          to_masked: `****${last4(to)}`,
          delivery_method: "test",
          provider: "aligo",
          provider_message_id: sent.msgId ?? null,
          msg_id: sent.msgId ?? null,
          msg_type: sent.msgType ?? "SMS",
          status: sent.ok ? "sent" : "failed",
          requested_at: nowT,
          sent_at: sent.ok ? nowT : null,
          failed_at: sent.ok ? null : nowT,
          error_code: sent.ok ? null : String(sent.code ?? ""),
          error_message: sent.ok ? null : (sent.error ?? "").slice(0, 500),
          idempotency_key: String(body.idempotency_key ?? "") || null,
          test_mode: false,
          provider_result: sent.raw ?? null,
        }),
      });
    } catch (e) {
      console.error("[send-estimate-sms] 시험 발송 기록 실패", e instanceof Error ? e.message : e);
    }
    if (!sent.ok) {
      return json({ ok: false, error: sent.error ?? "문자 발송에 실패했습니다.", status: "failed" }, 502);
    }
    return json({
      ok: true,
      msgId: sent.msgId ?? null,
      msgType: sent.msgType ?? "SMS",
      status: "sent",
      recipientLast4: last4(to),
      requestedAt: nowT,
      sentAt: nowT,
    });
  }

  const estimateId = String(body.estimate_id ?? "").trim();
  const method = String(body.delivery_method ?? "link").trim();
  const idem = String(body.idempotency_key ?? "").trim();
  if (!estimateId) return json({ ok: false, error: "보낼 견적서를 찾지 못했습니다." }, 400);
  if (method !== "link") {
    return json({ ok: false, error: "지금은 보안 링크 방식만 보낼 수 있습니다." }, 400);
  }

  // ── 2. 견적서를 데이터베이스에서 직접 읽습니다 ──
  const q = new URLSearchParams({
    select:
      "id,user_id,estimate_id,sheet_no,sheet_version,customer_name,contact_phone,company_phone,total,access_token,sheet_snapshot",
    estimate_id: `eq.${estimateId}`,
    order: "sheet_version.desc",
    limit: "1",
  });
  const res = await db(`estimate_terms?${q}`, { supabaseUrl, serviceKey });
  if (!res.ok) {
    console.error("[send-estimate-sms] 견적서 조회 실패", res.status);
    return json({ ok: false, error: "견적서를 불러오지 못했습니다." }, 500);
  }
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  const row = rows?.[0];
  if (!row) {
    return json(
      {
        ok: false,
        error: "확정된 견적서가 없습니다. 견적서를 먼저 확정한 뒤 발송해 주세요.",
      },
      400,
    );
  }
  // 다른 업체의 견적서는 보낼 수 없습니다
  if (String(row.user_id) !== userId) {
    return json({ ok: false, error: "이 견적서를 보낼 권한이 없습니다." }, 403);
  }
  // 확정본(견적서 원본)이 담겨 있어야 고객이 볼 수 있습니다
  if (!row.sheet_snapshot) {
    return json(
      { ok: false, error: "견적서가 아직 확정되지 않았습니다. 견적서를 확정한 뒤 발송해 주세요." },
      400,
    );
  }

  const phone = normalizePhone(String(row.contact_phone ?? ""));
  if (!isKoreanMobile(phone)) {
    return json(
      { ok: false, error: "고객 휴대전화 번호 형식이 올바르지 않습니다. 견적서에서 번호를 확인해 주세요." },
      400,
    );
  }
  const token = String(row.access_token ?? "");
  if (token.length < 8) {
    return json({ ok: false, error: "고객용 보안 링크를 만들지 못했습니다." }, 500);
  }

  const version = Number(row.sheet_version ?? 1);
  const customer = String(row.customer_name ?? "").trim() || "고객";
  const link = `${appUrl}/share/${encodeURIComponent(estimateId)}?t=${encodeURIComponent(token)}`;

  // ── 3. 같은 발송이 이미 나갔는지 봅니다 ──
  if (idem) {
    const dq = new URLSearchParams({
      select: "id,status,provider_message_id,sent_at,msg_type",
      estimate_id: `eq.${estimateId}`,
      idempotency_key: `eq.${idem}`,
      status: "in.(queued,sent,success)",
      limit: "1",
    });
    const dres = await db(`estimate_deliveries?${dq}`, { supabaseUrl, serviceKey });
    if (dres.ok) {
      const done = ((await dres.json()) as Array<Record<string, unknown>>)?.[0];
      if (done) {
        return json({
          ok: true,
          alreadySent: true,
          msgId: done.provider_message_id ?? null,
          msgType: done.msg_type ?? "SMS",
          sentAt: done.sent_at ?? null,
          recipientLast4: last4(phone),
          status: String(done.status ?? "sent"),
          message: "이미 발송된 견적서입니다. 다시 보내지 않았습니다.",
        });
      }
    }
  }

  // 같은 견적서를 같은 번호로 방금 보냈다면 다시 보내지 않습니다 (2분 안)
  {
    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const rq = new URLSearchParams({
      select: "id,status,provider_message_id,sent_at,msg_type",
      estimate_id: `eq.${estimateId}`,
      to_masked: `eq.****${last4(phone)}`,
      status: "in.(queued,sent,success)",
      sent_at: `gte.${since}`,
      limit: "1",
    });
    const rres = await db(`estimate_deliveries?${rq}`, { supabaseUrl, serviceKey });
    if (rres.ok) {
      const recent = ((await rres.json()) as Array<Record<string, unknown>>)?.[0];
      if (recent) {
        return json({
          ok: true,
          alreadySent: true,
          msgId: recent.provider_message_id ?? null,
          msgType: recent.msg_type ?? "LMS",
          sentAt: recent.sent_at ?? null,
          recipientLast4: last4(phone),
          status: String(recent.status ?? "sent"),
          message: "방금 같은 견적서를 같은 번호로 보냈습니다. 다시 보내지 않았습니다.",
        });
      }
    }
  }

  // ── 4. 문자 내용을 실제 자료로 만듭니다 ──
  const companyPhone = String(row.company_phone ?? "").trim();
  const text = [
    "[JIMPICK 짐픽]",
    `${customer} 고객님, 요청하신 이사 견적서가 도착했습니다.`,
    "아래 링크에서 견적서와 표준약관을 확인해 주세요.",
    "",
    link,
    ...(companyPhone ? ["", `문의: ${companyPhone}`] : []),
  ].join("\n");
  const byteLen = new TextEncoder().encode(text).length;
  const msgType = byteLen <= 90 ? "SMS" : "LMS";
  const title = `이사 견적서 ${String(row.sheet_no ?? "")}`.trim().slice(0, 44);

  const requestedAt = new Date().toISOString();

  // ── 5. 알리고에 실제로 보냅니다 (시험 모드 아님) ──
  const result = await sendViaAligo({
    to: phone,
    text,
    title,
    msgType,
    aligoUserId: aligoUserId!,
    apiKey: apiKey!,
    sender: sender!,
    proxyUrl,
    proxySecret,
    viaProxy,
    userId,
  });

  // ── 6. 실제 시도를 그대로 기록합니다 (번호는 뒤 4자리만) ──
  const now = new Date().toISOString();
  try {
    await db("estimate_deliveries", {
      supabaseUrl,
      serviceKey,
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({
        estimate_id: estimateId,
        estimate_version: version,
        sheet_no: row.sheet_no ?? null,
        user_id: userId,
        to_masked: `****${last4(phone)}`,
        delivery_method: method,
        provider: "aligo",
        provider_message_id: result.msgId ?? null,
        msg_id: result.msgId ?? null,
        msg_type: result.msgType ?? msgType,
        status: result.ok ? "sent" : "failed",
        requested_at: requestedAt,
        sent_at: result.ok ? now : null,
        failed_at: result.ok ? null : now,
        error_code: result.ok ? null : String(result.code ?? ""),
        error_message: result.ok ? null : (result.error ?? "").slice(0, 500),
        idempotency_key: idem || null,
        test_mode: false,
        provider_result: result.raw ?? null,
      }),
    });
  } catch (e) {
    console.error("[send-estimate-sms] 발송 기록 저장 실패", e instanceof Error ? e.message : e);
  }

  if (!result.ok) {
    return json(
      {
        ok: false,
        error: result.error ?? "문자 발송에 실패했습니다.",
        status: "failed",
        recipientLast4: last4(phone),
        requestedAt,
      },
      502,
    );
  }

  return json({
    ok: true,
    msgId: result.msgId ?? null,
    msgType: result.msgType ?? msgType,
    successCount: result.successCount ?? 0,
    status: "sent",
    customerName: customer,
    recipientLast4: last4(phone),
    requestedAt,
    sentAt: now,
  });
});
