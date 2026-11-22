/** Payment plans never add to the quotation or imply receipt of money. */
export function storagePaymentPlan(input: {
  total: number; plannedDeposit: number; plannedInterim?: number;
  depositPaid?: number; interimPaid?: number; balancePaid?: number;
}) {
  const money = (n = 0) => Math.max(0, Number(n) || 0);
  const total = money(input.total);
  const deposit = money(input.depositPaid);
  const interim = money(input.interimPaid);
  const balance = money(input.balancePaid);
  const plannedInterim = money(input.plannedInterim);
  const depositBasis = money(input.plannedDeposit);
  const paid = deposit + interim + balance;
  return {
    total, deposit, interim, balance, paid, plannedInterim,
    plannedFinal: Math.max(0, total - depositBasis - plannedInterim),
    interimDue: Math.min(Math.max(0, plannedInterim - interim), Math.max(0, total - paid)),
    remaining: Math.max(0, total - paid), overpaid: Math.max(0, paid - total),
  };
}

export function storagePaymentPlanError(total: number, deposit: number, interim: number): string | null {
  if (![total, deposit, interim].every(n => Number.isSafeInteger(n) && n >= 0)) return "납부 금액은 0원 이상의 정수로 입력해 주세요.";
  return interim > 0 && deposit + interim > total ? "예정 예약금과 중도금의 합계는 총 견적금액을 초과할 수 없습니다." : null;
}