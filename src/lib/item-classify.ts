/**
 * 새 품목 자동 분류표 — AI 호출 없이 이름 키워드만으로 분류합니다.
 * 우선순위: 1) 정확한 이름 2) 핵심 키워드 3) 현재 카테고리 4) 해당 카테고리 「기타」
 */
import { searchNorm } from "./item-search";

export type ItemMainCat = "가구" | "가전" | "주방" | "생활용품" | "운동·레저";
export const ITEM_MAIN_CATS: ItemMainCat[] = ["가구", "가전", "주방", "생활용품", "운동·레저"];

export interface ItemRule { keys: RegExp; cat: ItemMainCat; group: string; rooms: string[] }

/** 키워드 분류표 — 더 좁은 이름을 먼저 둡니다. */
export const ITEM_KEYWORD_RULES: ItemRule[] = [
  { keys: /매트리스|토퍼/, cat: "가구", group: "침대·매트리스", rooms: ["안방", "작은방"] },
  { keys: /침대|벙커/, cat: "가구", group: "침대", rooms: ["안방", "작은방"] },
  { keys: /신발장/, cat: "가구", group: "현관 수납", rooms: ["입구"] },
  { keys: /장롱|행거|서랍장|옷장|붙박이장|이불장|드레스룸/, cat: "가구", group: "침실 수납", rooms: ["안방", "작은방"] },
  { keys: /화장대|경대/, cat: "가구", group: "화장대", rooms: ["안방", "작은방"] },
  { keys: /책상|책장|사무|데스크/, cat: "가구", group: "책상·책장", rooms: ["작은방", "서재"] },
  { keys: /식탁|의자|벤치|스툴/, cat: "가구", group: "식탁·의자", rooms: ["부엌"] },
  { keys: /소파|쇼파|거실장|tv장|티비장|테이블|장식장/, cat: "가구", group: "거실 가구", rooms: ["거실"] },
  { keys: /냉장고|냉동고|와인셀러/, cat: "가전", group: "냉장고", rooms: ["부엌"] },
  { keys: /세탁기|건조기|워시타워/, cat: "가전", group: "세탁 가전", rooms: ["베란다", "세탁실"] },
  { keys: /스타일러|의류관리기/, cat: "가전", group: "스타일러", rooms: ["안방"] },
  { keys: /tv|티비|텔레비전|모니터/, cat: "가전", group: "TV", rooms: ["거실"] },
  { keys: /에어컨/, cat: "가전", group: "에어컨", rooms: ["거실"] },
  { keys: /청소기/, cat: "가전", group: "청소기", rooms: ["거실"] },
  { keys: /전자레인지|오븐|에어프라이/, cat: "가전", group: "주방 가전", rooms: ["부엌"] },
  { keys: /싱크대|식기세척기|가스레인지|인덕션|정수기/, cat: "주방", group: "주방 설비", rooms: ["부엌"] },
  { keys: /식기|그릇|냄비|프라이팬|조리도구|수저/, cat: "주방", group: "식기·조리도구", rooms: ["부엌"] },
  { keys: /골프/, cat: "운동·레저", group: "골프용품", rooms: ["창고", "베란다", "기타"] },
  { keys: /자전거|킥보드/, cat: "운동·레저", group: "자전거·킥보드", rooms: ["창고", "베란다", "기타"] },
  { keys: /스키|스노보드/, cat: "운동·레저", group: "스키용품", rooms: ["창고", "베란다", "기타"] },
  { keys: /러닝머신|트레드밀|운동기구|헬스|덤벨|실내자전거/, cat: "운동·레저", group: "운동기구", rooms: ["창고", "베란다", "기타"] },
  { keys: /캠핑|텐트/, cat: "운동·레저", group: "캠핑용품", rooms: ["창고", "베란다", "기타"] },
  { keys: /이불|베개|커튼|카펫|러그/, cat: "생활용품", group: "침구·커튼", rooms: ["안방", "작은방"] },
  { keys: /청소도구|빗자루|밀대/, cat: "생활용품", group: "청소도구", rooms: ["베란다"] },
  { keys: /신발|옷|가방/, cat: "생활용품", group: "의류·신발", rooms: ["안방", "입구"] },
  { keys: /박스|상자|수납함/, cat: "생활용품", group: "생활박스", rooms: ["창고", "기타"] },
];

/** 정확히 일치하는 품목명 — 키워드보다 먼저 봅니다. */
const EXACT: Record<string, Omit<ItemRule, "keys">> = {
  골프백: { cat: "운동·레저", group: "골프용품", rooms: ["창고", "베란다", "기타"] },
  안마의자: { cat: "가전", group: "안마의자", rooms: ["거실"] },
};

export interface ItemClassification {
  cat: ItemMainCat | null;
  group: string;
  variant: string;
  rooms: string[];
  keywords: string[];
  confident: boolean;
}

function variantOf(name: string, group: string): string {
  const n = searchNorm(name);
  if (group === "침대") {
    const size = /슈퍼싱글/.test(n) ? "슈퍼싱글" : /킹/.test(n) ? "킹" : /퀸/.test(n) ? "퀸" : /더블/.test(n) ? "더블" : /싱글/.test(n) ? "싱글" : /2층|이층|벙커/.test(n) ? "2층" : /아기|유아/.test(n) ? "아기" : "";
    if (size) return `침대(${size})`;
    const kind = n.match(/(모션|돌|흙|수납)침대/);
    return kind ? `${kind[1]}침대` : "침대";
  }
  if (/식탁/.test(n)) { const p = n.match(/(\d)인/); return p ? `식탁(${p[1]}인)` : "식탁"; }
  const key = ITEM_KEYWORD_RULES.find((r) => r.group === group)?.keys.exec(n)?.[0];
  return key || name.trim();
}

/** 품목명을 분류합니다. fallback 은 품목 추가를 시작한 현재 카테고리입니다. */
export function classifyItem(name: string, fallback?: string | null): ItemClassification {
  const n = searchNorm(name);
  const keywords = [...new Set([name.trim(), n])].filter(Boolean);
  const exact = EXACT[n];
  const rule = exact ? { ...exact } : ITEM_KEYWORD_RULES.find((r) => r.keys.test(n));
  if (rule && n) {
    const variant = variantOf(name, rule.group);
    return { cat: rule.cat, group: rule.group, variant, rooms: rule.rooms, keywords: [...new Set([...keywords, rule.group, variant])], confident: true };
  }
  const cat = fallback === "운동·레저용품" ? "운동·레저" : (ITEM_MAIN_CATS as string[]).includes(fallback || "") ? (fallback as ItemMainCat) : null;
  return { cat, group: "기타", variant: name.trim(), rooms: [], keywords, confident: false };
}

/** 목록 화면의 그룹 제목 — 저장된 그룹이 있으면 우선합니다. */
export function displayGroupOf(name: string, saved?: string): string {
  if (saved && saved !== "기타 품목") return saved;
  const c = classifyItem(name);
  return c.confident ? c.group : saved || "기타";
}
