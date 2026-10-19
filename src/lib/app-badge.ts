/**
 * 홈 화면에 설치한 짐픽 앱 아이콘에 읽지 않은 알림 개수를 빨간 숫자로 표시합니다.
 *
 * - 브라우저 표준 navigator.setAppBadge / clearAppBadge 를 씁니다.
 * - 지원하지 않는 브라우저(Safari 구버전 등)에서는 조용히 아무것도 하지 않습니다.
 * - 숫자는 「미확인 계좌이체 입금 기록」 건수입니다 (견적 내역 주황 테두리와 같은 기준).
 * - 사장님이 견적 내역을 열어 확인하면 숫자가 지워집니다.
 */
import { pendingReceipt, type PaymentEvidence } from "./payment-review";

function badgeApi(): Navigator | null {
  if (typeof navigator === "undefined") return null;
  if (typeof navigator.setAppBadge !== "function" || typeof navigator.clearAppBadge !== "function") return null;
  return navigator;
}

/** 미확인 계좌이체 입금 기록 건수 (견적 내역 카드 주황 테두리와 같은 기준) */
export function unreadReceiptCount(rows: Array<{ paymentReceipts?: PaymentEvidence[] }>): number {
  let count = 0;
  for (const row of rows) {
    for (const receipt of row.paymentReceipts ?? []) {
      if (pendingReceipt(receipt)) count += 1;
    }
  }
  return count;
}

/** 아이콘 배지 숫자를 갱신합니다. 0 이면 지웁니다. */
export function updateAppBadge(count: number): void {
  const nav = badgeApi();
  if (!nav) return;
  try {
    if (count > 0) void nav.setAppBadge!(count).catch(() => {});
    else void nav.clearAppBadge!().catch(() => {});
  } catch {
    /* 배지를 못 써도 화면은 그대로 씁니다 */
  }
}

/** 견적 내역을 열어 확인했을 때 배지를 지웁니다 */
export function clearAppBadge(): void {
  updateAppBadge(0);
}
