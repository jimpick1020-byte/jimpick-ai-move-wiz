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
 *   ALIGO_SENDER               운영자 서비스 복구 통보에만 쓰는 사전등록 번호
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
    [-101]: "알리고 API 인증정보(user_id/API Key)를 확인해 주세요.",
    [-102]: "알리고 API 인증정보(user_id/API Key)를 확인해 주세요.",
    [-103]: "발송 요청 형식이 올바르지 않습니다.",
    [-111]: "문자 잔액이 부족합니다. 알리고에서 충전해 주세요.",
    [-201]: "문자 보유건수가 부족합니다. 알리고에서 충전해 주세요.",
    [-301]: "등록되지 않은 발송 IP 입니다. 알리고에 발송 서버 IP 를 등록해 주세요.",
  };
  const head = known[code] ?? "문자 발송에 실패했습니다.";
  return `${head} / 알리고 안내: ${raw || "(내용 없음)"} / 코드 ${code}`;
}

interface AligoResponse {
  ok?: boolean;
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

/** 서비스 최고관리자인지 데이터베이스에서 확인합니다 (설정 확인·시험 발송 전용) */
async function isSuperAdmin(
  userId: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const res = await db(
      `user_roles?select=role&user_id=eq.${userId}&role=eq.super_admin&limit=1`,
      { supabaseUrl, serviceKey },
    );
    const rows = (await res.json().catch(() => [])) as unknown[];
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

/** Customer messages are scoped to the estimate owner, not a global sender setting. */
async function companySmsInfo(companyId: string, supabaseUrl: string, serviceKey: string) {
  if (!companyId) return { ok: false, error: "업체 정보가 필요합니다." } as const;
  const [profileRes, senderRes] = await Promise.all([
    db(`profiles?select=company_name,phone&id=eq.${encodeURIComponent(companyId)}&limit=1`, { supabaseUrl, serviceKey }),
    db(`company_sms_senders?select=sender_number&company_id=eq.${encodeURIComponent(companyId)}&provider=eq.aligo&limit=1`, { supabaseUrl, serviceKey }),
  ]);
  if (!profileRes.ok || !senderRes.ok) return { ok: false, error: "업체 발신정보를 확인하지 못해 발송하지 않았습니다." } as const;
  const profile = ((await profileRes.json()) as Array<{ company_name?: string; phone?: string }>)[0];
  const approved = ((await senderRes.json()) as Array<{ sender_number?: string }>)[0];
  const companyName = String(profile?.company_name ?? "").trim();
  if (!companyName) return { ok: false, error: "업체 정보가 필요합니다." } as const;
  // 저장된 번호에 하이픈이 섞여 있어도 알리고 전송 형식(숫자만)으로 맞춰 줍니다.
  const sender = normalizePhone(String(approved?.sender_number ?? ""));
  if (!/^0[0-9]{8,10}$/.test(sender)) return { ok: false, error: "알리고 승인 발신번호가 등록되지 않아 발송하지 않았습니다." } as const;
  return { ok: true, companyName, companyPhone: String(profile?.phone ?? "").trim(), sender } as const;
}

/**
 * 이용 권한 확인 — 한 달 무료체험 중이거나 유료 구독 중이거나 관리자여야 문자를 보낼 수 있습니다.
 */
async function canSend(
  userId: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const EXPIRED = "한 달 무료체험이 종료되었습니다. 계속 이용하려면 구독해 주세요.";
  try {
    const roleRes = await db(
      `user_roles?select=role&user_id=eq.${userId}&role=in.(super_admin,admin)&limit=1`,
      { supabaseUrl, serviceKey },
    );
    const roles = (await roleRes.json().catch(() => [])) as unknown[];
    if (Array.isArray(roles) && roles.length > 0) return { ok: true };

    const subRes = await db(
      `subscriptions?select=plan,status,trial_started_at,trial_ends_at,current_period_start,current_period_end,created_at&user_id=eq.${userId}&limit=1`,
      { supabaseUrl, serviceKey },
    );
    const rows = (await subRes.json().catch(() => [])) as {
      plan?: string;
      status?: string;
      trial_started_at?: string | null;
      trial_ends_at?: string | null;
      current_period_start?: string;
      current_period_end?: string;
      created_at?: string;
    }[];
    const sub = Array.isArray(rows) ? rows[0] : undefined;
    if (!sub) return { ok: false, error: EXPIRED };
    const now = Date.now();
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
    if (sub.plan !== "free" && sub.status === "active" && periodEnd > now) return { ok: true };
    const startStr = sub.trial_started_at ?? sub.current_period_start ?? sub.created_at ?? "";
    const trialEnd = sub.trial_ends_at
      ? new Date(sub.trial_ends_at).getTime()
      : startStr
        ? new Date(startStr).getTime() + 30 * 24 * 3600_000
        : 0;
    if (sub.status === "trialing" && trialEnd > now) return { ok: true };
    return { ok: false, error: EXPIRED };
  } catch {
    // 확인에 실패하면 발송을 막지 않습니다 (기존 동작 유지)
    return { ok: true };
  }
}

/** 무료 문자 상한·체험 종료 안내 */
const SMS_LIMIT_MESSAGE = "무료 문자 사용량을 확인해 주세요. 계속 이용하려면 구독해 주세요.";
const TRIAL_OVER_MESSAGE = "한 달 무료체험이 종료되었습니다. 계속 이용하려면 구독해 주세요.";

/** 데이터베이스 함수를 부릅니다 */
async function rpc(
  name: string,
  args: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<unknown> {
  const r = await db(`rpc/${name}`, {
    supabaseUrl,
    serviceKey,
    method: "POST",
    body: JSON.stringify(args),
  });
  return await r.json().catch(() => null);
}

/**
 * 발송 직전에 무료 문자를 원자적으로 예약합니다 (수신번호 1개당 1건).
 *
 * - 체험이 끝난 업체의 요청은 데이터베이스에서 거절됩니다. (체험 중에는 건수 제한 없음)
 * - 같은 발송 열쇠(idempotency_key)로 두 번 예약되지 않습니다.
 * - 관리자·유료 구독은 상한이 없지만 사용량은 그대로 기록합니다.
 */
async function reserveSms(v: {
  userId: string;
  key: string;
  count?: number;
  supabaseUrl: string;
  serviceKey: string;
}): Promise<{ ok: boolean; hold?: string; duplicate?: boolean; error?: string }> {
  if (!v.userId) return { ok: true }; // 우리 서버가 직접 부른 경우
  const res = (await rpc(
    "reserve_free_sms",
    { _user_id: v.userId, _key: v.key, _count: Math.max(1, v.count ?? 1) },
    v.supabaseUrl,
    v.serviceKey,
  )) as { allowed?: boolean; reason?: string; key?: string; duplicate?: boolean } | null;
  if (!res || typeof res !== "object") {
    return { ok: false, error: "문자 사용량을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  if (res.allowed) return { ok: true, hold: res.key ?? v.key };
  if (res.duplicate) return { ok: false, duplicate: true };
  return { ok: false, error: res.reason === "limit" ? SMS_LIMIT_MESSAGE : TRIAL_OVER_MESSAGE };
}

/** 실제로 발송에 실패했으면 예약을 되돌립니다 (실패는 차감하지 않습니다) */
async function releaseSms(
  userId: string,
  hold: string | undefined,
  supabaseUrl: string,
  serviceKey: string,
): Promise<void> {
  if (!userId || !hold) return;
  try {
    await rpc("release_free_sms", { _user_id: userId, _key: hold }, supabaseUrl, serviceKey);
  } catch (e) {
    console.error("[sms-usage] 예약 되돌리기 실패", e instanceof Error ? e.message : e);
  }
}

/** 알리고가 접수한 발송만 사용 건수로 확정합니다 */
async function confirmSms(
  userId: string,
  hold: string | undefined,
  supabaseUrl: string,
  serviceKey: string,
): Promise<void> {
  if (!userId || !hold) return;
  try {
    await rpc("confirm_free_sms", { _user_id: userId, _key: hold }, supabaseUrl, serviceKey);
  } catch (e) {
    console.error("[sms-usage] 사용 확정 기록 실패", e instanceof Error ? e.message : e);
  }
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
  companyId?: string;
  serviceNotice?: boolean;
  cardType?: "quote" | "deposit";
  cardData?: { companyName: string; customerName: string; moveDate: string; amount: string; companyPhone: string };
}): Promise<SendOutcome> {
  try {
    if (v.viaProxy) {
      if (v.serviceNotice) {
        const health = await fetch(`${v.proxyUrl!.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(6000) });
        const capability = (await health.json().catch(() => null)) as { service?: string; capabilities?: string[] } | null;
        if (!health.ok || capability?.service !== "aligo-sms-proxy" || !capability.capabilities?.includes("service-fix-v1")) {
          return { ok: false, error: "운영 통보 중계 서버가 아직 새 버전이 아니어서 발송하지 않았습니다." };
        }
      }
      // 구형 중계 서버가 그림 필드를 무시하고 텍스트만 보내지 않도록 버전을 먼저 확인합니다.
      if (v.cardType) {
        const health = await fetch(`${v.proxyUrl!.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(6000) });
        const capability = (await health.json().catch(() => null)) as { service?: string; capabilities?: string[] } | null;
        if (!health.ok || capability?.service !== "aligo-sms-proxy" || !capability.capabilities?.includes("sms-cards-v1")) {
          return { ok: false, error: "그림문자 중계 서버가 아직 새 버전이 아니어서 발송하지 않았습니다." };
        }
      }
       const serviceNotice = v.serviceNotice === true;
       const r = await fetch(`${v.proxyUrl!.replace(/\/$/, "")}${serviceNotice ? "/send-service-fix-notice" : "/send"}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-jimpick-secret": String(v.proxySecret ?? "").trim(),
        },
        body: JSON.stringify({ to: v.to, text: v.text, title: v.title, companyId: v.companyId ?? v.userId, userId: v.userId, cardType: v.cardType, cardData: v.cardData }),
      });

      const data = (await r.json().catch(() => null)) as AligoResponse | null;
      if (r.status === 401 || r.status === 403) {
        return {
          ok: false,
          code: r.status,
          error: r.status === 403
            ? "업체의 승인된 발신번호가 없거나 업체 정보가 일치하지 않아 발송하지 않았습니다."
            : "문자 중계 서버가 요청을 거절했습니다(인증 실패). 중계 서버의 비밀값을 확인해 주세요.",
        };
      }
      if (!data) {
        return { ok: false, code: r.status, error: `중계 서버 응답을 읽지 못했습니다. (${r.status})` };
      }

      // Cloud Run 이 HTTP 200을 줘도, 알리고 result_code가 1 미만이면 실패입니다.
      const code = Number(data.result_code ?? -1);
      if (r.ok && data.ok === true && code === 1) {
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
    }


    if (v.cardType) return { ok: false, error: "그림문자 중계 서버가 준비되지 않아 발송하지 않았습니다." };
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

/**
 * 실제 처리 본문.
 * 아래 Deno.serve 에서 감싸므로, 여기서 예상 못 한 오류가 나도
 * 워커가 죽지 않고 안내 문구가 사장님에게 전달됩니다.
 */
const handle = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST 로 불러 주세요." }, 405);

  const aligoUserId = Deno.env.get("ALIGO_USER_ID");
  // 비밀값 등록 과정에서 붙을 수 있는 줄바꿈·공백은 알리고 인증 실패(-102)를 일으킵니다.
  // 원문은 로그나 응답에 남기지 않고, 정리한 값만 서버 내부에서 전송합니다.
  const apiKey = Deno.env.get("ALIGO_API_KEY")?.trim();
  // 기존 전역 발신번호는 업체별 발송에 사용하지 않습니다.
  const sender = normalizePhone(Deno.env.get("ALIGO_SENDER") ?? "");
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
    company_id?: string;
    delivery_method?: string;
    idempotency_key?: string;
    /** 사장님이 확인창에서 「다시 발송」을 직접 누른 경우에만 참 */
    resend?: boolean;
    checkOnly?: boolean;
    /** 연결 시험 — 정해진 문구 한 줄만, 사장님이 넣은 번호로 보냅니다 */
    mode?: string;
    test_to?: string;
    /** 사장님 예약확정 알림 — 고객의 보안 링크 토큰 */
    token?: string;
    /** 수정 통보 — 무엇을 고쳤는지 알리는 제목·내용 */
    notice_title?: string;
    notice_summary?: string;
    /** 통보와 이어지는 오류 기록 */
    error_log_id?: string;
    /** 통보를 만든 곳 (auto · manual) */
    notice_source?: string;
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

  // 설정 상태 확인(checkOnly)과 시험 발송은 아래에서 로그인·관리자 권한을 확인한 뒤에만 처리합니다.

  // ── 1. 누가 부르는지 확인합니다 (로그인한 사장님만) ──
  // 예약확정 알림·입금 알림은 우리 서버가 직접 부르므로, 서버 확인값으로 온 요청도 받아 줍니다.
  // 열쇠가 바뀌면 서비스 키 비교만으로는 우리 서버를 못 알아보므로,
  // 앱 서버와 이 함수가 함께 가진 서버 확인값(JIMPICK_PROXY_SECRET)도 함께 봅니다.
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  const serverSecret = (Deno.env.get("JIMPICK_PROXY_SECRET") ?? "").trim();
  const serverHeader = (req.headers.get("x-jimpick-server") ?? "").trim();
  let isServerCall =
    (!!serviceKey && jwt === serviceKey) ||
    (!!serverSecret && serverHeader.length === serverSecret.length && serverHeader === serverSecret);

  /**
   * 열쇠가 바뀌어 값이 서로 달라졌을 때에도 우리 서버를 알아봅니다.
   *
   * 들어온 열쇠가 「관리자 열쇠 모양」이면, 인증 서버에 실제로 물어
   * 관리자 권한이 있는 참된 열쇠인지 확인합니다.
   * 흉내낸 열쇠는 이 확인을 통과하지 못합니다.
   */
  if (!isServerCall && jwt) {
    const looksAdminKey =
      jwt.startsWith("sb_secret_") ||
      (() => {
        try {
          const p = JSON.parse(atob(jwt.split(".")[1] ?? ""));
          return p?.role === "service_role";
        } catch {
          return false;
        }
      })();
    if (looksAdminKey) {
      try {
        const probe = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1`, {
          headers: { Authorization: `Bearer ${jwt}`, apikey: jwt },
        });
        if (probe.ok) isServerCall = true;
        else console.error("[send-estimate-sms] 관리자 열쇠 확인 실패", probe.status);
      } catch (e) {
        console.error("[send-estimate-sms] 관리자 열쇠 확인 오류", e instanceof Error ? e.message : e);
      }
    }
  }
  let userId = "";
  if (jwt && !isServerCall) {
    // 토큰 내용을 그대로 믿지 않고, 인증 서버에 직접 물어 확인합니다.
    try {
      const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${jwt}`, apikey: serviceKey! },
      });
      if (who.ok) {
        const u = await who.json();
        userId = String(u?.id ?? "");
      }
    } catch {
      userId = "";
    }
  }
  if (!userId && !isServerCall) {
    return json({ ok: false, error: "로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요." }, 401);
  }

  // 설정 상태 확인·시험 발송은 서비스 최고관리자(또는 우리 서버)만 할 수 있습니다.
  const adminOnly =
    body.checkOnly === true || body.mode === "test" || body.mode === "fix_notice";
  if (adminOnly && !isServerCall) {
    const admin = await isSuperAdmin(userId, supabaseUrl, serviceKey);
    if (!admin) {
      return json(
        { ok: false, error: "문자발송 설정은 서비스 관리자만 확인할 수 있습니다." },
        403,
      );
    }
  }

  // 설정이 되어 있는지만 알려 줍니다 — 아이디·키·발신번호 값은 절대 보내지 않습니다.
  if (body.checkOnly) {
    const checkCompanyId = isServerCall && /^[0-9a-f-]{36}$/i.test(String(body.company_id ?? ""))
      ? String(body.company_id) : userId;
    const senderReady = checkCompanyId ? (await companySmsInfo(checkCompanyId, supabaseUrl, serviceKey)).ok : false;
    let cardReady = false;
    // 중계 서버가 어떤 버전인지(비밀값은 제외) 그대로 보여 줍니다 — 점검용입니다.
    let proxyHealth: { status?: number; service?: string | null; capabilities?: string[] | null; error?: string } | null = null;
    if (viaProxy) {
      try {
        const r = await fetch(`${proxyUrl!.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(6000) });
        const h = (await r.json().catch(() => null)) as { service?: string; capabilities?: string[] } | null;
        cardReady = r.ok && h?.service === "aligo-sms-proxy" && h.capabilities?.includes("sms-cards-v1") === true;
        proxyHealth = { status: r.status, service: h?.service ?? null, capabilities: h?.capabilities ?? null };
      } catch (e) {
        proxyHealth = { error: e instanceof Error ? e.message : "확인 실패" };
      }
    }
    return json({
      ok: missing.length === 0 && cardReady && senderReady && !badAppUrl,
      config: {
        ALIGO_USER_ID: !!aligoUserId,
        ALIGO_API_KEY: !!apiKey,
        업체별승인발신번호: senderReady,
        PUBLIC_APP_URL: !!appUrl && !badAppUrl,
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!serviceKey,
        SMS_PROXY_URL: !!proxyUrl,
        JIMPICK_PROXY_SECRET: !!proxySecret,
        그림문자서버: cardReady,
        발송경로: viaProxy ? "고정 IP 중계 서버 경유" : "그림문자 중계 서버 필요",
      },
      missing: [...missing, ...(!cardReady ? ["그림문자 중계 서버 새 버전"] : []), ...(!senderReady ? ["업체별 승인 발신번호"] : [])],
      appUrlProblem: badAppUrl
        ? "PUBLIC_APP_URL 이 배포 주소가 아닙니다. 배포된 주소로 넣어 주세요."
        : null,
    });
  }

  // 한 달 무료체험이 끝나고 결제하지 않은 업체는 문자 발송을 막습니다 (기존 기록은 그대로 둡니다).
  if (userId && !isServerCall) {
    const allow = await canSend(userId, supabaseUrl, serviceKey);
    if (!allow.ok) return json({ ok: false, error: allow.error }, 403);
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
  // ── 연결 시험 발송 ──
  // 견적서와 무관하게, 정해진 문구만 사장님이 넣은 번호로 한 통 보냅니다.
  // 고객 정보가 섞이지 않으므로 안전합니다. 로그인은 위에서 이미 확인했습니다.
  if (body.mode === "test") {
    // 우리 서버에서 점검할 때는 어느 업체로 보낼지 직접 알려 줍니다.
    const testUserId =
      isServerCall && /^[0-9a-f-]{36}$/i.test(String(body.company_id ?? ""))
        ? String(body.company_id)
        : userId;
    if (!testUserId) return json({ ok: false, error: "시험 발송할 업체 계정으로 로그인해 주세요." }, 403);
    const testCompany = await companySmsInfo(testUserId, supabaseUrl, serviceKey);
    if (!testCompany.ok) return json({ ok: false, error: testCompany.error }, 403);
    const to = normalizePhone(String(body.test_to ?? ""));
    if (!isKoreanMobile(to)) {
      return json({ ok: false, error: "받는 번호 형식이 올바르지 않습니다." }, 400);
    }
    const testText = `[${testCompany.companyName}]\n문자발송 연결 테스트입니다.`;
    // 시험 문자도 실제로 요금이 나가므로 무료 문자 사용량에 넣습니다.
    const holdT = await reserveSms({
      userId: testUserId,
      key: String(body.idempotency_key ?? "").trim() || `test:${testUserId}:${Date.now()}`,
      supabaseUrl,
      serviceKey,
    });
    if (!holdT.ok) {
      if (holdT.duplicate) {
        return json({ ok: true, alreadySent: true, message: "이미 처리된 발송 요청입니다." });
      }
      return json({ ok: false, error: holdT.error, status: "blocked" }, 403);
    }
    const sent = await sendViaAligo({
      to,
      text: testText,
      title: "문자 연결 테스트",
      msgType: "SMS",
      aligoUserId: aligoUserId!,
      apiKey: apiKey!,
      sender: testCompany.sender,
      companyId: testUserId,
      proxyUrl,
      proxySecret,
      viaProxy,
      userId: testUserId,
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
          user_id: testUserId,
          to_masked: `****${last4(to)}`,
          delivery_method: "test",
          provider: "aligo",
          provider_message_id: sent.msgId ?? null,
          msg_id: sent.msgId ?? null,
          msg_type: sent.msgType ?? "SMS",
          status: sent.ok ? "accepted" : "failed",
          requested_at: nowT,
          sent_at: sent.ok ? nowT : null,
          failed_at: sent.ok ? null : nowT,
          error_code: sent.ok ? null : String(sent.code ?? ""),
          error_message: sent.ok ? null : (sent.error ?? "").slice(0, 500),
          idempotency_key: String(body.idempotency_key ?? "") || null,
          provider_result: sent.raw ?? null,
        }),
      });
    } catch (e) {
      console.error("[send-estimate-sms] 시험 발송 기록 실패", e instanceof Error ? e.message : e);
    }
    if (!sent.ok) {
      await releaseSms(testUserId, holdT.hold, supabaseUrl, serviceKey);
      return json({ ok: false, error: sent.error ?? "문자 발송에 실패했습니다.", status: "failed" }, 502);
    }
    await confirmSms(testUserId, holdT.hold, supabaseUrl, serviceKey);
    return json({
      ok: true,
      msgId: sent.msgId ?? null,
      msgType: sent.msgType ?? "SMS",
      status: "accepted",
      recipientLast4: last4(to),
      requestedAt: nowT,
      sentAt: nowT,
    });
  }

  // ── 수정 통보 ──
  // 오류가 났을 때 관리자를 부르지 않고, 고친 뒤에 「이렇게 고쳤습니다」만 한 통 보냅니다.
  // 받는 번호는 관리자 화면에 저장된 연락처만 씁니다 (코드에 번호를 넣지 않습니다).
  if (body.mode === "fix_notice") {
    // 서비스 복구 통보는 업체 문자와 다른 운영자 전용 발송입니다.
    if (!isKoreanMobile(sender)) return json({ ok: false, error: "운영 통보 발신번호가 준비되지 않았습니다." }, 500);
    const title = String(body.notice_title ?? "").trim().slice(0, 60);
    const summary = String(body.notice_summary ?? "").trim().slice(0, 300);
    if (!title || !summary) {
      return json({ ok: false, error: "통보할 제목과 내용이 필요합니다." }, 400);
    }

    const sq = new URLSearchParams({
      select: "notice_phone,notify_enabled",
      id: "eq.true",
      limit: "1",
    });
    const sres = await db(`service_ops_settings?${sq}`, { supabaseUrl, serviceKey });
    const srow = sres.ok ? ((await sres.json()) as Array<Record<string, unknown>>)?.[0] : null;
    const noticeTo = normalizePhone(String(srow?.notice_phone ?? ""));
    const enabled = srow?.notify_enabled !== false;
    const nowF = new Date().toISOString();

    const recordNotice = async (fields: Record<string, unknown>) => {
      try {
        await db("service_fix_notices", {
          supabaseUrl,
          serviceKey,
          method: "POST",
          body: JSON.stringify({
            error_log_id: String(body.error_log_id ?? "").trim() || null,
            title,
            summary,
            source: String(body.notice_source ?? "auto").slice(0, 20),
            created_by: userId || null,
            ...fields,
          }),
        });
      } catch (e) {
        console.error("[fix_notice] 기록 실패", e instanceof Error ? e.message : e);
      }
    };

    if (!enabled) {
      await recordNotice({ status: "skipped", to_masked: "****", error_message: "통보 끄기 상태" });
      return json({ ok: false, error: "수정 통보가 꺼져 있습니다.", status: "skipped" }, 200);
    }
    if (!isKoreanMobile(noticeTo)) {
      await recordNotice({
        status: "failed",
        to_masked: "****",
        failed_at: nowF,
        error_message: "통보받을 연락처가 저장되어 있지 않습니다.",
      });
      return json(
        { ok: false, error: "통보받을 연락처가 저장되어 있지 않습니다.", status: "failed" },
        400,
      );
    }

    const text = `[JIMPICK 짐픽]\n수정 완료 통보\n${title}\n${summary}`;
    const sent = await sendViaAligo({
      to: noticeTo,
      text,
      title: "짐픽 수정 완료",
      msgType: text.length > 90 ? "LMS" : "SMS",
      aligoUserId: aligoUserId!,
      apiKey: apiKey!,
      sender,
      proxyUrl,
      proxySecret,
      viaProxy,
      userId: userId || "server",
       serviceNotice: true,
    });
    await recordNotice({
      to_masked: `****${last4(noticeTo)}`,
      status: sent.ok ? "accepted" : "failed",
      provider_message_id: sent.msgId ?? null,
      sent_at: sent.ok ? nowF : null,
      failed_at: sent.ok ? null : nowF,
      error_message: sent.ok ? null : (sent.error ?? "").slice(0, 500),
    });
    if (!sent.ok) {
      return json(
        { ok: false, error: sent.error ?? "문자 발송에 실패했습니다.", status: "failed" },
        502,
      );
    }
    return json({
      ok: true,
      msgId: sent.msgId ?? null,
      msgType: sent.msgType ?? "SMS",
      status: "accepted",
      recipientLast4: last4(noticeTo),
      sentAt: nowF,
    });
  }

  // ── 사장님 예약확정 알림 ──
  // 고객이 「동의하고 예약 확정」 저장에 성공한 뒤에만 우리 서버가 이 경로를 부릅니다.
  // 관리자 화면에서 실패한 알림을 다시 보낼 때도 같은 경로를 씁니다.
  if (body.mode === "manager_notify") {
    const tokenIn = String(body.token ?? "").trim();
    const estIn = String(body.estimate_id ?? "").trim();
    if (!tokenIn && !estIn) {
      return json({ ok: false, error: "알림을 보낼 견적서를 찾지 못했습니다." }, 400);
    }

    const tq = new URLSearchParams({
      select:
        "id,user_id,estimate_id,sheet_no,sheet_version,customer_name,contact_phone,move_date,total,sheet_snapshot",
      order: "sheet_version.desc",
      limit: "1",
      deleted_at: "is.null",
    });
    if (tokenIn) tq.set("access_token", `eq.${tokenIn}`);
    else tq.set("estimate_id", `eq.${estIn}`);
    const tres = await db(`estimate_terms?${tq}`, { supabaseUrl, serviceKey });
    if (!tres.ok) return json({ ok: false, error: "견적서를 불러오지 못했습니다." }, 500);
    const trow = ((await tres.json()) as Array<Record<string, unknown>>)?.[0];
    if (!trow) return json({ ok: false, error: "견적서를 찾지 못했습니다." }, 404);
    const ownerId = String(trow.user_id ?? "");
    if (!isServerCall && ownerId !== userId) {
      return json({ ok: false, error: "이 견적서의 알림을 보낼 권한이 없습니다." }, 403);
    }
    const managerCompany = await companySmsInfo(ownerId, supabaseUrl, serviceKey);
    if (!managerCompany.ok) return json({ ok: false, error: managerCompany.error }, 403);

    // 고객이 실제로 예약을 확정했는지 확인합니다 (확인란만 눌렀을 때는 보내지 않습니다)
    const aq = new URLSearchParams({
      select: "id,accepted,accepted_at,reservation_status",
      estimate_terms_id: `eq.${trow.id}`,
      limit: "1",
    });
    const ares = await db(`terms_acceptances?${aq}`, { supabaseUrl, serviceKey });
    const arow = ares.ok ? ((await ares.json()) as Array<Record<string, unknown>>)?.[0] : null;
    if (!arow || arow.accepted !== true) {
      return json(
        { ok: false, error: "고객의 예약 확정 기록이 없어 알림을 보내지 않았습니다." },
        400,
      );
    }

    const version = Number(trow.sheet_version ?? 1);
    const estimateIdM = String(trow.estimate_id ?? "");
    const idemKey = `manager-${estimateIdM}-v${version}`;

    // 같은 견적·같은 차수의 사장님 알림은 한 번만 나갑니다 (새로고침·중복 클릭 대비)
    const mq = new URLSearchParams({
      select: "id,status,provider_message_id,sent_at,msg_type",
      idempotency_key: `eq.${idemKey}`,
      delivery_method: "eq.manager_notification",
      status: "in.(queued,sent,success,accepted,delivered)",
      limit: "1",
    });
    const mres = await db(`estimate_deliveries?${mq}`, { supabaseUrl, serviceKey });
    if (mres.ok) {
      const done = ((await mres.json()) as Array<Record<string, unknown>>)?.[0];
      if (done) {
        return json({
          ok: true,
          alreadySent: true,
          msgId: done.provider_message_id ?? null,
          msgType: done.msg_type ?? "SMS",
          sentAt: done.sent_at ?? null,
          status: String(done.status ?? "accepted"),
          message: "사장님 알림은 이미 발송되었습니다.",
        });
      }
    }

    // 사장님 수신번호 — 설정 화면에 저장된 업체 연락처만 씁니다 (코드에 고정하지 않습니다)
    const pq = new URLSearchParams({ select: "phone,staff_phone", id: `eq.${ownerId}`, limit: "1" });
    const pres = await db(`profiles?${pq}`, { supabaseUrl, serviceKey });
    const prow = pres.ok ? ((await pres.json()) as Array<Record<string, unknown>>)?.[0] : null;
    const managerPhone =
      normalizePhone(String(prow?.phone ?? "")) || normalizePhone(String(prow?.staff_phone ?? ""));

    const nowM = new Date().toISOString();
    const record = async (fields: Record<string, unknown>) => {
      try {
        await db("estimate_deliveries", {
          supabaseUrl,
          serviceKey,
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates" },
          body: JSON.stringify({
            estimate_id: estimateIdM,
            estimate_version: version,
            sheet_no: trow.sheet_no ?? null,
            user_id: ownerId,
            delivery_method: "manager_notification",
            provider: "aligo",
            idempotency_key: idemKey,
            requested_at: nowM,
            ...fields,
          }),
        });
      } catch (e) {
        console.error("[manager_notify] 기록 실패", e instanceof Error ? e.message : e);
      }
    };

    if (!isKoreanMobile(managerPhone)) {
      await record({
        to_masked: "****",
        status: "failed",
        failed_at: nowM,
        error_code: "no_manager_phone",
        error_message: "업체 알림 수신번호 설정이 필요합니다",
      });
      return json(
        { ok: false, status: "failed", error: "업체 알림 수신번호 설정이 필요합니다" },
        400,
      );
    }

    // 문자 내용 — 이 견적서에 실제로 저장된 자료만 씁니다 (없는 줄은 아예 넣지 않습니다)
    let snapDraft: Record<string, unknown> = {};
    try {
      const snap = JSON.parse(String(trow.sheet_snapshot ?? "{}")) as {
        draft?: Record<string, unknown>;
      };
      snapDraft = snap?.draft ?? {};
    } catch {
      snapDraft = {};
    }
    const sv = (k: string) => String(snapDraft[k] ?? "").trim();
    const deposit = Number(snapDraft.deposit ?? 0) || 0;
    const wonM = (n: number) => `${Number(n || 0).toLocaleString("ko-KR")}원`;
    /** 기본주소 + 상세주소를 함께 표시합니다 */
    const fullAddr = (base: string, detail: string) => [base, detail].filter(Boolean).join(" ");
    const customerM = String(trow.customer_name ?? "").trim() || sv("customerName");
    const custPhone = String(trow.contact_phone ?? "").trim() || sv("phone");
    const fromFull = fullAddr(sv("fromAddress"), sv("fromDetail"));
    const toFull = fullAddr(sv("toAddress"), sv("toDetail"));
    const totalM = Number(trow.total ?? 0) || 0;
    const acceptedAtM = String(arow.accepted_at ?? "");
    let confirmedText = "";
    if (acceptedAtM) {
      const d = new Date(acceptedAtM);
      if (!Number.isNaN(d.getTime())) {
        // 사장님이 보는 시간은 한국 시간으로 표시합니다
        confirmedText = new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul",
          dateStyle: "medium",
          timeStyle: "short",
        }).format(d);
      }
    }
    // 값이 없는 항목은 줄 자체를 넣지 않습니다 (가짜 값 금지)
    const infoLines = (
      [
        ["고객명", customerM],
        ["연락처", custPhone],
        ["이사일", String(trow.move_date ?? "").trim()],
        ["출발지", fromFull],
        ["도착지", toFull],
        ["총 견적금액", totalM > 0 ? wonM(totalM) : ""],
        ["예약금", deposit > 0 ? wonM(deposit) : ""],
        ["견적번호", String(trow.sheet_no ?? "").trim() || estimateIdM],
        ["확정일시", confirmedText],
      ] as Array<[string, string]>
    )
      .filter(([, v]) => v !== "")
      .map(([k, v]) => `${k}: ${v}`);
    const textM = [
      "[JIMPICK 예약 확정]",
      "고객이 견적서를 확인하고 예약을 확정했습니다.",
      "",
      ...infoLines,
      "",
      "고객에게 연락하여 예약금을 확인해 주세요.",
    ].join("\n");
    // 글자 길이에 따라 SMS · LMS 로 나갑니다
    const msgTypeM = new TextEncoder().encode(textM).length <= 90 ? "SMS" : "LMS";

    const holdM = await reserveSms({
      userId: ownerId,
      key: `usage:${idemKey}`,
      supabaseUrl,
      serviceKey,
    });
    if (!holdM.ok) {
      if (holdM.duplicate) {
        return json({ ok: true, alreadySent: true, message: "이미 보낸 알림입니다." });
      }
      return json({ ok: false, error: holdM.error, status: "blocked" }, 403);
    }
    const sentM = await sendViaAligo({
      to: managerPhone,
      text: textM,
      title: "짐픽 예약 확정 알림",
      msgType: msgTypeM,
      aligoUserId: aligoUserId!,
      apiKey: apiKey!,
      sender: managerCompany.sender,
      companyId: ownerId,
      proxyUrl,
      proxySecret,
      viaProxy,
      userId: ownerId,
    });
    const doneAt = new Date().toISOString();
    await record({
      to_masked: `****${last4(managerPhone)}`,
      provider_message_id: sentM.msgId ?? null,
      msg_id: sentM.msgId ?? null,
      msg_type: sentM.msgType ?? msgTypeM,
      status: sentM.ok ? "accepted" : "failed",
      sent_at: sentM.ok ? doneAt : null,
      failed_at: sentM.ok ? null : doneAt,
      error_code: sentM.ok ? null : String(sentM.code ?? ""),
      error_message: sentM.ok ? null : (sentM.error ?? "").slice(0, 500),
      provider_result: sentM.raw ?? null,
    });
    if (!sentM.ok) {
      await releaseSms(ownerId, holdM.hold, supabaseUrl, serviceKey);
      return json(
        {
          ok: false,
          status: "failed",
          error: sentM.error ?? "사장님 알림 발송에 실패했습니다.",
          recipientLast4: last4(managerPhone),
        },
        502,
      );
    }
    await confirmSms(ownerId, holdM.hold, supabaseUrl, serviceKey);
    return json({
      ok: true,
      status: "accepted",
      msgId: sentM.msgId ?? null,
      msgType: sentM.msgType ?? msgTypeM,
      recipientLast4: last4(managerPhone),
      sentAt: doneAt,
    });
  }

  // ── 예약금 입금 확인 안내 문자 (고객에게) ──
  // 입금이 실제로 확인된 뒤에만, 견적서에 저장된 금액으로 보냅니다.
  if (body.mode === "deposit_notify") {
    const estIn = String(body.estimate_id ?? "").trim();
    if (!estIn) return json({ ok: false, error: "견적서를 찾지 못했습니다." }, 400);
    const dq = new URLSearchParams({
      select:
        "id,user_id,estimate_id,sheet_no,sheet_version,customer_name,move_date,contact_phone,company_phone,total,deposit_paid,access_token",
      estimate_id: `eq.${estIn}`,
      order: "sheet_version.desc",
      limit: "1",
      deleted_at: "is.null",
    });
    const dres = await db(`estimate_terms?${dq}`, { supabaseUrl, serviceKey });
    if (!dres.ok) return json({ ok: false, error: "견적서를 불러오지 못했습니다." }, 500);
    const drow = ((await dres.json()) as Array<Record<string, unknown>>)?.[0];
    if (!drow) return json({ ok: false, error: "견적서를 찾지 못했습니다." }, 404);
    const ownerD = String(drow.user_id ?? "");
    if (!isServerCall && ownerD !== userId) {
      return json({ ok: false, error: "이 견적서의 문자를 보낼 권한이 없습니다." }, 403);
    }
    const companyD = await companySmsInfo(ownerD, supabaseUrl, serviceKey);
    if (!companyD.ok) return json({ ok: false, error: companyD.error }, 403);
    const paidD = Number(drow.deposit_paid ?? 0) || 0;
    if (paidD <= 0) {
      return json({ ok: false, error: "확인된 입금 금액이 없어 문자를 보내지 않았습니다." }, 400);
    }
    // 같은 견적·같은 입금액으로는 안내 문자가 한 번만 나갑니다
    const idemD = `deposit-${estIn}-${paidD}`;
    const dq2 = new URLSearchParams({
      select: "id,status,provider_message_id,sent_at,msg_type",
      idempotency_key: `eq.${idemD}`,
      delivery_method: "eq.deposit_notification",
      status: "in.(queued,sent,success,accepted,delivered)",
      limit: "1",
    });
    const dres2 = await db(`estimate_deliveries?${dq2}`, { supabaseUrl, serviceKey });
    if (dres2.ok) {
      const doneD = ((await dres2.json()) as Array<Record<string, unknown>>)?.[0];
      if (doneD) {
        return json({
          ok: true,
          status: "already_sent",
          msgId: doneD.provider_message_id ?? null,
          msgType: doneD.msg_type ?? null,
          sentAt: doneD.sent_at ?? null,
          paid: paidD,
        });
      }
    }
    const custPhoneD = normalizePhone(String(drow.contact_phone ?? ""));
    if (!isKoreanMobile(custPhoneD)) {
      return json({ ok: false, error: "고객 휴대전화 번호를 확인해 주세요." }, 400);
    }
    const totalD = Number(drow.total ?? 0) || 0;
    const balanceD = Math.max(0, totalD - paidD);
    const wonD = (n: number) => `${Number(n || 0).toLocaleString("ko-KR")}원`;
    const tokenD = String(drow.access_token ?? "");
    const linkD =
      tokenD.length >= 8
        ? `${appUrl}/share/${encodeURIComponent(estIn)}?t=${encodeURIComponent(tokenD)}`
        : "";
    const companyPhoneD = companyD.companyPhone;
    const textD = [
      `[${companyD.companyName}]`,
      `${String(drow.customer_name ?? "고객").trim() || "고객"} 고객님, 예약금 입금이 확인되었습니다.`,
      "",
      `예약금(입금완료): ${wonD(paidD)}`,
      ...(totalD > 0 ? [`총 견적금액: ${wonD(totalD)}`, `잔금: ${wonD(balanceD)}`] : []),
      ...(linkD ? ["", "견적서 확인:", linkD] : []),
      ...(companyPhoneD ? ["", `문의: ${companyPhoneD}`] : []),
    ].join("\n");
    if (!linkD || !appUrl || !companyPhoneD || !String(drow.move_date ?? "").trim() || !String(drow.customer_name ?? "").trim()) return json({ ok: false, error: "고객 보안 링크 또는 업체 문의번호·고객·이사 날짜가 없어 발송하지 않았습니다." }, 400);
    const typeD = "MMS";
    const holdD = await reserveSms({
      userId: ownerD,
      key: `usage:${idemD}`,
      supabaseUrl,
      serviceKey,
    });
    if (!holdD.ok) {
      if (holdD.duplicate) {
        return json({ ok: true, alreadySent: true, message: "이미 보낸 문자입니다." });
      }
      return json({ ok: false, error: holdD.error, status: "blocked" }, 403);
    }
    const sentD = await sendViaAligo({
      to: custPhoneD,
      text: textD,
      title: "예약금 입금 확인",
      msgType: typeD,
      aligoUserId: aligoUserId!,
      apiKey: apiKey!,
      sender: companyD.sender,
      companyId: ownerD,
      cardType: "deposit",
      cardData: { companyName: companyD.companyName, customerName: String(drow.customer_name ?? "").trim(), moveDate: String(drow.move_date ?? "").trim(), amount: wonD(paidD), companyPhone: companyPhoneD },
      proxyUrl,
      proxySecret,
      viaProxy,
      userId: ownerD,
    });
    const atD = new Date().toISOString();
    try {
      await db("estimate_deliveries", {
        supabaseUrl,
        serviceKey,
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({
          estimate_id: estIn,
          estimate_version: Number(drow.sheet_version ?? 1),
          sheet_no: drow.sheet_no ?? null,
          user_id: ownerD,
          company_id: ownerD,
          to_masked: `****${last4(custPhoneD)}`,
          delivery_method: "deposit_notification",
          provider: "aligo",
          provider_message_id: sentD.msgId ?? null,
          msg_id: sentD.msgId ?? null,
          msg_type: sentD.msgType ?? typeD,
          status: sentD.ok ? "accepted" : "failed",
          requested_at: atD,
          sent_at: sentD.ok ? atD : null,
          failed_at: sentD.ok ? null : atD,
          error_code: sentD.ok ? null : String(sentD.code ?? ""),
          error_message: sentD.ok ? null : (sentD.error ?? "").slice(0, 500),
          idempotency_key: idemD,
          provider_result: sentD.raw ?? null,
        }),
      });
    } catch (e) {
      console.error("[deposit_notify] 기록 실패", e instanceof Error ? e.message : e);
    }
    if (!sentD.ok) {
      await releaseSms(ownerD, holdD.hold, supabaseUrl, serviceKey);
      return json(
        { ok: false, status: "failed", error: sentD.error ?? "입금 확인 문자 발송에 실패했습니다." },
        502,
      );
    }
    await confirmSms(ownerD, holdD.hold, supabaseUrl, serviceKey);
    return json({
      ok: true,
      status: "accepted",
      msgId: sentD.msgId ?? null,
      msgType: sentD.msgType ?? typeD,
      recipientLast4: last4(custPhoneD),
      sentAt: atD,
      paid: paidD,
      balance: balanceD,
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
      "id,user_id,estimate_id,sheet_no,sheet_version,customer_name,move_date,contact_phone,company_phone,total,access_token,sheet_snapshot",
    estimate_id: `eq.${estimateId}`,
    order: "sheet_version.desc",
    limit: "1",
    deleted_at: "is.null",
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
  const company = await companySmsInfo(userId, supabaseUrl, serviceKey);
  if (!company.ok) return json({ ok: false, error: company.error }, 403);
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
      status: "in.(queued,sent,success,accepted,delivered)",
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

  // 같은 견적서를 같은 번호로 방금 보냈다면 다시 보내지 않습니다 (2분 안).
  // 사장님이 확인창에서 「다시 발송」을 직접 누른 경우(resend)에만 새 발송을 만듭니다.
  const wantResend = body.resend === true;
  if (!wantResend) {
    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const rq = new URLSearchParams({
      select: "id,status,provider_message_id,sent_at,msg_type",
      estimate_id: `eq.${estimateId}`,
      to_masked: `eq.****${last4(phone)}`,
      status: "in.(queued,sent,success,accepted,delivered)",
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
  const companyPhone = company.companyPhone;
  if (!companyPhone || !String(row.move_date ?? "").trim() || !String(row.customer_name ?? "").trim() || Number(row.total ?? 0) <= 0) return json({ ok: false, error: "업체 문의번호·고객·이사 날짜·견적금액이 없어 발송하지 않았습니다." }, 400);
  const text = [
    `[${company.companyName}]`,
    `${customer} 고객님, 요청하신 이사 견적서가 도착했습니다.`,
    "아래 링크에서 견적서와 표준약관을 확인해 주세요.",
    "",
    link,
    ...(companyPhone ? ["", `문의: ${companyPhone}`] : []),
  ].join("\n");
  const msgType = "MMS";
  const title = `이사 견적서 ${String(row.sheet_no ?? "")}`.trim().slice(0, 44);

  const requestedAt = new Date().toISOString();

  // ── 5. 문자 사용량을 서버에서 확인·예약합니다 ──
  // 사장님이 「다시 발송」을 직접 누른 경우에는 새 1건으로 셉니다(1분 안 중복 클릭은 한 번만).
  const usageKey = wantResend
    ? `usage:${estimateId}:v${version}:${last4(phone)}:resend:${Math.floor(Date.now() / 60000)}`
    : `usage:${idem || `${estimateId}:v${version}:${last4(phone)}`}`;
  const hold = await reserveSms({ userId, key: usageKey, supabaseUrl, serviceKey });
  if (!hold.ok) {
    if (hold.duplicate) {
      return json({
        ok: true,
        alreadySent: true,
        recipientLast4: last4(phone),
        message: "이미 처리된 발송 요청입니다. 다시 보내지 않았습니다.",
      });
    }
    return json({ ok: false, error: hold.error, status: "blocked" }, 403);
  }

  // ── 6. 알리고에 실제로 보냅니다 (시험 모드 아님) ──
  const result = await sendViaAligo({
    to: phone,
    text,
    title,
    msgType,
    aligoUserId: aligoUserId!,
    apiKey: apiKey!,
    sender: company.sender,
    companyId: userId,
    cardType: "quote",
    cardData: { companyName: company.companyName, customerName: customer, moveDate: String(row.move_date ?? "").trim(), amount: `${Number(row.total ?? 0).toLocaleString("ko-KR")}원`, companyPhone },
    proxyUrl,
    proxySecret,
    viaProxy,
    userId,
  });

  // ── 7. 실제 시도를 그대로 기록합니다 (번호는 뒤 4자리만) ──
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
        company_id: userId,
        to_masked: `****${last4(phone)}`,
        delivery_method: method,
        provider: "aligo",
        provider_message_id: result.msgId ?? null,
        msg_id: result.msgId ?? null,
        msg_type: result.msgType ?? msgType,
        status: result.ok ? "accepted" : "failed",
        requested_at: requestedAt,
        sent_at: result.ok ? now : null,
        failed_at: result.ok ? null : now,
        error_code: result.ok ? null : String(result.code ?? ""),
        error_message: result.ok ? null : (result.error ?? "").slice(0, 500),
        idempotency_key: idem || null,
        provider_result: result.raw ?? null,
      }),
    });
  } catch (e) {
    console.error("[send-estimate-sms] 발송 기록 저장 실패", e instanceof Error ? e.message : e);
  }

  if (!result.ok) {
    // 실패는 무료 문자에서 차감하지 않습니다.
    await releaseSms(userId, hold.hold, supabaseUrl, serviceKey);
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

  await confirmSms(userId, hold.hold, supabaseUrl, serviceKey);
  return json({
    ok: true,
    msgId: result.msgId ?? null,
    msgType: result.msgType ?? msgType,
    successCount: result.successCount ?? 0,
    status: "accepted",
    customerName: customer,
    recipientLast4: last4(phone),
    requestedAt,
    sentAt: now,
  });
};

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    // 예상하지 못한 오류도 워커를 죽이지 않고, 사장님이 읽을 수 있는 문구로 답합니다.
    console.error("[send-estimate-sms] 처리 중 오류", e instanceof Error ? e.stack : e);
    return json(
      {
        ok: false,
        error: "문자 발송 중 오류가 났습니다. 잠시 후 다시 시도해 주세요.",
        status: "failed",
      },
      500,
    );
  }
});
