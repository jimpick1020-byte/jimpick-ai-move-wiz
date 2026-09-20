/**
 * 수정 통보 보내기 (서버 전용)
 *
 * 오류가 났을 때는 관리자를 부르지 않고 조용히 기록만 남깁니다.
 * 고쳐진 뒤에 「이런 문제를 이렇게 고쳤습니다」 한 통만 관리자 연락처로 보냅니다.
 *
 * 문자 보내는 열쇠는 발송 서버에만 있고 이 파일에는 들어오지 않습니다.
 */

export interface FixNoticeInput {
  /** 무엇을 고쳤는지 한 줄 제목 */
  title: string;
  /** 어떤 문제였고 어떻게 고쳤는지 */
  summary: string;
  /** 이어지는 오류 기록 (있을 때만) */
  errorLogId?: string | null;
  /** auto · manual */
  source?: string;
}

export interface FixNoticeResult {
  ok: boolean;
  status?: string;
  msgId?: string | null;
  recipientLast4?: string;
  error?: string;
}

/** 발송 서버(send-estimate-sms)의 수정 통보 경로를 부릅니다 */
export async function sendFixNoticeSms(input: FixNoticeInput): Promise<FixNoticeResult> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    return { ok: false, error: "발송 서버 설정이 없어 통보를 보내지 못했습니다." };
  }
  const serverSecret = (process.env["JIMPICK_PROXY_SECRET"] ?? "").trim();
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/functions/v1/send-estimate-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(serverSecret ? { "x-jimpick-server": serverSecret } : {}),
      },
      body: JSON.stringify({
        mode: "fix_notice",
        notice_title: input.title,
        notice_summary: input.summary,
        error_log_id: input.errorLogId ?? null,
        notice_source: input.source ?? "auto",
      }),
    });
    const body = (await r.json().catch(() => null)) as FixNoticeResult | null;
    if (!r.ok || !body?.ok) {
      const error = body?.error ?? `통보 발송에 실패했습니다. (${r.status})`;
      console.error("[sendFixNoticeSms] 실패", r.status, error);
      return { ok: false, status: body?.status ?? "failed", error };
    }
    return body;
  } catch (e) {
    const error = e instanceof Error ? e.message : "연결 오류";
    console.error("[sendFixNoticeSms] 연결 오류", error);
    return { ok: false, error };
  }
}
