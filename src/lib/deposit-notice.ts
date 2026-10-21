/** 예약금 안내 문자는 견적 하나당 한 번만 — 발송 기록의 중복 방지 키 */
export function depositNoticeKey(estimateId: string): string {
  return `deposit-confirmed-${estimateId}`;
}

/** 확인 직후 문자 발송 대상인지: 예약금 확인 성공 건만 (잔금·실패는 제외) */
export function shouldSendDepositNotice(kind: string | null | undefined, confirmOk: boolean): boolean {
  return confirmOk && kind === "deposit";
}
