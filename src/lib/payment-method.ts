export const PAYMENT_METHODS = ["cash", "bank_transfer", "card"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
export function normalizePaymentMethod(value?: string | null): PaymentMethod | "unclassified" {
  return PAYMENT_METHODS.find((method) => method === value) ?? "unclassified";
}
export const PAYMENT_METHOD_LABEL = { cash: "현금", bank_transfer: "계좌이체", card: "카드", unclassified: "미분류" };
export function completedPaymentLabel(value?: string | null) {
  const method = normalizePaymentMethod(value);
  return method === "bank_transfer" ? "계좌이체 완료" : `${PAYMENT_METHOD_LABEL[method]} 결제완료`;
}
export function remainingPayment(total: number, deposit: number, balance: number) {
  return Math.max(0, total - deposit - balance);
}
/**
 * 결제 상태 카드에 넣는 금액.
 * 확인된 실제 입금(예약금·잔금)이 하나라도 있으면 그 금액이 기준입니다: 잔금 = 총액 − 확인 예약금 − 확인 잔금 (0 하한).
 * 확인된 입금이 없을 때만 견적상 예정 예약금을 보여 주며, planned=true 로 입금 전임을 알립니다.
 */
export function paymentSummaryParts(total: number, depositPaid: number, balancePaid: number, quotedDeposit?: number) {
  const t = Math.max(0, Number(total) || 0);
  const paidDeposit = Math.max(0, Number(depositPaid) || 0);
  const paidBalance = Math.max(0, Number(balancePaid) || 0);
  if (paidDeposit > 0 || paidBalance > 0 || quotedDeposit === undefined) {
    return { total: t, deposit: paidDeposit, balance: remainingPayment(t, paidDeposit, paidBalance), planned: false };
  }
  const deposit = Math.min(t, Math.max(0, Number(quotedDeposit) || 0));
  return { total: t, deposit, balance: t - deposit, planned: true };
}
