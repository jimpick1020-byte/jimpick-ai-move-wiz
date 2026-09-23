/**
 * 이사 전날 안내 문자 실제 발송 (서버 전용).
 *
 * 크론이 부르는 /api/public/hooks/send-move-reminders 와
 * 사장님의 「다시 발송」에서만 씁니다.
 *
 * 알리고 키·중계 비밀값은 이 파일 안에서만 읽고, 응답·기록에 남기지 않습니다.
 * 알리고가 접수(result_code >= 1)했다고 답하면 accepted(문자업체 접수)로만 기록하고,
 * 통신사 전달 완료는 발송결과 조회(reminder-result.server.ts)로 확인한 뒤에만 표시합니다.
 */


interface Reminder {
  id: string;
  estimate_id: string;
  estimate_terms_id: string | null;
  company_id: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  move_date: string;
  start_time: string | null;
  from_address: string | null;
  to_address: string | null;
  company_phone: string | null;
  retry_count: number;
  view_token: string | null;
  auto_retried?: boolean;
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

/** 다시 시도해도 될 오류인지 (설정을 고쳐야 하는 오류는 자동 재시도하지 않습니다) */
function isRetryable(code?: number, message?: string): boolean {
  if (code === undefined || code === null) return /연결|네트워크|시간/.test(message ?? "");
  if (code === 0 || code === -1) return true;
  if (code === 401 || code === 403) return false;
  if (code >= 500) return true;
  return false;
}

function aligoError(code: number, message: string): string {
  const raw = (message || "").trim();
  const known: Record<number, string> = {
    [-101]: "알리고 API 인증정보(user_id/API Key)를 확인해 주세요.",
    [-102]: "등록되지 않은 발신번호입니다. 알리고에서 발신번호 사전등록을 마쳐 주세요.",
    [-103]: "발송 요청 형식이 올바르지 않습니다.",
    [-111]: "문자 잔액이 부족합니다. 알리고에서 충전해 주세요.",
    [-201]: "문자 보유건수가 부족합니다. 알리고에서 충전해 주세요.",
    [-301]: "등록되지 않은 발송 IP 입니다. 알리고에 발송 서버 IP 를 등록해 주세요.",
  };
  return `${known[code] ?? "문자 발송에 실패했습니다."} / 알리고 안내: ${raw || "(내용 없음)"} / 코드 ${code}`;
}

/** 주소를 너무 길지 않게 줄입니다 (동·건물명 정도까지) */
function shortAddress(v: string | null): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

/** 안내 문자 내용 — 값이 없는 줄은 넣지 않습니다 */
export function reminderText(r: {
  company_name?: string;
  customer_name: string;
  start_time: string | null;
  from_address: string | null;
  to_address: string | null;
  company_phone: string | null;
  link?: string | null;
}): string {
  const lines: string[] = [
    `[${r.company_name || "업체 정보가 필요합니다"}]`,
    "",
    `${(r.customer_name || "고객").trim()} 고객님, 내일은 예약하신 이사일입니다.`,
    "",
  ];
  if (r.start_time) lines.push(`이사 예정 시간: ${r.start_time}`);
  const from = shortAddress(r.from_address);
  if (from) lines.push(`출발지: ${from}`);
  const to = shortAddress(r.to_address);
  if (to) lines.push(`도착지: ${to}`);
  lines.push("", "원활한 이사를 위해 귀중품과 개인 소지품을 미리 확인해 주세요.");
  if (r.link) lines.push("", "이사 내용 확인:", r.link);
  if (r.company_phone) lines.push("", `문의: ${r.company_phone}`);
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
  sender: string;
  companyId: string;
  cardData: { companyName: string; customerName: string; moveDate: string; amount: string; companyPhone: string };
}): Promise<SendOutcome> {
  const viaProxy = !!(v.proxyUrl && v.proxySecret);
  try {
    if (viaProxy) {
      const health = await fetch(`${v.proxyUrl?.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(6000) });
      const capability = (await health.json().catch(() => null)) as { service?: string; capabilities?: string[] } | null;
      if (!health.ok || capability?.service !== "aligo-sms-proxy" || !capability.capabilities?.includes("sms-cards-v1")) {
        return { ok: false, error: "그림문자 중계 서버가 아직 새 버전이 아니어서 발송하지 않았습니다." };
      }
      const r = await fetch(`${v.proxyUrl?.replace(/\/$/, "")}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-jimpick-secret": String(v.proxySecret ?? "").trim(),
        },
        body: JSON.stringify({ to: v.to, text: v.text, title: v.title, companyId: v.companyId, userId: v.companyId, cardType: "reminder", cardData: v.cardData }),
      });
      if (r.status === 401 || r.status === 403) {
        return { ok: false, code: r.status, error: r.status === 403 ? "업체의 승인된 발신번호가 없거나 업체 정보가 일치하지 않습니다." : "문자 중계 서버가 요청을 거절했습니다(인증 실패)." };
      }
      const data = (await r.json().catch(() => null)) as (AligoResponse & { ok?: boolean; error?: string }) | null;
      if (!data) {
        return { ok: false, code: r.status, error: `중계 서버 응답을 읽지 못했습니다. (${r.status})` };
      }
      const code = Number(data.result_code ?? -1);
      if (r.ok && data.ok === true && code === 1) {
        return {
          ok: true,
          msgId: data.msg_id != null ? String(data.msg_id) : undefined,
          msgType: data.msg_type || v.msgType,
          code,
        };
      }
      return { ok: false, code, error: data.error ?? aligoError(code, data.message ?? "") };
    }

    return { ok: false, error: "그림문자 중계 서버가 준비되지 않아 발송하지 않았습니다." };
  } catch (e) {
    console.error("[move-reminders] 발송 오류", e instanceof Error ? e.message : e);
    return { ok: false, error: "문자 발송 중 연결 오류가 났습니다." };
  }
}

