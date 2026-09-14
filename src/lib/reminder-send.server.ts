/**
 * 이사 전날 안내 문자 실제 발송 (서버 전용).
 *
 * 크론이 부르는 /api/public/hooks/send-move-reminders 에서만 씁니다.
 * 알리고 키·중계 비밀값은 이 파일 안에서만 읽고, 응답·기록에 남기지 않습니다.
 * 알리고가 접수(result_code >= 1)했다고 답한 경우에만 성공으로 기록합니다.
 */

const ALIGO_ENDPOINT = "https://apis.aligo.in/send/";
/** 발신번호는 서버에 고정되어 있습니다 (기존 문자발송 기능과 동일) */
const SENDER = "01075662542";

interface Reminder {
  id: string;
  estimate_id: string;
  customer_name: string;
  customer_phone: string;
  move_date: string;
  start_time: string | null;
  from_address: string | null;
  company_phone: string | null;
  retry_count: number;
}

interface AligoResponse {
  result_code?: number | string;
  message?: string;
  msg_id?: string | number;
  msg_type?: string;
}

function isKoreanMobile(d: string): boolean {
  return /^01[016789][0-9]{7,8}$/.test(d);
}

function last4(d: string): string {
  return d.length >= 4 ? d.slice(-4) : "";
}

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
  return `${known[code] ?? "문자 발송에 실패했습니다."} / 알리고 안내: ${raw || "(내용 없음)"} / 코드 ${code}`;
}

/** 안내 문자 내용 — 값이 없는 줄은 넣지 않습니다 */
export function reminderText(r: {
  customer_name: string;
  move_date: string;
  start_time: string | null;
  from_address: string | null;
  company_phone: string | null;
}): string {
  const lines: string[] = [
    "[JIMPICK 짐픽]",
    `${(r.customer_name || "고객").trim()} 고객님, 내일은 예약하신 이사일입니다.`,
    "",
  ];
  if (r.move_date) lines.push(`이사일: ${r.move_date}`);
  if (r.start_time) lines.push(`시작 시간: ${r.start_time}`);
  if (r.from_address) lines.push(`출발지: ${r.from_address}`);
  lines.push("", "일정이나 현장 조건이 변경된 경우 연락해 주세요.");
  if (r.company_phone) lines.push(`문의: ${r.company_phone}`);
  return lines.join("\n");
}

interface SendOutcome {
  ok: boolean;
  msgId?: string;
  msgType?: string;
  error?: string;
  code?: number;
}

