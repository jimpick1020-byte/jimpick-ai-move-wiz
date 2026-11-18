/**
 * 업체 월 구독료 단일 기준 (부가세 포함 최종 결제금액).
 * 화면 문구·페이앱 등록 금액·통지 검증이 모두 이 값을 씁니다.
 */
export const SUBSCRIPTION_PRICE = 39000;
/** 가격 변경 전 동의로 등록된 기존 주문 금액 — 해당 주문의 갱신 통지 검증에만 씁니다. */
export const LEGACY_SUBSCRIPTION_PRICES = [30000] as const;
export const SUBSCRIPTION_PRICE_LABEL = `${SUBSCRIPTION_PRICE.toLocaleString("ko-KR")}원`;
export const isKnownSubscriptionAmount = (n: number) =>
  n === SUBSCRIPTION_PRICE || (LEGACY_SUBSCRIPTION_PRICES as readonly number[]).includes(n);
