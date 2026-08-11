/**
 * 문자 발송 (알리고 Aligo).
 *
 * API 키는 서버에서만 읽습니다. 화면이나 브라우저로 나가지 않습니다.
 *
 * 필요한 환경변수
 *   ALIGO_API_KEY   알리고 API 키
 *   ALIGO_USER_ID   알리고 아이디
 *   ALIGO_SENDER    사전등록한 발신번호 (예: 010-7566-2542)
 *   ALIGO_TEST_MODE 값이 "Y" 면 실제로 보내지 않고 시험만 합니다 (선택)
 *
 * 키가 없으면 성공한 척하지 않고 「설정 필요」로 정직하게 실패합니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ENDPOINT = "https://apis.aligo.in/send/";

/** 숫자만 남깁니다 */
function digits(s: string): string {
  return (s || "").replace(/[^0-9]/g, "");
}

export interface SmsSendResult {
  ok: boolean;
  /** 알리고가 준 발송번호 */
  msgId?: string;
  /** SMS(단문) 인지 LMS(장문) 인지 */
  msgType?: string;
  /** 성공 건수 */
  successCount?: number;
  /** 보낸 시각 */
  sentAt?: number;
  error?: string;
}

/** 알리고 응답 (필요한 항목만) */
interface AligoResponse {
  result_code?: number | string;
  message?: string;
  msg_id?: string | number;
  success_cnt?: number;
  error_cnt?: number;
  msg_type?: string;
}

/** 알리고가 주는 오류를 쉬운 한국어로 */
function aligoError(code: number, message: string): string {
  const m = (message || "").trim();
  switch (code) {
    case -101:
      return "알리고 아이디 또는 API 키가 올바르지 않습니다.";
    case -102:
      return "등록되지 않은 발신번호입니다. 알리고에서 발신번호 사전등록을 마쳐 주세요.";
    case -111:
      return "문자 잔액이 부족합니다. 알리고에서 충전해 주세요.";
    case -201:
      return "받는 번호 형식이 올바르지 않습니다.";
    default:
      return m || `문자 발송에 실패했습니다. (코드 ${code})`;
  }
}

export const sendEstimateSms = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        /** 받는 사람 휴대폰 번호 */
        to: z.string().min(9).max(20),
        /** 보낼 내용 */
        text: z.string().min(1).max(2000),
        /** 장문일 때 제목 */
        title: z.string().max(44).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<SmsSendResult> => {
    const key = process.env.ALIGO_API_KEY;
    const userId = process.env.ALIGO_USER_ID;
    const sender = process.env.ALIGO_SENDER;

    const missing = [
      !key && "ALIGO_API_KEY",
      !userId && "ALIGO_USER_ID",
      !sender && "ALIGO_SENDER",
    ].filter(Boolean);
    if (missing.length) {
      return {
        ok: false,
        error: `문자 발송 설정이 필요합니다. (${missing.join(", ")} 미설정)`,
      };
    }

    const receiver = digits(data.to);
    if (!/^01[016789][0-9]{7,8}$/.test(receiver)) {
      return { ok: false, error: "받는 번호 형식이 올바르지 않습니다." };
    }

    // 90바이트를 넘으면 장문(LMS)으로 보냅니다
    const bytes = new TextEncoder().encode(data.text).length;
    const msgType = bytes > 90 ? "LMS" : "SMS";

    const body = new URLSearchParams({
      key: key!,
      user_id: userId!,
      sender: digits(sender!),
      receiver,
      msg: data.text,
      msg_type: msgType,
      testmode_yn: process.env.ALIGO_TEST_MODE === "Y" ? "Y" : "N",
    });
    if (msgType === "LMS") body.set("title", (data.title || "이사 견적서").slice(0, 44));

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) {
        return { ok: false, error: `문자 서버에 연결하지 못했습니다. (HTTP ${res.status})` };
      }
      const j = (await res.json()) as AligoResponse;
      const code = Number(j.result_code ?? -1);
      if (code !== 1) {
        console.error("[sendEstimateSms] aligo error", code, j.message);
        return { ok: false, error: aligoError(code, j.message ?? "") };
      }
      return {
        ok: true,
        msgId: String(j.msg_id ?? ""),
        msgType: j.msg_type ?? msgType,
        successCount: Number(j.success_cnt ?? 0),
        sentAt: Date.now(),
      };
    } catch (e) {
      console.error("[sendEstimateSms] network error", e);
      return { ok: false, error: "네트워크 오류로 문자를 보내지 못했습니다." };
    }
  });
