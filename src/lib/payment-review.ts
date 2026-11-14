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

/** Confirmed balances are already deducted from remainingPayment; never offer them for review again. */
export function pendingBalanceReceipts<T extends PaymentEvidence>(records: T[]): T[] {
  return uniquePaymentReceipts(records).filter((record) => record.paymentKind === "balance" && pendingReceipt(record));
}

export function uniquePaymentReceipts<T extends PaymentEvidence>(records: T[]): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (!record.id) return true;
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

export function paymentReview(records: PaymentEvidence[], _paymentStatus: string, _depositPaid: number, _balancePaid: number, _total: number) {
  const pending = uniquePaymentReceipts(records).filter(pendingReceipt);
  if (!pending.length) return null;
  const kind = pending.some((r) => r.paymentKind === "balance") ? ("balance" as const) : ("deposit" as const);
  return { kind, amount: pending.reduce((s, r) => s + r.amount, 0), names: [...new Set(pending.map((r) => r.depositorName).filter(Boolean))], receipts: pending };
}

/**
 * 고객 「입금했습니다」 신고가 이미 기록된 입금과 같은지 판단합니다.
 * 같은 견적·같은 종류·같은 금액의 확인 대기/확인 기록이 어떤 경로(은행 문자, 직접 등록,
 * 이전 고객 신고)로든 있으면 새 기록을 만들지 않아 같은 입금이 두 번 집계되지 않습니다.
 */
export function claimAlreadyRecorded(records: Pick<PaymentEvidence, "amount" | "status" | "paymentKind">[], kind: "deposit" | "balance", amount: number): boolean {
  return records.some((r) => r.paymentKind === kind && r.amount === amount && ["pending_review", "confirmed"].includes(r.status));
}
/** Fixed full classes so Tailwind always generates them (no dynamic class names). 예약금=밝은 주황, 잔금=밝은 파랑. */
export const PAYMENT_REVIEW_BORDER = {
  deposit: "jp-payment-review-deposit",
  balance: "jp-payment-review-balance",
} as const;

/** 확인 대기 입금액이 예정 금액과 다를 때 카드에 보여 줄 안내. 같으면 null (금액은 바꾸지 않고 안내만 합니다). */
export function paymentDiffNote(kind: "deposit" | "balance", expected: number, actual: number): string | null {
  if (expected <= 0 || actual <= 0 || expected === actual) return null;
  const won = (n: number) => n.toLocaleString("ko-KR");
  const diff = actual - expected;
  return `예정 ${kind === "balance" ? "잔금" : "예약금"} ${won(expected)}원 / 실제 입금 ${won(actual)}원 / 차액 ${diff > 0 ? "+" : "-"}${won(Math.abs(diff))}원`;
}

/**
 * 고객 잔금 신고를 받을 수 있는지 판단합니다. 받을 수 없으면 고객에게 보여 줄 안내를, 받을 수 있으면 null을 돌려줍니다.
 * 금액·단계는 항상 서버에 저장된 현재 유효 계약 기준입니다.
 */
export function balanceClaimBlock(input: {
  confirmed: boolean;
  seenAmount?: number;
  dueKind: "deposit" | "balance";
  dueAmount: number;
  depositPaid: number;
  paymentStatus: string;
  contractCancelled: boolean;
  latest: boolean;
}): string | null {
  if (!input.confirmed) return "실제로 잔금을 입금했는지 체크해 주세요.";
  if (input.contractCancelled || ["canceled", "refunded"].includes(input.paymentStatus)) return "취소된 계약은 잔금 신고를 할 수 없습니다.";
  if (input.paymentStatus === "completed") return "이미 결제가 완료된 견적입니다.";
  if (!input.latest) return "새 견적서가 있습니다. 업체에서 받은 최신 링크를 열어 주세요.";
  if (input.dueKind !== "balance" || input.depositPaid <= 0 || input.dueAmount <= 0) return "잔금 신고를 할 수 없는 상태입니다. 견적서를 새로 열어 확인해 주세요.";
  if (input.seenAmount !== input.dueAmount) return "잔금 금액이 바뀌었습니다. 견적서를 새로 열어 금액을 다시 확인해 주세요.";
  return null;
}
