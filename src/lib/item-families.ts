/**
 * 품목을 「같은 종류끼리」 묶어 보여 주는 분류표와
 * 사장님이 직접 옮긴 배치(분류·묶음·순서) 덮어쓰기.
 *
 * 원칙:
 * - 품목 원본(ID·이름·가격)은 바꾸지 않고, 화면 배치만 덮어씁니다.
 * - 사장님이 직접 옮긴 배치(layout)가 자동 분류보다 항상 우선합니다.
 * - 공간(베란다·안방) 선택과 품목 분류(가구·가전)는 서로 다른 개념입니다.
 */

/** 묶음(그룹) 분류표 — 더 좁은 이름을 먼저 둡니다. */
export const ITEM_FAMILIES: { match: RegExp; label: string; rank: number }[] = [
  // 「화분받침대」처럼 침대가 아닌 물건은 침대 묶음에 들어오지 않게 합니다
  { match: /화분|식물|받침대/, label: "생활·기타", rank: 80 },
  // 빨래건조대는 전기 건조기와 다른 물건입니다 — 건조기 규칙보다 먼저 둡니다
  { match: /빨래\s*건조대|건조대|빨래걸이/, label: "빨래건조대", rank: 81 },
  { match: /침대|매트리스|토퍼|헤드보드|평상/, label: "침대·매트리스", rank: 10 },
  { match: /옷장|장롱|붙박이장|드레스룸|이불장|농(?![가-힣])/, label: "옷장·장롱", rank: 11 },
  { match: /행거/, label: "행거", rank: 12 },
  { match: /서랍장|드레서|체스트/, label: "서랍장", rank: 13 },
  { match: /화장대|경대/, label: "화장대", rank: 14 },
  { match: /협탁|사이드장|나이트테이블/, label: "협탁", rank: 15 },
  { match: /소파|쇼파|리클라이너|안락의자|빈백|흔들의자/, label: "소파", rank: 20 },
  { match: /거실테이블|소파테이블|티테이블|커피테이블|네스팅|콘솔테이블/, label: "거실 테이블", rank: 21 },
  { match: /tv장|거실장|아트월|장식장|진열장|사이드보드/i, label: "거실장·장식장", rank: 22 },
  { match: /책상|데스크/, label: "책상", rank: 30 },
  { match: /책장|선반/, label: "책장·선반", rank: 31 },
  { match: /수납장|캐비닛|정리함|수납벤치|신발장|신발 정리대/, label: "수납장", rank: 32 },
  { match: /식탁|다이닝|홈바테이블/, label: "식탁", rank: 40 },
  { match: /의자|벤치|스툴/, label: "의자", rank: 41 },
  { match: /찬장|그릇장|주방.*수납|팬트리|레인지대|전자레인지선반|주방트롤리/, label: "주방 수납", rank: 42 },
  { match: /냉장고|냉동고|와인셀러/, label: "냉장고", rank: 50 },
  { match: /세탁기|통돌이|드럼세탁|워시타워|세탁건조/, label: "세탁기", rank: 51 },
  { match: /건조기|건전기|의류건조/, label: "건조기", rank: 52 },
  { match: /스타일러|의류관리기/, label: "스타일러·의류관리기", rank: 53 },
  { match: /에어컨/, label: "에어컨", rank: 54 },
  { match: /공기청정기|청정기/, label: "공기청정기", rank: 55 },
  { match: /제습기|가습기|선풍기|히터|실링팬|써큘레이터|난로|온풍기/, label: "냉난방·공기", rank: 56 },
  { match: /tv|티비|모니터|스피커|서브우퍼|오디오|프로젝터|피아노|오르간|게임|턴테이블/i, label: "TV·영상·음향", rank: 57 },
  { match: /청소기|스팀청소/, label: "청소기", rank: 58 },
  { match: /전자레인지|오븐|에어프라이어|가스레인지|인덕션|전기레인지|밥솥|커피|믹서|토스터|전기포트|식기세척기|정수기|제빙기|렌지후드|음식물/, label: "주방가전", rank: 59 },
];

