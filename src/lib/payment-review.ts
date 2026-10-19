export interface PaymentEvidence {
  id?: string;
  amount: number;
  status: string;
  source: string;
  depositorName: string;
  paymentKind?: string;
  paymentMethod?: string | null;
  depositedAt?: string | null;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
}

/** Explicit kind prevents a balance arriving before deposit confirmation being misclassified. */
export function receiptPaymentKind(depositPaid: number, requested?: "deposit" | "balance") {
  return requested ?? (depositPaid > 0 ? "balance" : "deposit");
}

/** Customer "입금했습니다" claims are the real DB payment records customers create; they count until the owner confirms or rejects. */
export function actualReceipt(record: PaymentEvidence): boolean {
  return record.amount > 0 && ["sms_paste", "manual", "customer_claim"].includes(record.source) && ["pending_review", "confirmed"].includes(record.status);
}

export function balanceReceiptReady(records: PaymentEvidence[], paymentStatus: string, depositPaid: number, total: number) {
  if (["completed", "canceled", "refunded"].includes(paymentStatus)) return false;
  const balance = records.filter(actualReceipt).filter((r) => r.paymentKind === "balance");
  return balance.length > 0 && total > 0 && depositPaid + balance.reduce((s, r) => s + r.amount, 0) >= total;
}

export function bankReceipt(record: { paymentMethod?: string | null; source?: string }): boolean {
  if (record.paymentMethod) return record.paymentMethod === "bank_transfer";
  // Customer "입금했습니다" claims are account-transfer deposits awaiting owner review.
  return record.source === "sms_paste" || record.source === "manual" || record.source === "customer_claim";
}

export function pendingReceipt(record: { amount: number; status: string; paymentMethod?: string | null; source?: string }): boolean {
  return record.amount > 0 && record.status === "pending_review" && bankReceipt(record);
}

export function paymentReview(records: PaymentEvidence[], _paymentStatus: string, _depositPaid: number, _balancePaid: number, _total: number) {
  const pending = records.filter(pendingReceipt);
  return pending.length ? { kind: "deposit" as const, amount: pending.reduce((s, r) => s + r.amount, 0), names: [...new Set(pending.map((r) => r.depositorName).filter(Boolean))], receipts: pending } : null;
}
/** Fixed full classes so Tailwind always generates them (no dynamic class names). */
export const PAYMENT_REVIEW_BORDER = {
  deposit: "border-4 border-payment-review",
  balance: "border-4 border-payment-review",
} as const;
