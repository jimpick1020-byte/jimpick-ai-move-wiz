/**
 * 예약금·잔금 계산 규칙 (모든 화면·서버 공통).
 * 예약금 = 총 견적금액의 10%, 만 원 단위 반올림 (450,000원 → 50,000원, 440,000원 → 40,000원). 잔금 = 총액 − 예약금.
 * 총액은 바꾸지 않습니다.
 */
export function calcDeposit(total: number | null | undefined): number {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  return Math.min(t, Math.round(t / 100000) * 10000);
}

/** Manually agreed reservation amount; never represents a confirmed payment. */
export function plannedDeposit(total: number | null | undefined, override?: number): number {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  const o = Math.floor(Number(override));
  // 비어 있거나(null) 0 이하인 값은 "직접 정함"이 아니므로 자동 10% 계산을 씁니다.
  return override == null || !Number.isFinite(o) || o <= 0 ? calcDeposit(t) : Math.min(t, o);
}

export function calcBalance(total: number | null | undefined): number {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  return t - calcDeposit(t);
}
