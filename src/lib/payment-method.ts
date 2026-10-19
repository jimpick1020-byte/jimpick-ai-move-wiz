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
 * '남은 금액' 라벨은 쓰지 않고, 잔금 자리에 계산 값(총액 − 확인된 예약금 − 확인된 잔금)을 넣습니다.
 */
export function paymentSummaryParts(total: number, depositPaid: number, balancePaid: number) {
  const t = Math.max(0, Number(total) || 0);
  const deposit = Math.max(0, Number(depositPaid) || 0);
  return { total: t, deposit, balance: remainingPayment(t, deposit, Number(balancePaid) || 0) };
}