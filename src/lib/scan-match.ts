import { ITEM_CATALOG, type CustomItem } from "./jimpick";

const SYNONYMS: Record<string, string> = {
  쇼파: "소파", 소파: "소파", 티비: "tv", 텔레비전: "tv", 텔레비: "tv", 에어콘: "에어컨",
  장농: "장롱", 옷장: "장롱", 냉동냉장고: "냉장고", 양문형냉장고: "냉장고", 김치통: "김치통장독",
  세탁기통돌이: "세탁기", 모니터: "컴퓨터모니터", 컴퓨터: "컴퓨터모니터", 식탁의자: "의자",
  박스: "이삿짐박스", 상자: "이삿짐박스", 수납장: "주방수납장", 러그: "카펫러그", 카펫: "카펫러그",
  블라인드: "커튼블라인드", 커튼: "커튼블라인드", 캐리어: "캐리어여행가방", 거울: "전신거울",
};

export function normScanName(raw: string): string {
  const n = (raw || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[\s·・.,/\\_\-()]/g, "");
  return SYNONYMS[n] ?? n;
}

export interface CatalogEntry {
  id: string;
  name: string;
  cat: string;
}

export function buildCatalog(company: CustomItem[]): CatalogEntry[] {
  const list: CatalogEntry[] = ITEM_CATALOG.map((i) => ({ id: i.id, name: i.name, cat: i.cat }));
  for (const c of company) if (c.active !== false) list.push({ id: c.id, name: c.name, cat: c.cat });
  return list;
}

/** 인식 이름을 기존 품목(기본 + 업체 품목)과 비교해 같은 품목 id 를 찾습니다. */
export function matchCatalog(name: string, catalog: CatalogEntry[]): CatalogEntry | null {
  const full = (x: string) => x.toLowerCase().replace(/[\s·・.,/\\_\-()]/g, "");
  const f = full(name);
  const exact = catalog.find((c) => full(c.name) === f);
  if (exact) return exact;
  const n = normScanName(name);
  if (n.length < 1) return null;
  let best: CatalogEntry | null = null;
  let bestScore = 0;
  for (const c of catalog) {
    const cn = normScanName(c.name);
    if (!cn) continue;
    if (cn === n) return c;
    // 부분 일치는 짧은 쪽이 2글자 이상이고 길이 차이가 작을 때만
    const short = cn.length < n.length ? cn : n;
    const long = cn.length < n.length ? n : cn;
    if (short.length >= 2 && long.includes(short)) {
      const score = short.length / long.length;
      if (score > bestScore && score >= 0.5) {
        best = c;
        bestScore = score;
      }
    }
  }
  return best;
}

export const AUTO_CONF = 0.9;
export const CHECK_CONF = 0.75;
