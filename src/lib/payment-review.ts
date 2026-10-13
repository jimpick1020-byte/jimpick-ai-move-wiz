export interface PaymentEvidence {
  amount: number;
  status: string;
  source: string;
  depositorName: string;
  paymentKind?: string;
}

/** Explicit kind prevents a balance arriving before deposit confirmation being misclassified. */
export function receiptPaymentKind(depositPaid: number, requested?: "deposit" | "balance") {
  return requested ?? (depositPaid > 0 ? "balance" : "deposit");
}

/** Customer claims are not bank receipts, even when an old claim was confirmed. */
export function actualReceipt(record: PaymentEvidence): boolean {
  return record.amount > 0 && ["sms_paste", "manual"].includes(record.source) && ["pending_review", "confirmed"].includes(record.status);
}

export function paymentReview(records: PaymentEvidence[], paymentStatus: string, depositPaid: number, _balancePaid: number, total: number) {
  if (["completed", "canceled", "refunded"].includes(paymentStatus)) return null;
  const real = records.filter(actualReceipt);
  const balance = real.filter((r) => r.paymentKind === "balance");
  const balanceAmount = balance.reduce((sum, r) => sum + r.amount, 0);
  if (balance.length && total > 0 && depositPaid + balanceAmount >= total) {
    return { kind: "balance" as const, names: [...new Set(balance.map((r) => r.depositorName).filter(Boolean))] };
  }
  const pending = real.filter((r) => r.status === "pending_review" && r.paymentKind !== "balance");
  return pending.length ? { kind: "deposit" as const, names: [...new Set(pending.map((r) => r.depositorName).filter(Boolean))] } : null;
}