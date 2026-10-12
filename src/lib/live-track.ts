// 실시간 카메라 인식 규칙(화면·테스트 공통). 큰 가구·가전만, 낮은 신뢰도는 임의 확정하지 않음.
export type Box = [number, number, number, number];

/** 휴대폰 내 감지 모델(COCO) 중 이사 견적에 필요한 큰 물건만 */
export const BIG_ITEMS = new Set(["bed", "couch", "dining table", "refrigerator", "tv", "microwave"]);
/** 화면 면적의 6% 미만인 후보는 윤곽 분석 전에 제외 */
export const MIN_AREA = 0.06;
/** 분석 간격(ms) */
export const ANALYZE_MS = 400;

const KO: Record<string, string> = { bed: "침대", couch: "소파", refrigerator: "냉장고", tv: "TV", microwave: "전자레인지" };
const CONFIRM: Record<string, number> = { refrigerator: 0.7 };
const CHOICES: Record<string, string[]> = {
  "dining table": ["책상", "식탁"],
  refrigerator: ["냉장고", "김치냉장고", "책장", "장롱"],
};

/** label이 빈 문자열이면 "품목 확인 필요"(사용자가 직접 선택). */
export function bigItemLabel(cls: string, score: number, tiers: number | null): { label: string; choices: string[]; score: number } {
  if (cls === "_center") return tiers && tiers >= 2 ? { label: `${tiers}단 서랍장`, choices: [], score: 0 } : { label: "", choices: [], score: 0 };
  if (cls === "dining table") return { label: "", choices: CHOICES[cls], score };
  const need = CONFIRM[cls] ?? 0.6;
  if (!KO[cls] || score < need) return { label: "", choices: CHOICES[cls] ?? [], score };
  return { label: KO[cls], choices: [], score };
}

export function iou(a: Box, b: Box) {
  const x = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const y = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const i = x * y, u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i;
  return u > 0 ? i / u : 0;
}

/** 같은 종류이고 많이 겹치면 같은 detection(같은 ID)로 이어 씁니다. 가운데 분석은 위치가 고정이라 종류만 비교. */
export function sameTrack(prevCls: string, prevBox: Box, cls: string, box: Box, th = 0.5): boolean {
  if (prevCls !== cls) return false;
  if (cls === "_center") return true;
  return iou(prevBox, box) > th;
}