/** 이 예약에 넣을 고객 확인 링크 (기존 견적 보안 링크 + 확인 토큰) */
async function customerLink(row: Reminder): Promise<string | null> {
  const base = String(process.env["PUBLIC_APP_URL"] ?? "").trim().replace(/\/$/, "");
  if (!base || !row.view_token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let token: string | null = null;
  if (row.estimate_terms_id) {
    const { data } = await supabaseAdmin
      .from("estimate_terms")
      .select("access_token")
      .eq("id", row.estimate_terms_id)
      .is("deleted_at", null)
      .maybeSingle();
    token = (data as { access_token?: string } | null)?.access_token ?? null;
    // 연결된 계약이 삭제되거나 링크가 폐기된 경우 다른 버전으로 우회하지 않습니다.
    if (!token) return null;
  }
  if (!token) {
    const { data } = await supabaseAdmin
      .from("estimate_terms")
      .select("access_token")
      .eq("estimate_id", row.estimate_id)
      .eq("user_id", row.company_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    token = (data as { access_token?: string } | null)?.access_token ?? null;
  }
  if (!token) return null;
  return `${base}/share/${encodeURIComponent(row.estimate_id)}?t=${encodeURIComponent(token)}&rm=${encodeURIComponent(row.view_token)}`;
}

interface Creds {
  aligoUserId: string;
  apiKey: string;
  proxyUrl?: string;
  proxySecret?: string;
}

function readCreds(): Creds | null {
  const aligoUserId = String(process.env["ALIGO_USER_ID"] ?? "").trim();
  const apiKey = String(process.env["ALIGO_API_KEY"] ?? "").trim();
  if (!aligoUserId || !apiKey) return null;
  return {
    aligoUserId,
    apiKey,
    proxyUrl: process.env["SMS_PROXY_URL"],
    proxySecret: process.env["JIMPICK_PROXY_SECRET"],
  };
}

/** 한 건을 실제로 보내고 결과를 저장합니다. 성공하면 accepted(접수 완료)입니다. */
async function sendOne(
  row: Reminder,
  creds: Creds,
  /** 같은 건을 한 번 더 보낼 때 중복으로 막히지 않도록 쓰는 시도 구분값 */
  attempt?: string,
): Promise<{ sent: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const to = String(row.customer_phone ?? "").replace(/[^0-9]/g, "");
  const now = new Date().toISOString();

  if (!isKoreanMobile(to)) {
    await supabaseAdmin
      .from("move_reminders")
      .update({
        status: "failed",
        failed_at: now,
        error_code: "invalid_phone",
        error_reason: "고객 휴대전화번호 형식이 올바르지 않습니다.",
        retry_count: Number(row.retry_count ?? 0) + 1,
      } as never)
      .eq("id", row.id);
    return { sent: false };
  }

  const link = await customerLink(row);
  const [{ data: profile, error: profileErr }, { data: senderRow, error: senderErr }] = await Promise.all([
    supabaseAdmin.from("profiles").select("company_name,phone").eq("id", row.company_id).maybeSingle(),
    supabaseAdmin.from("company_sms_senders").select("sender_number").eq("company_id", row.company_id).eq("provider", "aligo").maybeSingle(),
  ]);
  const companyName = String(profile?.company_name ?? "").trim();
  const sender = String(senderRow?.sender_number ?? "").trim();
  const companyPhone = String(profile?.phone ?? "").trim();
  const setupError = profileErr || senderErr
    ? "업체 발신정보를 확인하지 못했습니다."
    : !companyName ? "업체 정보가 필요합니다." : !/^0[0-9]{8,10}$/.test(sender)
      ? "알리고 승인 발신번호가 등록되지 않았습니다." : !companyPhone || !row.move_date || !row.customer_name
        ? "업체 문의번호 또는 고객 이사 정보가 없습니다." : !link ? "고객 보안 링크를 확인하지 못했습니다." : null;
  if (setupError) {
    await supabaseAdmin.from("move_reminders").update({ status: "failed", failed_at: now, error_code: "sender_setup", error_reason: setupError } as never).eq("id", row.id);
    return { sent: false };
  }
  const text = reminderText({ ...row, company_name: companyName, company_phone: companyPhone, link });
  const msgType = "MMS";
  const sendArgs = { to, text, title: "이사 하루 전 안내", msgType, ...creds, sender, companyId: row.company_id,
    cardData: { companyName, customerName: row.customer_name, moveDate: row.move_date, amount: "", companyPhone } };

  // 무료 문자 사용량을 서버에서 먼저 예약합니다 (기간 만료면 보내지 않습니다).
  const attemptTag = attempt ?? String(Number(row.retry_count ?? 0));
  const usageKey = `usage:move-reminder:${row.id}:${attemptTag}`;
  const { data: reserved } = (await (
    supabaseAdmin as unknown as {
      rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: Record<string, unknown> | null }>;
    }
  ).rpc("reserve_free_sms", { _user_id: row.user_id, _key: usageKey, _count: 1 })) ?? { data: null };
  if (reserved?.["allowed"] !== true) {
    const reason =
      reserved?.["reason"] === "duplicate"
        ? "이미 처리된 발송 요청입니다."
        : "무료체험이 종료되었습니다. 구독 후 다시 발송할 수 있습니다.";
    await supabaseAdmin
      .from("move_reminders")
      .update({
        status: "failed",
        failed_at: now,
        error_code: String(reserved?.["reason"] ?? "quota"),
        error_reason: reason,
        retry_count: Number(row.retry_count ?? 0) + 1,
      } as never)
      .eq("id", row.id);
    return { sent: false };
  }

  await supabaseAdmin
    .from("move_reminders")
    .update({ requested_at: now, message_snapshot: text, message_type: msgType } as never)
    .eq("id", row.id);

  let out = await sendViaAligo(sendArgs);

  // 네트워크·서버 오류만 한 번 더 시도합니다 (설정 오류는 다시 보내지 않습니다)
  let autoRetried = row.auto_retried === true;
  if (!out.ok && !autoRetried && isRetryable(out.code, out.error)) {
    autoRetried = true;
    out = await sendViaAligo(sendArgs);
  }

  // 실패는 무료 문자에서 차감하지 않습니다.
  const usageRpc = supabaseAdmin as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<unknown>;
  };
  try {
    await usageRpc.rpc(out.ok ? "confirm_free_sms" : "release_free_sms", {
      _user_id: row.user_id,
      _key: usageKey,
    });
  } catch (e) {
    console.error("[move-reminders] 사용량 정리 실패", e instanceof Error ? e.message : e);
  }

  await supabaseAdmin
    .from("move_reminders")
    .update(
      (out.ok
        ? {
            // 접수까지만 확인된 상태입니다. 전달 완료는 결과 조회로만 바꿉니다.
            status: "accepted",
            accepted_at: now,
            sent_at: now,
            provider_message_id: out.msgId ?? null,
            aligo_message_id: out.msgId ?? null,
            message_type: out.msgType ?? msgType,
            to_masked: `010-****-${last4(to)}`,
            error_reason: null,
            error_code: null,
            failed_at: null,
            missed_reason: null,
            auto_retried: autoRetried,
            provider_response: { accepted_at: now, result_code: out.code ?? null },
          }
        : {
            status: "failed",
            failed_at: now,
            error_code: out.code != null ? String(out.code) : "send_error",
            error_reason: (out.error ?? "문자 발송에 실패했습니다.").slice(0, 500),
            retry_count: Number(row.retry_count ?? 0) + 1,
            auto_retried: autoRetried,
            to_masked: `010-****-${last4(to)}`,
            provider_response: { failed_at: now, result_code: out.code ?? null },
          }) as never,
    )
    .eq("id", row.id);

  // 발송 이력에도 남깁니다 (전체 번호는 남기지 않습니다)
  const { error: logErr } = await supabaseAdmin.from("estimate_deliveries").insert({
    estimate_id: row.estimate_id,
    user_id: row.company_id,
    company_id: row.company_id,
    to_masked: `010-****-${last4(to)}`,
    delivery_method: "move_reminder",
    provider: "aligo",
    provider_message_id: out.msgId ?? null,
    msg_id: out.msgId ?? null,
    msg_type: out.msgType ?? msgType,
    status: out.ok ? "accepted" : "failed",
    requested_at: now,
    sent_at: out.ok ? now : null,
    failed_at: out.ok ? null : now,
    error_code: out.ok ? null : String(out.code ?? ""),
    error_message: out.ok ? null : (out.error ?? "").slice(0, 500),
    idempotency_key: `move-reminder-${row.id}-${attemptTag}`,
  } as never);
  if (logErr) console.error("[move-reminders] 이력 기록 실패", logErr.message);

  return { sent: out.ok };
}