async function sendViaAligo(v: {
  to: string;
  text: string;
  title: string;
  msgType: string;
  aligoUserId: string;
  apiKey: string;
  proxyUrl?: string;
  proxySecret?: string;
}): Promise<SendOutcome> {
  const viaProxy = !!(v.proxyUrl && v.proxySecret);
  try {
    if (viaProxy) {
      // 알리고 /send/ 는 form-urlencoded 만 받습니다
      const params = new URLSearchParams();
      params.set("key", v.apiKey);
      params.set("user_id", v.aligoUserId);
      params.set("sender", SENDER);
      params.set("receiver", v.to);
      params.set("msg", v.text);
      if (v.msgType === "LMS") {
        params.set("msg_type", "LMS");
        params.set("title", v.title);
      }
      const r = await fetch(`${v.proxyUrl!.replace(/\/$/, "")}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-proxy-secret": String(v.proxySecret ?? "").trim(),
        },
        body: params.toString(),
      });
      if (r.status === 401 || r.status === 403) {
        return { ok: false, code: r.status, error: "문자 중계 서버가 요청을 거절했습니다(인증 실패)." };
      }
      const data = (await r.json().catch(() => null)) as AligoResponse | null;
      if (!data) {
        return { ok: false, code: r.status, error: `중계 서버 응답을 읽지 못했습니다. (${r.status})` };
      }
      const code = Number(data.result_code ?? -1);
      if (code >= 1) {
        return {
          ok: true,
          msgId: data.msg_id != null ? String(data.msg_id) : undefined,
          msgType: data.msg_type || v.msgType,
          code,
        };
      }
      return { ok: false, code, error: aligoError(code, data.message ?? "") };
    }

    const form = new FormData();
    form.append("user_id", v.aligoUserId);
    form.append("key", v.apiKey);
    form.append("sender", SENDER);
    form.append("receiver", v.to);
    form.append("msg", v.text);
    form.append("msg_type", v.msgType);
    form.append("title", v.title);
    const r = await fetch(ALIGO_ENDPOINT, { method: "POST", body: form });
    const data = (await r.json().catch(() => null)) as AligoResponse | null;
    if (!data) return { ok: false, error: "알리고 응답을 읽지 못했습니다." };
    const code = Number(data.result_code ?? -1);
    if (code >= 1) {
      return {
        ok: true,
        msgId: data.msg_id != null ? String(data.msg_id) : undefined,
        msgType: data.msg_type || v.msgType,
        code,
      };
    }
    return { ok: false, code, error: aligoError(code, data.message ?? "") };
  } catch (e) {
    console.error("[move-reminders] 발송 오류", e instanceof Error ? e.message : e);
    return { ok: false, error: "문자 발송 중 연결 오류가 났습니다." };
  }
}

export interface RunResult {
  ok: boolean;
  picked: number;
  sent: number;
  failed: number;
  error?: string;
}

/**
 * 보낼 차례가 된 안내 문자를 집어 실제로 보냅니다.
 *
 * 여러 번 동시에 불려도 데이터베이스가 잠금(FOR UPDATE SKIP LOCKED)으로
 * 한 건을 한 번만 넘겨 주므로 같은 문자가 두 번 나가지 않습니다.
 */
export async function runDueMoveReminders(limit = 20): Promise<RunResult> {
  const aligoUserId = String(process.env["ALIGO_USER_ID"] ?? "").trim();
  const apiKey = String(process.env["ALIGO_API_KEY"] ?? "").trim();
  const proxyUrl = process.env["SMS_PROXY_URL"];
  const proxySecret = process.env["JIMPICK_PROXY_SECRET"];
  if (!aligoUserId || !apiKey) {
    return { ok: false, picked: 0, sent: 0, failed: 0, error: "문자 발송 설정(알리고)이 필요합니다." };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = supabaseAdmin as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: Reminder[] | null; error: { message: string } | null }>;
  };
  const { data: claimed, error: claimErr } = await rpc.rpc("claim_move_reminders", { _limit: limit });
  if (claimErr) {
    console.error("[move-reminders] 예약을 집어 오지 못했습니다", claimErr.message);
    return { ok: false, picked: 0, sent: 0, failed: 0, error: "예약을 불러오지 못했습니다." };
  }
  const rows = claimed ?? [];
  if (!rows.length) return { ok: true, picked: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const to = String(row.customer_phone ?? "").replace(/[^0-9]/g, "");
    const now = new Date().toISOString();

    if (!isKoreanMobile(to)) {
      failed++;
      await supabaseAdmin
        .from("move_reminders")
        .update({
          status: "failed",
          error_reason: "고객 휴대전화번호 형식이 올바르지 않습니다.",
          retry_count: Number(row.retry_count ?? 0) + 1,
        } as never)
        .eq("id", row.id);
      continue;
    }

    const text = reminderText(row);
    // 90바이트를 넘으면 자동으로 장문(LMS)으로 보냅니다
    const msgType = new TextEncoder().encode(text).length > 90 ? "LMS" : "SMS";

    const out = await sendViaAligo({
      to,
      text,
      title: "이사 하루 전 안내",
      msgType,
      aligoUserId,
      apiKey,
      proxyUrl,
      proxySecret,
    });

    if (out.ok) sent++;
    else failed++;

    await supabaseAdmin
      .from("move_reminders")
      .update(
        (out.ok
          ? {
              status: "success",
              sent_at: now,
              aligo_message_id: out.msgId ?? null,
              error_reason: null,
            }
          : {
              status: "failed",
              error_reason: (out.error ?? "문자 발송에 실패했습니다.").slice(0, 500),
              retry_count: Number(row.retry_count ?? 0) + 1,
            }) as never,
      )
      .eq("id", row.id);

    // 발송 이력에도 남깁니다 (전체 번호는 남기지 않습니다)
    const { error: logErr } = await supabaseAdmin.from("estimate_deliveries").insert({
      estimate_id: row.estimate_id,
      to_masked: `****${last4(to)}`,
      delivery_method: "move_reminder",
      provider: "aligo",
      provider_message_id: out.msgId ?? null,
      msg_id: out.msgId ?? null,
      msg_type: out.msgType ?? msgType,
      status: out.ok ? "sent" : "failed",
      requested_at: now,
      sent_at: out.ok ? now : null,
      failed_at: out.ok ? null : now,
      error_code: out.ok ? null : String(out.code ?? ""),
      error_message: out.ok ? null : (out.error ?? "").slice(0, 500),
      idempotency_key: `move-reminder-${row.id}`,
    } as never);
    if (logErr) console.error("[move-reminders] 이력 기록 실패", logErr.message);
  }

  return { ok: true, picked: rows.length, sent, failed };
}
