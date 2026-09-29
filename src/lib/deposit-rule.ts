/**
 * 예약금·잔금 계산 규칙 (모든 화면·서버 공통).
 * 예약금 = 총 견적금액의 10%, 1만 원 미만은 버림. 잔금 = 총액 − 예약금.
 * 총액은 바꾸지 않습니다.
 */
export function calcDeposit(total: number | null | undefined): number {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  return Math.floor((t * 0.1) / 10000) * 10000;
}

export function calcBalance(total: number | null | undefined): number {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  return t - calcDeposit(t);
}
