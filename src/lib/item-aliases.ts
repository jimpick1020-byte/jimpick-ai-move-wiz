/**
 * 품목 이름 맞추기 — AI가 돌려준 이름(한글·영문)을 기존 JIMPICK 품목에 연결합니다.
 *
 *  - 서버 요청 전에 화면(기기) 안에서 먼저 찾습니다. (빠른 연결)
 *  - 같은 뜻의 다른 이름이면 새 품목을 만들지 않고 기존 품목 id 를 씁니다.
 *  - 영문 모델 이름은 화면에 쓰지 않고, 항상 한글 품목명으로 바꿔 보여 줍니다.
 */
import { ITEM_CATALOG } from "./jimpick";

/** 이름 비교용 정규화 — 공백·기호·괄호 제거, 소문자 */
export function normalizeLabel(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[\s·・.,'"()[\]{}/\\_-]/g, "")
    .trim();
}

/** 영문·구어체 별칭 → 기존 품목 id */
const ALIAS: Record<string, string> = {
  // 소파·거실
  couch: "sofa",
  sofa: "sofa",
  loveseat: "sofa",
  twoseatersofa: "sofa",
  소파2인: "sofa",
  쇼파: "sofa",
  sectionalsofa: "sofabig",
  cornersofa: "sofabig",
  recliner: "recliner",
  tvstand: "tvstand",
  tvconsole: "tvstand",
  mediaconsole: "tvstand",
  mediacabinet: "tvstand",
  sideboard: "tvstand",
  티비다이: "tvstand",
  거실장: "tvstand",
  coffeetable: "teatable",
  sidetable: "teatable",
  티테이블: "teatable",
  rug: "carpet",
  carpet: "carpet",
  // TV·가전
  tv: "tv",
  television: "tv",
  televisionset: "tv",
  flatscreentv: "tv",
  monitor: "pc",
  refrigerator: "fridge",
  fridge: "fridge",
  freezer: "freezer",
  kimchirefrigerator: "kimchi",
  kimchifridge: "kimchi",
  김치냉장고: "kimchi",
  washingmachine: "washer",
  washer: "washer",
  frontloadwasher: "drumwasher",
  드럼세탁기: "drumwasher",
  dryer: "dryer",
  clothesdryer: "dryer",
  airconditioner: "aircon",
  standaircon: "aircon",
  airpurifier: "airpurifier",
  dishwasher: "dishwasher",
  waterpurifier: "waterpurifier",
  waterdispenser: "waterpurifier",
  microwave: "microwave",
  oven: "oven",
  gasrange: "gasrange",
  stove: "gasrange",
  // 침실·수납
  bed: "bed",
  singlebed: "bed",
  queenbed: "bedq",
  kingbed: "bedq",
  doublebed: "bedq",
  bunkbed: "bunkbed",
  cribbed: "babybed",
  crib: "babybed",
  mattress: "mattress",
  wardrobe: "wardrobe",
  closet: "wardrobe",
  armoire: "wardrobe",
  옷장: "wardrobe",
  장롱: "wardrobe",
  dresser: "drawer",
  chestofdrawers: "drawer",
  drawer: "drawer",
  서랍장: "drawer",
  nightstand: "nightstand",
  bedsidetable: "nightstand",
  vanity: "vanity",
  dressingtable: "vanity",
  bookshelf: "shelf",
  bookcase: "shelf",
  shelf: "shelf",
  shoerack: "shoerack",
  shoecabinet: "shoerack",
  displaycabinet: "displaycase",
  cabinet: "kitchencabinet",
  // 식탁·책상
  diningtable: "table",
  table: "table",
  diningtable6: "table6",
  marbletable: "marbletable",
  kitchenisland: "island",
  chair: "chair",
  diningchair: "chair",
  desk: "desk",
  officedesk: "officedesk",
  officechair: "officechair",
  // 생활·반려
  cattree: "cattower",
  cattower: "cattower",
  catcondo: "cattower",
  scratchingpost: "cattower",
  고양이타워: "cattower",
  캣타워: "cattower",
  petcage: "petcage",
  dogcage: "petcage",
  pottedplant: "plant",
  plant: "plant",
  houseplant: "plant",
  flowerpot: "plant",
  화분: "plant",
  largeplant: "bigplant",
  대형화분: "bigplant",
  mirror: "mirror",
  fulllengthmirror: "mirror",
  floorlamp: "standlight",
  standinglamp: "standlight",
  piano: "piano",
  uprightpiano: "piano",
  grandpiano: "grandpiano",
  digitalpiano: "digitalpiano",
  aquarium: "aquarium",
  fishtank: "aquarium",
  safe: "safe",
  massagechair: "massagechair",
  treadmill: "treadmill",
  exercisebike: "bike2",
  bicycle: "bicycle",
  stroller: "stroller",
  luggage: "luggage",
  suitcase: "luggage",
  airfryer: "airfryer",
  vacuumcleaner: "vacuum",
  robotvacuum: "robotvac",
  picture: "frame",
  pictureframe: "frame",
  artwork: "art",
  curtain: "curtain",
  blind: "curtain",
};

/** 기존 카탈로그 이름 → id (정규화된 이름 기준) */
const CATALOG_INDEX: Map<string, { id: string; name: string; cat: string }> = (() => {
  const map = new Map<string, { id: string; name: string; cat: string }>();
  for (const it of ITEM_CATALOG) {
    const entry = { id: it.id, name: it.name, cat: it.cat };
    map.set(normalizeLabel(it.name), entry);
    map.set(normalizeLabel(it.id), entry);
  }
  return map;
})();

export interface MatchedItem {
  id: string;
  name: string;
  cat: string;
  /** 어떻게 찾았는지 — exact(이름) / alias(별칭) / similar(비슷한 이름) / custom(업체 생성 품목) */
  how: "exact" | "alias" | "similar" | "custom";
}

/**
 * AI가 준 이름을 기존 품목에 연결합니다.
 * 순서: 정확한 한글명 → 별칭(영문·구어체) → 업체가 전에 만든 품목 → 비슷한 이름 → 없음(null)
 */
export function matchCatalogItem(
  rawLabel: string,
  custom: { id: string; name: string; cat: string; active?: boolean }[] = [],
): MatchedItem | null {
  const key = normalizeLabel(rawLabel);
  if (!key) return null;

  const exact = CATALOG_INDEX.get(key);
  if (exact) return { ...exact, how: "exact" };

  const aliasId = ALIAS[key];
  if (aliasId) {
    const found = ITEM_CATALOG.find((i) => i.id === aliasId);
    if (found) return { id: found.id, name: found.name, cat: found.cat, how: "alias" };
  }

  // 업체가 전에 직접 만든 품목 (같은 이름이면 다시 만들지 않습니다)
  for (const c of custom) {
    if (c.active === false) continue;
    if (normalizeLabel(c.name) === key) return { id: c.id, name: c.name, cat: c.cat, how: "custom" };
  }

  // 부분 일치 — "2인용소파" → 소파, "양문형냉장고" → 냉장고
  let best: { id: string; name: string; cat: string; score: number } | null = null;
  for (const it of ITEM_CATALOG) {
    const base = normalizeLabel(it.name);
    if (base.length < 2) continue;
    if (key.includes(base) || base.includes(key)) {
      const score = base.length;
      if (!best || score > best.score) best = { id: it.id, name: it.name, cat: it.cat, score };
    }
  }
  if (best) return { id: best.id, name: best.name, cat: best.cat, how: "similar" };

  for (const [alias, id] of Object.entries(ALIAS)) {
    if (alias.length >= 4 && (key.includes(alias) || alias.includes(key))) {
      const found = ITEM_CATALOG.find((i) => i.id === id);
      if (found) return { id: found.id, name: found.name, cat: found.cat, how: "similar" };
    }
  }
  return null;
}

/** 목록에 없는 품목의 분류를 이름으로 추측합니다 (자동 등록용) */
export function guessCategory(nameKo: string): string {
  const n = normalizeLabel(nameKo);
  if (/(냉장고|세탁기|건조기|tv|에어컨|청정기|정수기|전자레인지|오븐|인덕션|식기세척)/.test(n))
    return "가전";
  if (/(소파|침대|장롱|옷장|서랍|책장|책상|식탁|의자|테이블|선반|화장대|협탁)/.test(n)) return "가구";
  if (/(냄비|그릇|주방|밥솥|믹서)/.test(n)) return "주방";
  if (/(피아노|금고|수족관|어항|안마)/.test(n)) return "특수";
  return "생활용품";
}
