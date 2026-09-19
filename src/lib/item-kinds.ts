/**
 * 「목록에 없는 품목 추가」에서 사장님이 고르는 품목 종류.
 *
 * 사장님에게는 크기(소형·중형·대형)나 부피를 묻지 않습니다.
 * 고른 종류에 맞는 기본 부피값(루베)을 여기서 자동으로 정해
 * 차량 적재량 계산에 그대로 반영합니다.
 */

export interface ItemKind {
  /** 화면에 보이는 종류 이름 (= 품목 그룹 이름) */
  label: string;
  /** 기존 대분류 (탭 분류에 사용) */
  cat: string;
  /** 차량 계산에 쓰는 기본 부피값 (루베) */
  volume: number;
}

export const ITEM_KINDS: ItemKind[] = [
  { label: "침대", cat: "가구", volume: 1.2 },
  { label: "옷장·장롱", cat: "가구", volume: 1.4 },
  { label: "서랍장·수납장", cat: "가구", volume: 0.6 },
  { label: "소파", cat: "가구", volume: 1.2 },
  { label: "TV", cat: "가전", volume: 0.3 },
  { label: "TV장·거실장", cat: "가구", volume: 0.7 },
  { label: "테이블", cat: "가구", volume: 0.4 },
  { label: "식탁", cat: "주방", volume: 0.8 },
  { label: "의자", cat: "가구", volume: 0.2 },
  { label: "냉장고", cat: "가전", volume: 1.0 },
  { label: "세탁기·건조기", cat: "가전", volume: 0.7 },
  { label: "가전", cat: "가전", volume: 0.4 },
  { label: "주방", cat: "주방", volume: 0.3 },
  { label: "생활용품", cat: "생활용품", volume: 0.2 },
  { label: "운동·레저", cat: "레저", volume: 0.5 },
  { label: "기타", cat: "기타", volume: 0.3 },
];

const BY_LABEL = new Map(ITEM_KINDS.map((k) => [k.label, k]));

/** 종류 이름으로 기본 정보를 찾습니다 (모르면 기타) */
export function kindOf(label?: string): ItemKind {
  return BY_LABEL.get(label ?? "") ?? ITEM_KINDS[ITEM_KINDS.length - 1];
}

/** 이름만 보고 종류를 추측합니다 (팝업의 기본 선택값) */
export function guessKind(name: string): string {
  const n = (name || "").toLowerCase();
  const rules: [RegExp, string][] = [
    [/침대|매트리스|토퍼|평상/, "침대"],
    [/옷장|장롱|붙박이|행거|이불장/, "옷장·장롱"],
    [/서랍|협탁|수납장|드레서|체스트|화장대|책장/, "서랍장·수납장"],
    [/소파|쇼파|리클라이너|카우치/, "소파"],
    [/tv장|티비장|tv다이|티비다이|거실장|장식장|진열장/, "TV장·거실장"],
    [/tv|티비|텔레비|모니터/, "TV"],
    [/식탁|다이닝/, "식탁"],
    [/테이블|책상|데스크/, "테이블"],
    [/의자|스툴|벤치/, "의자"],
    [/냉장고|냉동고|김치|와인셀러/, "냉장고"],
    [/세탁|건조기|스타일러|워시타워|통돌이/, "세탁기·건조기"],
    [/에어컨|공기청정|청소기|정수기|전자레인지|오븐|컴퓨터|프린터|안마/, "가전"],
    [/주방|냄비|그릇|식기|밥솥|가스|인덕션|쌀통/, "주방"],
    [/운동|헬스|자전거|골프|런닝|러닝|캠핑|낚시|피아노|악기/, "운동·레저"],
    [/화분|빨래|건조대|청소|공구|사다리|거울|이불|커튼|박스|상자/, "생활용품"],
  ];
  const hit = rules.find(([re]) => re.test(n));
  return hit ? hit[1] : "기타";
}
