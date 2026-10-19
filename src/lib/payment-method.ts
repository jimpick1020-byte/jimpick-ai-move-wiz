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