export interface ItemFamily {
  label: string;
  rank: number;
}

/** 품목 이름으로 어울리는 묶음을 찾습니다. 못 찾으면 fallback(또는 기타). */
export function itemFamily(name: string, fallback: string): ItemFamily {
  const found = ITEM_FAMILIES.find(({ match }) => match.test(name));
  return found ?? { label: fallback || "기타", rank: 90 };
}

/** 사장님이 직접 옮긴 품목 한 개의 배치 */
export interface ItemLayoutEntry {
  /** 대분류 탭 (가구·가전·주방·생활용품·운동·레저용품·기타) */
  cat5?: string;
  /** 묶음(그룹) 제목 */
  group?: string;
  /** 묶음 안에서의 순서 (작을수록 앞) */
  order?: number;
}

/** 업체별 배치 덮어쓰기 전체 — 키는 품목 ID */
export type ItemLayout = Record<string, ItemLayoutEntry>;

export interface LayoutItem {
  id: string;
  name: string;
  cat5?: string;
  sub?: string;
  group?: string;
  baseName?: string;
}

/** 품목의 실제 대분류 — 직접 옮긴 값이 있으면 그것을 씁니다. */
export function effectiveCat5(item: LayoutItem, layout: ItemLayout): string {
  return layout[item.id]?.cat5 || item.cat5 || "기타";
}

/** 품목의 실제 묶음 제목 — 직접 옮긴 값 > 저장된 그룹 > 이름 자동 분류 순입니다. */
export function effectiveGroup(item: LayoutItem, layout: ItemLayout): string {
  const manual = layout[item.id]?.group;
  if (manual) return manual;
  const saved = item.group || item.sub;
  return itemFamily(item.baseName || item.name, saved || "기타").label;
}

/** 묶음 제목의 기본 정렬 순서 */
export function groupRank(label: string): number {
  return ITEM_FAMILIES.find((f) => f.label === label)?.rank ?? 90;
}

/**
 * 목록 정렬 — 직접 옮긴 순서가 있으면 그 값을 우선하고,
 * 없으면 묶음 순서 → 이름 순으로 정렬합니다.
 */
export function layoutSort<T extends LayoutItem>(list: T[], layout: ItemLayout): T[] {
  return list
    .map((v, i) => ({
      v,
      i,
      g: effectiveGroup(v, layout),
      o: layout[v.id]?.order,
    }))
    .sort(
      (a, b) =>
        groupRank(a.g) - groupRank(b.g) ||
        a.g.localeCompare(b.g, "ko") ||
        (a.o ?? 5000) - (b.o ?? 5000) ||
        a.i - b.i,
    )
    .map((x) => x.v);
}

/**
 * 드래그 결과로 저장할 배치 조각을 만듭니다.
 * targetIds는 대상 묶음의 품목 ID 목록(옮길 품목 제외, 화면 순서)이고
 * index는 그 목록에서 들어갈 자리입니다.
 * 옮긴 품목뿐 아니라 대상 묶음 전체의 순서를 함께 저장해
 * 새로고침 후에도 화면에서 본 순서 그대로 유지되게 합니다.
 */
export function buildMovePatch(
  itemId: string,
  target: { cat5: string; group: string },
  targetIds: string[],
  index: number,
  layout: ItemLayout,
): ItemLayout {
  const ids = [...targetIds.slice(0, index), itemId, ...targetIds.slice(index)];
  const patch: ItemLayout = {};
  ids.forEach((id, i) => {
    const prev = layout[id];
    patch[id] = id === itemId
      ? { ...prev, cat5: target.cat5, group: target.group, order: i * 10 }
      : { ...prev, order: i * 10 };
  });
  return patch;
}