export interface RunResult {
  ok: boolean;
  picked: number;
  sent: number;
  failed: number;
  error?: string;
}

/** 작업이 돌았다는 기록을 남깁니다 (0건인 날도 남깁니다) */
async function logJobRun(v: {
  job: string;
  picked?: number;
  sent?: number;
  failed?: number;
  missed?: number;
  checked?: number;
  note?: string;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("reminder_job_runs").insert({
      job: v.job,
      picked: v.picked ?? 0,
      sent: v.sent ?? 0,
      failed: v.failed ?? 0,
      missed: v.missed ?? 0,
      checked: v.checked ?? 0,
      note: v.note ?? null,
    } as never);
  } catch (e) {
    console.error("[move-reminders] 작업기록 실패", e instanceof Error ? e.message : e);
  }
}

/**
 * 보낼 차례가 된 안내 문자를 집어 실제로 보냅니다.
 *
 * 여러 번 동시에 불려도 데이터베이스가 잠금(FOR UPDATE SKIP LOCKED)으로
 * 한 건을 한 번만 넘겨 주므로 같은 문자가 두 번 나가지 않습니다.
 */
export async function runDueMoveReminders(limit = 20): Promise<RunResult> {
  const creds = readCreds();
  if (!creds) {
    await logJobRun({ job: "send", note: "문자 발송 설정(알리고)이 없어 실행하지 못했습니다." });
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
    await logJobRun({ job: "send", note: "예약을 불러오지 못했습니다." });
    return { ok: false, picked: 0, sent: 0, failed: 0, error: "예약을 불러오지 못했습니다." };
  }
  const rows = claimed ?? [];
  if (!rows.length) {
    await logJobRun({ job: "send", note: "보낼 차례가 된 안내 문자가 없습니다." });
    return { ok: true, picked: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const r = await sendOne(row, creds);
    if (r.sent) sent++;
    else failed++;
  }

  await logJobRun({ job: "send", picked: rows.length, sent, failed });
  return { ok: true, picked: rows.length, sent, failed };
}

/** 사장님의 「다시 발송」 — 지금 한 건만 즉시 보냅니다 */
export async function resendReminderNow(
  id: string,
  companyId: string,
): Promise<{ ok: boolean; error?: string }> {
  const creds = readCreds();
  if (!creds) return { ok: false, error: "문자 발송 설정(알리고)이 필요합니다." };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // 잠금: 처리 중으로 바꾸는 데 성공한 요청만 실제로 보냅니다 (중복 클릭 차단)
  const { data: locked, error } = await supabaseAdmin
    .from("move_reminders")
    .update({ status: "processing", processing_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("company_id", companyId)
    .in("status", ["scheduled", "failed", "unknown", "canceled", "accepted", "delivered", "success"])
    .select(
      "id, estimate_id, estimate_terms_id, company_id, user_id, customer_name, customer_phone, move_date, start_time, from_address, to_address, company_phone, retry_count, view_token, auto_retried",
    )
    .maybeSingle();
  if (error || !locked) {
    return { ok: false, error: "지금 발송 중이거나 예약을 찾지 못했습니다." };
  }
  // 「다시 발송」은 매번 새로운 시도로 보냅니다 (이미 보낸 건도 중복으로 막히지 않게)
  const out = await sendOne(
    locked as unknown as Reminder,
    creds,
    `resend-${Date.now().toString(36)}`,
  );
  return out.sent ? { ok: true } : { ok: false, error: "문자 발송에 실패했습니다. 실패 사유를 확인해 주세요." };
}

/**
 * 누락 점검 (한국시간 18:10).
 *
 * 내일 이사 예정인 확정 계약 중 전날 안내 문자가 만들어지지 않았거나
 * 아직 보내지지 않은 건을 찾아 한 번만 다시 처리합니다.
 * 실패를 성공으로 바꾸지 않습니다.
 */
export async function sweepMissedReminders(): Promise<{
  ok: boolean;
  candidates: number;
  repaired: number;
  missed: number;
  sent: number;
  failed: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // 한국시간 기준 '내일' 날짜
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const tomorrow = new Date(kstNow.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: terms } = await supabaseAdmin
    .from("estimate_terms")
    .select("id, estimate_id, user_id, move_date, deleted_at")
    .eq("move_date", tomorrow)
    .is("deleted_at", null);

  const list = (terms ?? []) as { id: string; estimate_id: string }[];
  let repaired = 0;
  let missed = 0;

  for (const t of list) {
    const { data: rem } = await supabaseAdmin
      .from("move_reminders")
      .select("id, status")
      .eq("estimate_terms_id", t.id)
      .maybeSingle();
    const status = String((rem as { status?: string } | null)?.status ?? "");
    // 처리 중으로 멈춘 건은 아래 claim_move_reminders 가 한 번만 다시 집어 갑니다.
    if (["accepted", "delivered", "success"].includes(status)) continue;
    if (status === "canceled") continue;
    if (["processing", "sending"].includes(status)) continue;

    // 예약이 없거나 아직 발송 예정이면 다시 만들어 즉시 보낼 수 있게 합니다
    const { syncMoveReminder } = await import("./reminder.server");
    const r = await syncMoveReminder(t.id);
    if (r.ok && (r.action === "created" || r.action === "updated")) repaired++;
    else if (!rem) missed++;
  }

  const run = await runDueMoveReminders(50);
  await logJobRun({
    job: "sweep",
    picked: list.length,
    sent: run.sent,
    failed: run.failed,
    missed,
    note: `내일(${tomorrow}) 확정 계약 ${list.length}건 점검 · 다시 예약 ${repaired}건`,
  });

  return {
    ok: true,
    candidates: list.length,
    repaired,
    missed,
    sent: run.sent,
    failed: run.failed,
  };
}

/** 발송결과 조회 실행 + 작업기록 */
export async function checkReminderResults(limit = 30) {
  const { refreshReminderResults } = await import("./reminder-result.server");
  const out = await refreshReminderResults(limit);
  await logJobRun({
    job: "result-check",
    checked: out.checked,
    note: `전달 ${out.delivered} · 실패 ${out.failed} · 확인필요 ${out.unknown}`,
  });
  return out;
}
