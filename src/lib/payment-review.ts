export interface PaymentEvidence {
  amount: number;
  status: string;
  source: string;
  depositorName: string;
  paymentKind?: string;
}

/** Customer claims are not bank receipts, even when an old claim was confirmed. */
export function actualReceipt(record: PaymentEvidence): boolean {
  return record.amount > 0 && ["sms_paste", "manual"].includes(record.source) && record.status !== "rejected";
}

export function paymentReview(records: PaymentEvidence[], paymentStatus: string, depositPaid: number, balancePaid: number, total: number) {
  if (["completed", "canceled", "refunded"].includes(paymentStatus)) return null;
  const real = records.filter(actualReceipt);
  const balance = real.filter((r) => r.paymentKind === "balance");
  const balanceAmount = balance.reduce((sum, r) => sum + r.amount, 0);
  if (balance.length && total > 0 && depositPaid + Math.max(balancePaid, balanceAmount) >= total) {
    return { kind: "balance" as const, names: [...new Set(balance.map((r) => r.depositorName).filter(Boolean))] };
  }
  const pending = real.filter((r) => r.status === "pending_review" && r.paymentKind !== "balance");
  return pending.length ? { kind: "deposit" as const, names: [...new Set(pending.map((r) => r.depositorName).filter(Boolean))] } : null;
}