/**
 * 은행 입금 문자 ↔ 견적 매칭 (브라우저·서버 공통 순수 계산).
 *
 * - 예약금과 잔금은 별도 거래입니다. 같은 이름·계좌로 들어와도 서로 막지 않습니다.
 * - 견적별로 "지금 받을 금액"(예약금 전이면 예약금, 예약금 확인 후면 남은 잔금)과
 *   입금자명·금액이 모두 맞는 견적이 정확히 하나일 때 자동 연결합니다.
 * - 입금자명이 맞는 진행 중 견적이 하나면 금액이 달라도(짐 증가 추가 입금 등) 연결하고
 *   예정 금액과 차액을 안내합니다. 최종 금액 반영·결제완료는 사장님이 직접 확인합니다.
 * - 이름이 맞는 견적이 여럿이면 임의로 확정하지 않고 확인 필요로 둡니다.
 */
import { customerPaymentDue } from "./customer-payment";
import { isSameName } from "./deposit-parse";

export interface MatchCandidate {
  estimateId: string;
  customerName: string;
  total: number;
  depositPaid: number;
  balancePaid: number;
  paymentStatus: string;
  contractCancelled?: boolean;
}

export type BankSmsMatch =
  | { status: "matched"; estimateId: string; kind: "deposit" | "balance"; candidates: string[]; note: string; expectedAmount: number }
  | { status: "review"; candidates: string[]; note: string }
  | { status: "unmatched"; candidates: string[]; note: string }
  | { status: "ignored"; candidates: string[]; note: string };

/** 수신 문자 중복 판단 키: 실제 이벤트 ID가 있으면 그것, 없으면 원문 전체(은행 문자는 시각·잔액이 들어 있어 거래마다 다릅니다). 이름·계좌·견적 ID는 쓰지 않습니다. */
export function bankSmsDedupeKey(input: { eventId?: string | null; rawText: string }, textHash: string): string {
  const id = String(input.eventId ?? "").trim();
  return id ? `evt:${id.slice(0, 200)}` : `txt:${textHash}`;
}

/** 원문을 비교용으로 다듬습니다 (공백 차이만 무시). */
export function normalizeSmsText(raw: string): string {
  return String(raw ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function matchBankSms(
  sms: { depositorName: string; amount: number; looksLikeDeposit: boolean },
  candidates: MatchCandidate[],
): BankSmsMatch {
  if (!sms.looksLikeDeposit || sms.amount <= 0) return { status: "ignored", candidates: [], note: "입금 문자로 보이지 않습니다." };
  const open = candidates
    .filter((c) => !c.contractCancelled && !["completed", "canceled", "refunded"].includes(c.paymentStatus))
    .map((c) => ({ c, due: customerPaymentDue(c.total, c.depositPaid, c.balancePaid, c.paymentStatus) }))
    .filter((x) => x.due.amount > 0);
  const won = (n: number) => n.toLocaleString("ko-KR");
  const hitOf = (hit: { c: MatchCandidate; due: { kind: "deposit" | "balance"; amount: number } }, note: string): BankSmsMatch => ({
    status: "matched",
    estimateId: hit.c.estimateId,
    kind: hit.due.kind,
    candidates: [hit.c.estimateId],
    note,
    expectedAmount: hit.due.amount,
  });
  const byName = open.filter((x) => isSameName(sms.depositorName, x.c.customerName));
  const exact = byName.filter((x) => x.due.amount === sms.amount);
  if (exact.length === 1) {
    const hit = exact[0]!;
    return hitOf(hit, `${hit.due.kind === "balance" ? "잔금" : "예약금"} ${won(sms.amount)}원과 일치`);
  }
  if (exact.length > 1) return { status: "review", candidates: exact.map((x) => x.c.estimateId), note: `같은 이름·금액 견적이 ${exact.length}건입니다. 직접 선택해 주세요.` };
  // 이름이 맞는 진행 중 견적이 하나면 금액이 달라도 연결합니다 (짐 증가 등 추가 입금).
  // 차액은 안내 문구로 보여 주고, 최종 금액 반영·결제완료는 사장님이 직접 확인합니다.
  if (byName.length === 1) {
    const hit = byName[0]!;
    const label = hit.due.kind === "balance" ? "잔금" : "예약금";
    const diff = sms.amount - hit.due.amount;
    return hitOf(hit, `예정 ${label} ${won(hit.due.amount)}원 / 실제 입금 ${won(sms.amount)}원 / 차액 ${diff > 0 ? "+" : "-"}${won(Math.abs(diff))}원`);
  }
  if (byName.length > 1) return { status: "review", candidates: byName.map((x) => x.c.estimateId), note: `같은 이름의 진행 중 견적이 ${byName.length}건입니다. 직접 선택해 주세요.` };
  const byAmount = open.filter((x) => x.due.amount === sms.amount);
  if (byAmount.length) return { status: "review", candidates: byAmount.map((x) => x.c.estimateId), note: "금액은 같지만 입금자명이 고객명과 다릅니다." };
  return { status: "unmatched", candidates: [], note: "연결할 견적을 찾지 못했습니다." };
}
