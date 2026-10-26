/** 예약금 안내 문자는 견적 하나당 한 번만 — 발송 기록의 중복 방지 키 */
export function depositNoticeKey(estimateId: string): string {
  return `deposit-confirmed-${estimateId}`;
}

/** 확인 직후 문자 발송 대상인지: 예약금 확인 성공 건만 (잔금·실패는 제외) */
export function shouldSendDepositNotice(kind: string | null | undefined, confirmOk: boolean): boolean {
  return confirmOk && kind === "deposit";
}

const won = (n: number) => `${Math.max(0, Math.round(n || 0)).toLocaleString("ko-KR")}원`;

/** 예약금 확인 안내 문자 — 이전에 고객에게 나가던 형식(인사말·금액·이사일·확인 링크·문의) */
export function depositConfirmedText(o: { name: string; deposit: number; total: number; moveDate: string; template: string; link: string; phone: string }): string {
  const greet = o.template.replace(/https?:\/\/\S+/gi, "").split("\n").map((l) => l.trim()).filter(Boolean).join("\n").slice(0, 500);
  return [
    "[짐도리]",
    greet,
    `${o.name} 고객님, 예약금 입금 및 예약 내용을 확인해 주세요.`,
    `예약금: ${won(o.deposit)}`,
    o.total > 0 && `총 견적금액: ${won(o.total)}`,
    o.total > 0 && `잔금: ${won(o.total - o.deposit)}`,
    o.moveDate.trim() && `이사일: ${o.moveDate.trim().slice(0, 10)}`,
    o.link && "입금 및 예약 확인:",
    o.link,
    o.phone && `문의: ${o.phone}`,
  ].filter(Boolean).join("\n");
}
