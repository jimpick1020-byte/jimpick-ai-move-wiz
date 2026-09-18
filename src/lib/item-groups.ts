/**
 * 방 안에서 품목을 「같은 종류끼리」 모아 보여 주기 위한 그룹 분류.
 *
 * 품목 이름만 보고 그룹을 정하므로 저장 구조를 바꾸지 않아도
 * 새로고침 후에도 같은 순서가 유지됩니다.
 * 오타(쇼파·티비·김치스텐드·건전기 등)도 같은 그룹으로 인식합니다.
 */

export interface ItemGroup {
  /** 화면에 보여 줄 그룹 이름 */
  label: string;
  /** 정렬 순서 (작을수록 위) */
  rank: number;
}

/** 검사 순서가 중요합니다 — 더 좁은 이름을 먼저 둡니다 */
const RULES: { match: RegExp; label: string; rank: number }[] = [
  { match: /스타일러|의류관리기/, label: "스타일러", rank: 16 },
  {
    match: /세탁기|드럼세탁|통돌이|건조기|건전기|워시타워|의류건조|세탁건조/,
    label: "세탁기·건조기",
    rank: 15,
  },
  { match: /냉장고|냉동고|김치스탠드|김치스텐드|와인셀러/, label: "냉장고", rank: 14 },
  { match: /에어컨/, label: "에어컨", rank: 17 },
  {
    match: /tv장|tv다이|티비장|티비다이|거실장|장식장|진열장|아트월|사이드보드/i,
    label: "TV장·거실장",
    rank: 11,
  },
  { match: /tv|티비|텔레비|스탠바이미|모니터/i, label: "TV", rank: 10 },
  { match: /침대|매트리스|토퍼|헤드보드|평상/, label: "침대", rank: 1 },
  { match: /협탁|사이드장|나이트테이블/, label: "협탁", rank: 2 },
  { match: /화장대|경대/, label: "화장대", rank: 5 },
  { match: /서랍장|드레서|체스트/, label: "서랍장", rank: 3 },
  { match: /옷장|장롱|붙박이장|시스템장|행거|이불장|드레스룸/, label: "옷장·장롱", rank: 4 },
  { match: /책상|데스크/, label: "책상", rank: 6 },
  { match: /책장/, label: "책장", rank: 7 },
  { match: /의자|스툴|벤치/, label: "의자", rank: 8 },
  { match: /식탁|다이닝|홈바테이블/, label: "식탁", rank: 13 },
  { match: /테이블/, label: "테이블", rank: 12 },
  { match: /소파|쇼파|리클라이너|빈백/, label: "소파", rank: 9 },
];

const OTHER: ItemGroup = { label: "기타 품목", rank: 99 };

/**
 * 그룹 안에서 「세부 종류」 순서.
 * 돌침대 바로 뒤에 흙침대가 오도록, 냉장고·세탁기·TV 등도
 * 비슷한 물건끼리 붙여서 보이게 순서를 정해 둡니다.
 * 오타(쇼파·티비·김치스텐드·건전기·흙 침대 등)도 같은 종류로 봅니다.
 */
const SUB_ORDER: RegExp[] = [
  // 침대
  /(퀸|킹).*침대|침대.*(퀸|킹)/,
  /패밀리침대/,
  /슈퍼싱글/,
  /싱글침대/,
  /돌\s*침대/,
  /흙\s*침대/,
  /전동침대/,
  /수납침대/,
  /캐노피/,
  /아기침대|유아침대/,
  /이층침대|벙커/,
  /침대프레임|프레임/,
  /매트리스/,
  /토퍼/,
  // 냉장고
  /4도어|사도어/,
  /양문형/,
  /일반냉장고|냉장고$/,
  /소형냉장고|미니냉장고/,
  /김치냉장고|김치스탠드|김치스텐드/,
  /냉동고/,
  /와인셀러/,
  // 세탁·의류가전
  /드럼세탁/,
  /통돌이/,
  /세탁기/,
  /워시타워/,
  /건조기|건전기/,
  /스타일러|의류관리기/,
  // TV
  /스탠바이미/,
  /벽걸이\s*(tv|티비)/i,
  /스탠드\s*(tv|티비)/i,
  /(tv|티비|텔레비)/i,
  /모니터/,
  // 옷장
  /장롱/,
  /붙박이장/,
  /시스템장/,
  /옷장/,
  /행거/,
  // 서랍장
  /3단\s*서랍|삼단\s*서랍/,
  /5단\s*서랍|오단\s*서랍/,
  /와이드\s*서랍/,
  /서랍장|드레서|체스트/,
  // 식탁
  /원형식탁/,
  /접이식\s*식탁/,
  /\d인\s*식탁/,
  /식탁/,
  // 소파
  /리클라이너/,
  /1인\s*(소파|쇼파)/,
  /3인\s*(소파|쇼파)/,
  /4인\s*(소파|쇼파)/,
  /(소파|쇼파)/,
];

/**
 * 그룹 안에서의 세부 순서 값 — 작을수록 앞에 옵니다.
 * 어디에도 맞지 않으면 그룹의 뒤쪽에 둡니다(삭제하지 않습니다).
 */
export function itemSubRank(name: string): number {
  const n = (name || "").toLowerCase();
  const i = SUB_ORDER.findIndex((re) => re.test(n));
  return i < 0 ? 900 : i;
}

/** 품목 이름(과 분류)으로 그룹을 정합니다 */
export function itemGroup(name: string, cat?: string): ItemGroup {
  const target = `${name || ""} ${cat || ""}`;
  const hit = RULES.find((r) => r.match.test(target));
  return hit ? { label: hit.label, rank: hit.rank } : OTHER;
}

/**
 * 같은 그룹끼리 붙여 정렬합니다.
 * 같은 그룹 안에서는 원래 저장 순서(담은 순서)를 그대로 유지합니다.
 */
export function sortByGroup<T extends { name: string; cat?: string }>(list: T[]): T[] {
  return list
    .map((v, i) => ({ v, i, g: itemGroup(v.name, v.cat) }))
    .sort(
      (a, b) =>
        a.g.rank - b.g.rank ||
        itemSubRank(a.v.name) - itemSubRank(b.v.name) ||
        a.i - b.i,
    )
    .map((x) => x.v);
}
