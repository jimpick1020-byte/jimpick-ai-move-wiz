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
  msgId?: string;
  /** SMS · LMS · MMS */
  msgType?: string;
  successCount?: number;
  sentAt?: number;
  error?: string;
}

export interface EdgeSmsInput {
  /** 받는 번호 — 화면에서 입력받습니다 */
  to: string;
  text: string;
  title?: string;
  estimateId?: string;
  sheetNo?: string;
  /** 견적서 그림 (붙이면 MMS 로 나갑니다) */
  imageBase64?: string;
  imageName?: string;
  imageType?: string;
  idempotencyKey?: string;
  /** 알리고 시험 모드 — 실제로는 나가지 않습니다 */
  testMode?: boolean;
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
      return {
        ok: false,
        error:
          error.message === "Failed to send a request to the Edge Function"
            ? "문자발송 기능(send-estimate-sms)이 아직 배포되지 않았습니다."
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
