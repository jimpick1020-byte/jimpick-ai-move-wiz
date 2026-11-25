/**
 * 예약금·잔금 계산 규칙 (모든 화면·서버 공통).
 * 예정 예약금 = 최종 총액의 10%, 만 원 단위 반올림 (예: 1,680,000원 → 170,000원).
 * 실제 수납과는 별개이며 총액은 바꾸지 않습니다.
 */
export function calcDeposit(total: number | null | undefined): number {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  return Math.round(t / 100000) * 10000;
}

/** Legacy overrides remain stored for audit, but never override the current automatic plan. */
export function plannedDeposit(total: number | null | undefined, _override?: number): number {
  return calcDeposit(total);
}

export function calcBalance(total: number | null | undefined): number {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  return t - calcDeposit(t);
}
