/**
 * 문자발송 — Supabase Edge Function(send-estimate-sms) 을 부릅니다.
 *
 * 알리고 아이디·키·발신번호는 Supabase Secrets 에만 있고,
 * 이 파일(브라우저에서 도는 코드)에는 들어오지 않습니다.
 *
 * 알리고가 "성공" 이라고 답했을 때만 성공으로 돌려줍니다.
 */
import { supabase } from "@/integrations/supabase/client";

const FUNCTION_NAME = "send-estimate-sms";

export interface EdgeSmsResult {
  ok: boolean;
  /** 알리고가 준 발송번호 */
  msgId?: string | null;
  /** SMS · LMS */
  msgType?: string;
  successCount?: number;
  /** 발송 요청 일시 · 실제 발송 일시 */
  requestedAt?: string;
  sentAt?: string | number | null;
  /** 받는 번호 뒤 4자리 (전체 번호는 서버에서도 남기지 않습니다) */
  recipientLast4?: string;
  /** sent · failed */
  status?: string;
  customerName?: string;
  /** 이미 보낸 건이면 참 — 다시 보내지 않았습니다 */
  alreadySent?: boolean;
  message?: string;
  error?: string;
}

/**
 * 견적서 문자발송에 넘기는 값.
 *
 * 받는 번호·고객 이름·금액·문자 내용은 넘기지 않습니다.
 * 서버가 견적서를 직접 읽어 만듭니다 (앱에서 바꿔 보낼 수 없게).
 */
export interface EdgeSmsInput {
  /** 보낼 견적서 */
  estimate_id: string;
  /** 지금은 보안 링크 방식만 */
  delivery_method: "link";
  /** 같은 발송이 두 번 나가지 않게 하는 열쇠 */
  idempotency_key: string;
}

/** 문자 한 통을 보냅니다 */
export async function sendSmsViaEdge(input: EdgeSmsInput): Promise<EdgeSmsResult> {
  try {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body: input });
    if (data && typeof data === "object" && "ok" in data) {
      return data as EdgeSmsResult;
    }
    if (error) {
      // 함수가 오류로 답한 경우 — 안에 담긴 실제 이유를 꺼내 보여 줍니다
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body && typeof body === "object" && "error" in body) {
            return { ok: false, error: String((body as { error: unknown }).error) };
          }
        } catch {
          /* 본문을 못 읽으면 아래 문구를 씁니다 */
        }
      }
      // 함수가 없을 때와 로그인이 풀렸을 때를 구분해 알려 줍니다
      const ctxStatus = (error as { context?: { status?: number } }).context?.status;
      if (ctxStatus === 401) {
        return {
          ok: false,
          error: "로그인이 필요합니다. 설정 화면에서 계정 로그인을 한 뒤 다시 시도해 주세요.",
        };
      }
      return {
        ok: false,
        error:
          error.message === "Failed to send a request to the Edge Function"
            ? "문자발송 기능(send-estimate-sms)이 아직 배포되지 않았습니다. 러버블에서 Publish 를 눌러 배포해 주세요."
            : `문자 발송에 실패했습니다. (${error.message})`,
      };
    }
    return { ok: false, error: "문자 발송 결과를 읽지 못했습니다." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "문자 발송 중 오류가 났습니다.",
    };
  }
}

/**
 * 연결 시험 문자 한 통.
 * 정해진 문구만 나가고, 받는 번호는 사장님이 화면에서 직접 넣습니다.
 */
export async function sendTestSms(to: string): Promise<EdgeSmsResult> {
  try {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { mode: "test", test_to: to, idempotency_key: `test-${Date.now()}` },
    });
    if (data && typeof data === "object" && "ok" in data) return data as EdgeSmsResult;
    if (error) {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const b = await ctx.json();
          if (b && typeof b === "object" && "error" in b) {
            return { ok: false, error: String((b as { error: unknown }).error) };
          }
        } catch {
          /* 본문을 못 읽으면 아래 문구를 씁니다 */
        }
      }
      return { ok: false, error: `시험 발송에 실패했습니다. (${error.message})` };
    }
    return { ok: false, error: "시험 발송 결과를 읽지 못했습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "시험 발송에 실패했습니다." };
  }
}

export interface SmsConfigStatus {
  ok: boolean;
  config?: Record<string, boolean | string>;
  missing?: string[];
  error?: string;
}

/**
 * 알리고 설정이 되어 있는지만 확인합니다.
 * 값 자체는 받아 오지 않습니다 — 있는지 없는지만 알려 줍니다.
 */
export async function checkSmsConfig(): Promise<SmsConfigStatus> {
  try {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { checkOnly: true },
    });
    if (data && typeof data === "object") return data as SmsConfigStatus;
    return {
      ok: false,
      error: error
        ? "문자발송 기능(send-estimate-sms)에 연결하지 못했습니다. 아직 배포되지 않았을 수 있습니다."
        : "설정 상태를 읽지 못했습니다.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "설정 확인에 실패했습니다." };
  }
}

/** 연결 시험용 문자 내용 (그림 없이 SMS 로만 나갑니다) */
export const TEST_SMS_TEXT = "[JIMPICK 짐픽]\n문자발송 연결 테스트입니다.";

/**
 * 고객에게 나가는 실제 견적서 문자 내용.
 * 값이 비어 있으면 그 줄을 비워 두지 않고 "미정" 으로 채웁니다.
 */
export function estimateSmsText(v: {
  customerName: string;
  movingDate: string;
  totalAmount: number;
  secureUrl: string;
}): string {
  const 금액 = `${(v.totalAmount || 0).toLocaleString("ko-KR")}원`;
  return [
    "[JIMPICK 짐픽]",
    `${v.customerName || "고객"} 고객님, 요청하신 이사 견적서가 도착했습니다.`,
    "",
    `이사일: ${v.movingDate || "미정"}`,
    `총 견적금액: ${금액}`,
    "",
    "아래 링크에서 견적서와 표준약관을 확인해 주세요.",
    "",
    v.secureUrl,
  ].join("\n");
}
