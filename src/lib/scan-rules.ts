/** 사진 품목 인식 판정 규칙 (화면·서버·테스트 공통) */

/** 90% 이상: 자동 등록 (미만은 조용히 제외) */
export const AUTO_CONF = 0.9;
/** 50~79%: 사용자 확인, 50% 미만: 미확인 */
export const CHECK_CONF = 0.5;

export type ConfTier = "auto" | "check" | "unknown";

export function confidenceTier(c: number | null | undefined): ConfTier {
  if (c == null || !Number.isFinite(c)) return "check";
  if (c >= AUTO_CONF) return "auto";
  if (c >= CHECK_CONF) return "check";
  return "unknown";
}

/** 2차 고화질 분석이 필요한 애매한 품목인지 (확실한 것·명백히 아닌 것은 다시 보지 않습니다) */
export function needsSecondPass(item: { confidence: number | null; item_id?: string | null }): boolean {
  if (item.confidence == null) return true;
  if (item.confidence >= AUTO_CONF) return !item.item_id;
  return item.confidence >= 0.3;
}

/**
 * 같은 방 여러 사진에 같은 물건이 찍힌 경우 수량을 더하지 않고 사진별 최대값을 씁니다.
 * 이미 반영된 수량(prevMax)보다 많을 때만 차이만큼 추가합니다.
 */
export function dedupedAddQty(qty: number, prevMax: number): number {
  return Math.max(0, qty - Math.max(0, prevMax));
}

/**
 * 역광 판정: 아주 밝은 부분(창문·조명)과 아주 어두운 부분(물건)이 동시에 넓게 있으면 역광입니다.
 * gray 는 0~1 밝기 배열.
 */
export function isBacklit(gray: ArrayLike<number>): boolean {
  const n = gray.length;
  if (!n) return false;
  let bright = 0;
  let dark = 0;
  for (let i = 0; i < n; i++) {
    if (gray[i] > 0.9) bright++;
    else if (gray[i] < 0.15) dark++;
  }
  return bright / n >= 0.15 && dark / n >= 0.35;
}
