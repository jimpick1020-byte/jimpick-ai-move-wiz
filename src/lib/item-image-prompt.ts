/**
 * 품목 이름 → 그림 생성 문구.
 * 이름의 특징(단수·도어 수·2층 구조 등)과 헷갈리기 쉬운 물품 구분을 문구에 직접 넣어
 * 이름과 다른 물건(예: 스피닝바이크 → 건조기)이 그려지지 않게 합니다.
 */
type Hint = { words: string[]; en: string; not?: string };

// 앞쪽 규칙이 우선합니다(더 구체적인 이름을 먼저 둡니다).
export const ITEM_IMAGE_HINTS: Hint[] = [
  { words: ["스피닝", "스핀바이크", "실내자전거", "실내 자전거", "헬스자전거"], en: "indoor stationary exercise bike (spin bike) with pedals, a bicycle saddle, handlebars and a heavy front flywheel", not: "clothes dryer, washing machine, outdoor bicycle" },
  { words: ["빨래건조대", "건조대"], en: "foldable metal clothes drying rack with thin rails for hanging laundry", not: "electric tumble dryer, washing machine" },
  { words: ["건조기"], en: "electric front-loading tumble clothes dryer appliance with a round door", not: "drying rack, washing machine with top lid" },
  { words: ["통돌이"], en: "top-loading washing machine with a lid on top", not: "front-loading drum washer" },
  { words: ["드럼세탁기", "드럼 세탁기"], en: "front-loading drum washing machine with a round glass door", not: "top-loading washer" },
  { words: ["러닝머신", "트레드밀"], en: "motorized treadmill with a running belt, side rails and a console" },
  { words: ["로잉"], en: "rowing machine with a sliding seat, foot plates and a pull handle" },
  { words: ["일립티컬"], en: "elliptical cross trainer with two foot pedals and two moving arm handles" },
  { words: ["2층침대", "이층침대", "벙커"], en: "two-level bunk bed with an upper bed, a ladder and a lower level" },
  { words: ["수납침대"], en: "bed frame with storage drawers built into the base" },
  { words: ["돌침대"], en: "Korean stone bed with a stone slab mattress surface" },
  { words: ["흙침대"], en: "Korean clay (loess) bed with an earth-colored heated surface" },
  { words: ["슬라이딩", "슬라이드"], en: "wardrobe with large sliding doors" },
  { words: ["양문형"], en: "side-by-side refrigerator with two full-height vertical doors" },
  { words: ["벽걸이"], en: "wall-mounted unit" },
];

const DOOR = /([1-9])\s*(도어|문)/;
const TIER = /([1-9])\s*단/;
const SEAT = /([1-9])\s*인/;

export function itemImageHints(name: string): { en: string[]; not: string[] } {
  const n = name.replace(/\s+/g, "");
  const en: string[] = [];
  const not: string[] = [];
  for (const h of ITEM_IMAGE_HINTS) {
    if (h.words.some((w) => n.includes(w.replace(/\s+/g, "")))) {
      en.push(h.en);
      if (h.not) not.push(h.not);
      break;
    }
  }
  const tier = n.match(TIER);
  if (tier && /서랍/.test(n)) en.push(`exactly ${tier[1]} stacked drawers`);
  else if (tier) en.push(`exactly ${tier[1]} tiers/shelves`);
  const door = n.match(DOOR);
  if (door) en.push(`exactly ${door[1]} doors`);
  const seat = n.match(SEAT);
  if (seat && /(소파|쇼파|식탁|테이블)/.test(n)) en.push(`sized for ${seat[1]} people`);
  return { en, not };
}

export function buildItemImagePrompt(name: string): string {
  const { en, not } = itemImageHints(name);
  return [
    `Product photo of exactly one Korean household moving item named "${name}".`,
    en.length ? `It must clearly be: ${en.join("; ")}.` : "Depict the object that this Korean name literally refers to.",
    not.length ? `It must NOT look like: ${not.join("; ")}.` : "",
    "Photorealistic 3D product render, whole object centered and fully visible with margin, three-quarter view, soft studio lighting, pure white background, no people, no text, no logos.",
  ].filter(Boolean).join(" ");
}
