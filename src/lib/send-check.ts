/**
 * 문자발송 전 필수 데이터 검사.
 *
 * 「견적서 문자발송」을 누르기 전에, 지금 견적서에 실제로 들어 있는 값만 봅니다.
 * 빠진 값이 있으면 발송을 아예 실행하지 않고, 빠진 항목과 고칠 화면을 알려 줍니다.
 * (가짜 값으로 채우거나 성공으로 표시하지 않습니다)
 */
import type { Estimate } from "@/lib/jimpick";
import { isSendablePhone } from "@/lib/sms";

/** 빠진 항목 하나 */
export interface MissingField {
  /** 사람이 읽는 항목 이름 */
  label: string;
  /** 이 값을 고칠 수 있는 화면 */
  screen: "step1" | "step2" | "step3" | "step6" | "result";
  /** 그 화면 이름 (버튼에 씁니다) */
  screenLabel: string;
}

export interface SendCheckResult {
  ok: boolean;
  missing: MissingField[];
}

const SCREEN_LABEL: Record<MissingField["screen"], string> = {
  step1: "1단계. 고객 정보",
  step2: "2단계. 주소 입력",
  step3: "3단계. 작업 조건",
  step6: "품목 담기",
  result: "견적서 화면",
};

function need(
  label: string,
  screen: MissingField["screen"],
): MissingField {
  return { label, screen, screenLabel: SCREEN_LABEL[screen] };
}

/**
 * 발송에 필요한 값이 모두 있는지 봅니다.
 * total 은 화면에서 실제로 계산된 총 견적금액을 그대로 받습니다.
 */
export function checkSendable(draft: Estimate, total: number): SendCheckResult {
  const missing: MissingField[] = [];

  if (!String(draft.customerName ?? "").trim()) missing.push(need("고객 이름", "step1"));

  const phone = String(draft.phone ?? "").trim();
  if (!phone) missing.push(need("고객 휴대전화 번호", "step1"));
  else if (!isSendablePhone(phone))
    missing.push(need("고객 휴대전화 번호 (010으로 시작하는 휴대전화 형식)", "step1"));

  if (!String(draft.moveDate ?? "").trim()) missing.push(need("이사 날짜", "step1"));
  if (!String(draft.fromAddress ?? "").trim()) missing.push(need("출발지 주소", "step2"));
  if (!String(draft.toAddress ?? "").trim()) missing.push(need("도착지 주소", "step2"));

  const itemCount = (draft.rooms ?? []).reduce(
    (sum, room) =>
      sum + Object.values(room.items ?? {}).reduce((s, qty) => s + (Number(qty) || 0), 0),
    0,
  );
  if (itemCount <= 0) missing.push(need("공간별 품목과 수량", "step6"));

  if (!(Number(total) > 0)) missing.push(need("총 견적금액", "result"));
  if (!String(draft.id ?? "").trim()) missing.push(need("견적서 ID", "result"));
  if (!(Number(draft.sheetVersion ?? 1) >= 1)) missing.push(need("견적서 버전", "result"));

  return { ok: missing.length === 0, missing };
}
