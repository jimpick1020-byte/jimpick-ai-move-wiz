/**
 * 알리고 발송결과 조회 (서버 전용).
 *
 * 알리고는 「접수」와 「통신사 전달 성공」을 따로 알려 줍니다.
 * 우리가 접수 응답만 받은 상태에서는 절대 「전달 완료」로 바꾸지 않고,
 * 이 조회로 실제 결과를 받아 왔을 때만 전달/실패로 바꿉니다.
 *
 * 조회를 하지 못했으면 unknown(결과 확인 필요)으로 남깁니다.
 */

const ALIGO_DETAIL = "https://apis.aligo.in/sms_list/";

export type ResultState = "delivered" | "failed" | "accepted" | "unknown";

export interface ResultLookup {
  state: ResultState;
  /** 알리고가 준 상태 문구 (개인정보·키는 담지 않습니다) */
  stateText?: string;
  errorCode?: string;
  /** 조회 자체가 실패한 이유 */
  lookupError?: string;
}

interface AligoDetailRow {
  mid?: string | number;
  msg_type?: string;
  sms_state?: string;
  reserve_state?: string;
  fail_count?: string | number;
  success_count?: string | number;
}

interface AligoDetail {
  result_code?: number | string;
  message?: string;
  list?: AligoDetailRow[];
}

/** 알리고 상태 문구를 우리 상태로 바꿉니다 */
function mapState(text: string, row?: AligoDetailRow): ResultState {
  const t = (text || "").trim();
  const fail = Number(row?.fail_count ?? 0) || 0;
  const success = Number(row?.success_count ?? 0) || 0;
  if (/실패|취소|반송/.test(t) || (fail > 0 && success === 0)) return "failed";
  if (/성공|전송완료|완료/.test(t) || success > 0) return "delivered";
  if (/접수|대기|전송중|예약/.test(t)) return "accepted";
  return "unknown";
}

/**
 * 발송번호(mid)로 실제 결과를 조회합니다.
 *
 * 중계 서버에 결과 조회 기능이 있으면 그쪽을 먼저 씁니다 (고정 IP).
 * 없으면 알리고에 바로 물어봅니다. 둘 다 안 되면 unknown 입니다.
 */
export async function lookupAligoResult(messageId: string): Promise<ResultLookup> {
  const mid = String(messageId ?? "").trim();
  if (!mid) return { state: "unknown", lookupError: "발송번호가 없습니다." };

  const apiKey = String(process.env["ALIGO_API_KEY"] ?? "").trim();
  const userId = String(process.env["ALIGO_USER_ID"] ?? "").trim();
  if (!apiKey || !userId) {
    return { state: "unknown", lookupError: "문자 발송 설정(알리고)이 필요합니다." };
  }

  const proxyUrl = String(process.env["SMS_PROXY_URL"] ?? "").trim();
  const proxySecret = String(process.env["JIMPICK_PROXY_SECRET"] ?? "").trim();

  // ① 중계 서버의 결과 조회 (배포되어 있을 때만 동작합니다)
  if (proxyUrl && proxySecret) {
    try {
      const r = await fetch(`${proxyUrl.replace(/\/$/, "")}/result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-jimpick-secret": proxySecret,
          "x-proxy-secret": proxySecret,
        },
        body: JSON.stringify({ mid }),
      });
      if (r.ok) {
        const j = (await r.json().catch(() => null)) as
          | { ok?: boolean; state?: string; stateText?: string }
          | null;
        if (j?.ok && j.state) {
          const state = ["delivered", "failed", "accepted", "unknown"].includes(j.state)
            ? (j.state as ResultState)
            : mapState(String(j.stateText ?? j.state));
          return { state, stateText: String(j.stateText ?? "").slice(0, 120) };
        }
      }
      // 404 등은 조용히 알리고 직접 조회로 넘어갑니다
    } catch {
      /* 중계 서버가 결과 조회를 아직 제공하지 않을 수 있습니다 */
    }
  }

  // ② 알리고에 직접 조회
  try {
    const form = new URLSearchParams();
    form.set("key", apiKey);
    form.set("user_id", userId);
    form.set("mid", mid);
    const r = await fetch(ALIGO_DETAIL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: form.toString(),
    });
    const j = (await r.json().catch(() => null)) as AligoDetail | null;
    if (!j) return { state: "unknown", lookupError: "발송 결과 응답을 읽지 못했습니다." };
    const code = Number(j.result_code ?? -1);
    if (code < 1) {
      return {
        state: "unknown",
        lookupError: `발송 결과 확인 실패 (코드 ${code})`,
        errorCode: String(code),
      };
    }
    const row = (j.list ?? [])[0];
    if (!row) return { state: "unknown", lookupError: "발송 결과가 아직 없습니다." };
    const text = String(row.sms_state ?? row.reserve_state ?? "");
    return { state: mapState(text, row), stateText: text.slice(0, 120) };
  } catch (e) {
    console.error("[reminder-result] lookup", e instanceof Error ? e.message : e);
    return { state: "unknown", lookupError: "발송 결과 조회 중 연결 오류가 났습니다." };
  }
}

/**
 * 결과가 확정되지 않은 전날 안내 문자들의 실제 결과를 갱신합니다.
 * 접수(accepted)·확인 필요(unknown) 상태만 다시 확인합니다.
 */
export async function refreshReminderResults(limit = 30): Promise<{
  ok: boolean;
  checked: number;
  delivered: number;
  failed: number;
  unknown: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("move_reminders")
    .select("id, provider_message_id, status, requested_at")
    .in("status", ["accepted", "unknown", "success"])
    .not("provider_message_id", "is", null)
    .is("delivered_at", null)
    .gte("requested_at", since)
    .order("requested_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) {
    console.error("[reminder-result] 목록 조회 실패", error.message);
    return { ok: false, checked: 0, delivered: 0, failed: 0, unknown: 0 };
  }

  let delivered = 0;
  let failed = 0;
  let unknown = 0;
  const rows = data ?? [];

  for (const raw of rows) {
    const row = raw as { id: string; provider_message_id: string | null };
    const out = await lookupAligoResult(String(row.provider_message_id ?? ""));
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      last_checked_at: now,
      provider_response: {
        checked_at: now,
        state: out.state,
        state_text: out.stateText ?? null,
        lookup_error: out.lookupError ?? null,
      },
    };
    if (out.state === "delivered") {
      delivered++;
      patch["status"] = "delivered";
      patch["delivered_at"] = now;
      patch["error_reason"] = null;
    } else if (out.state === "failed") {
      failed++;
      patch["status"] = "failed";
      patch["failed_at"] = now;
      patch["error_reason"] = `통신사 전달 실패${out.stateText ? ` (${out.stateText})` : ""}`;
    } else if (out.state === "accepted") {
      patch["status"] = "accepted";
    } else {
      unknown++;
      patch["status"] = "unknown";
      patch["error_reason"] = out.lookupError ?? "발송 결과를 확인하지 못했습니다.";
    }
    await supabaseAdmin
      .from("move_reminders")
      .update(patch as never)
      .eq("id", row.id);
  }

  return { ok: true, checked: rows.length, delivered, failed, unknown };
}
