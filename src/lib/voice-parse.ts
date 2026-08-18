/**
 * 말한 문장을 공간·품목·수량·단위·추가작업·차량으로 나눠 주는 해석기.
 *
 * 서버 AI 없이 이 파일 안에서 끝냅니다. 그래서
 *   - 인터넷이 느려도 바로 담기고,
 *   - 무엇을 어떻게 알아들었는지 시험으로 직접 확인할 수 있습니다.
 *
 * 확신이 낮으면 자동으로 담지 않고 후보를 보여 줍니다(candidates).
 */
import { ITEM_CATALOG } from "./jimpick";

// ============ 숫자 ============

/** 한국말 수 (하나~스물, 그리고 한자말 일~십) */
const KO_NUM: Record<string, number> = {
  한: 1,
  하나: 1,
  일: 1,
  원: 1,
  두: 2,
  둘: 2,
  이: 2,
  세: 3,
  셋: 3,
  서: 3,
  석: 3,
  삼: 3,
  네: 4,
  넷: 4,
  너: 4,
  넉: 4,
  사: 4,
  다섯: 5,
  오: 5,
  여섯: 6,
  육: 6,
  일곱: 7,
  칠: 7,
  여덟: 8,
  여덜: 8,
  팔: 8,
  아홉: 9,
  구: 9,
  열: 10,
  십: 10,
  열한: 11,
  열하나: 11,
  십일: 11,
  열두: 12,
  열둘: 12,
  십이: 12,
  열세: 13,
  열셋: 13,
  열네: 14,
  열넷: 14,
  열다섯: 15,
  스무: 20,
  스물: 20,
  이십: 20,
};

/** 수량 뒤에 붙는 단위 (세는 말) */
const UNITS = [
  "개",
  "대",
  "짝",
  "장",
  "세트",
  "셋트",
  "조",
  "통",
  "박스",
  "상자",
  "판",
  "켤레",
  "병",
  "팩",
  "쌍",
  "채",
  "점",
  "칸",
  "구",
  "면",
  "톤",
];

const UNIT_RE = UNITS.slice()
  .sort((a, b) => b.length - a.length)
  .join("|");
const KO_NUM_RE = Object.keys(KO_NUM)
  .sort((a, b) => b.length - a.length)
  .join("|");

/**
 * 문장 안에서 "수량 + 단위"를 찾습니다.
 * 못 찾으면 1개로 봅니다 (말할 때 수량을 자주 빠뜨리기 때문입니다).
 */
export function extractQty(text: string): { qty: number; unit: string; rest: string } {
  // 1) 숫자 + 단위  (예: 2개, 3 대)
  const digit = new RegExp(`(\\d+)\\s*(${UNIT_RE})?`).exec(text);
  // 2) 한국말 수 + 단위 (예: 두 개, 한짝)
  const korean = new RegExp(`(${KO_NUM_RE})\\s*(${UNIT_RE})`).exec(text);

  // 한국말 수는 품목 이름 안 글자와 겹칠 수 있어(예: 사다리의 '사')
  // 단위가 붙어 있을 때만 인정합니다.
  if (digit && (digit[2] || !korean)) {
    const qty = Math.max(1, Math.min(99, parseInt(digit[1], 10)));
    return { qty, unit: digit[2] ?? "개", rest: text.replace(digit[0], " ") };
  }
  if (korean) {
    return {
      qty: KO_NUM[korean[1]] ?? 1,
      unit: korean[2],
      rest: text.replace(korean[0], " "),
    };
  }
  return { qty: 1, unit: "개", rest: text };
}

// ============ 이름 다듬기 ============

/** 말투 차이를 없애 비교하기 좋은 모양으로 바꿉니다 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[·・\-_,.!?~"'`()[\]]/g, "")
    .replace(/\s+/g, "")
    .replace(/티브이|티비|테레비|텔레비전|텔레비젼/g, "tv")
    .replace(/에어콘/g, "에어컨")
    .replace(/쇼파/g, "소파")
    .replace(/침때|침대장/g, "침대")
    .replace(/냉장구/g, "냉장고");
}

/**
 * normalize 와 같지만 띄어쓰기만 남깁니다.
 * 말과 말 사이가 어디였는지 알아야 이름을 더 정확히 끊을 수 있습니다.
 */
export function normalizeKeepSpace(s: string): string {
  return s
    .toLowerCase()
    .replace(/[·・\-_,.!?~"'`()[\]]/g, "")
    .replace(/\s+/g, " ")
    .replace(/티브이|티비|테레비|텔레비전|텔레비젼/g, "tv")
    .replace(/에어콘/g, "에어컨")
    .replace(/쇼파/g, "소파")
    .replace(/침때|침대장/g, "침대")
    .replace(/냉장구/g, "냉장고");
}

// ============ 별칭 사전 ============

/**
 * 품목 하나가 여러 이름으로 불립니다.
 * 목록에 없는 말은 여기에 더하면 바로 인식됩니다.
 */
export const ITEM_ALIASES: Record<string, string[]> = {
  tv: ["tv", "티비", "텔레비전", "테레비", "브라운관"],
  walltv: ["벽걸이tv", "벽걸이티비", "벽걸이"],
  fridge: ["냉장고", "냉장구", "양문형냉장고", "일반냉장고"],
  kimchi: ["김치냉장고", "김냉", "딤채"],
  washer: ["세탁기", "통돌이"],
  drumwasher: ["드럼세탁기", "드럼"],
  dryer: ["건조기"],
  aircon: ["에어컨", "스탠드에어컨", "에어콘", "벽걸이에어컨"],
  bedq: [
    "퀸침대",
    "킹침대",
    "퀸사이즈침대",
    "킹사이즈침대",
    "더블침대",
    "침대",
    "퀸베드",
    "킹베드",
  ],
  bed: ["싱글침대", "일인용침대", "슈퍼싱글", "ss침대"],
  bunkbed: ["이층침대", "2층침대", "벙커침대"],
  wardrobe: ["장롱", "옷장", "농", "이불장"],
  drawer: ["서랍장", "수납장", "체스트"],
  sofa: ["소파", "쇼파", "삼인소파", "3인소파", "쇼파3인"],
  sofabig: ["4인소파", "사인소파", "대형소파"],
  desk: ["책상", "컴퓨터책상", "학생책상"],
  shelf: ["책장", "책꽂이", "서가"],
  table: ["식탁", "4인식탁", "밥상", "다이닝테이블"],
  chair: ["의자"],
  vanity: ["화장대"],
  shoerack: ["신발장"],
  pc: ["컴퓨터", "모니터", "본체", "데스크탑", "피시"],
  airpurifier: ["공기청정기"],
  microwave: ["전자레인지", "전자렌지", "렌지"],
  riceCooker: ["밥솥", "전기밥솥"],
  waterpurifier: ["정수기"],
  gasrange: ["가스레인지", "가스렌지"],
  induction: ["인덕션"],
  piano: ["피아노", "업라이트피아노", "디지털피아노"],
  safe: ["금고"],
  treadmill: ["러닝머신", "런닝머신"],
  massagechair: ["안마의자"],
  aquarium: ["어항", "수족관"],
  bicycle: ["자전거"],
  mirror: ["전신거울", "거울"],
  drying: ["빨래건조대", "건조대"],
  box: ["이삿짐박스", "박스", "상자"],
  blanket: ["이불세트", "이불"],
};

interface AliasEntry {
  id: string;
  /** 화면에 보여 줄 실제 품목 이름 */
  name: string;
  /** 비교용으로 다듬은 별칭 */
  key: string;
}

/**
 * 품목 목록 + 별칭 사전을 합쳐 찾기 쉬운 표로 만듭니다.
 * 사장님이 직접 만든 품목(customItems)도 같이 넣을 수 있습니다.
 */
export function buildAliasIndex(custom: { id: string; name: string }[] = []): AliasEntry[] {
  const out: AliasEntry[] = [];
  const push = (id: string, name: string, alias: string) => {
    const key = normalize(alias);
    if (key.length < 2) return;
    if (out.some((e) => e.key === key && e.id === id)) return;
    out.push({ id, name, key });
  };
  for (const it of ITEM_CATALOG) {
    push(it.id, it.name, it.name);
    // 괄호 안 설명을 뗀 이름도 별칭으로 (예: 침대(퀸·킹) → 침대)
    const bare = it.name.replace(/\(.*?\)/g, "").trim();
    if (bare && bare !== it.name) push(it.id, it.name, bare);
    // 가운뎃점으로 여러 이름을 붙인 품목은 하나씩 나눠서도 별칭으로
    // (예: 카펫·러그 → 카펫, 러그 / 컴퓨터·모니터 → 컴퓨터, 모니터)
    if (bare.includes("·")) {
      for (const part of bare.split("·")) push(it.id, it.name, part.trim());
    }
    for (const a of ITEM_ALIASES[it.id] ?? []) push(it.id, it.name, a);
  }
  for (const c of custom) push(c.id, c.name, c.name);
  return out;
}

// ============ 품목 찾기 ============

export interface ItemMatch {
  id: string;
  name: string;
  qty: number;
  unit: string;
  /** 0~1. 낮으면 바로 담지 않고 확인을 받습니다 */
  confidence: number;
  /** 헷갈릴 때 보여 줄 다른 후보들 */
  candidates: { id: string; name: string }[];
  /** 실제로 말한 부분 */
  raw: string;
}

/** 두 낱말이 얼마나 닮았는지 (0~1) */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const [long, short] = a.length >= b.length ? [a, b] : [b, a];
  if (long.includes(short)) return short.length / long.length;
  // 같은 글자가 순서대로 몇 개나 이어지는지
  let hit = 0;
  let j = 0;
  for (const ch of long) {
    if (j < short.length && ch === short[j]) {
      hit++;
      j++;
    }
  }
  return hit / long.length;
}

const MIN_SCORE = 0.5;
/** 이 값보다 낮으면 자동으로 담지 않고 확인을 받습니다 */
export const CONFIRM_BELOW = 0.8;

/**
 * 품목 이름 뒤에 붙는 수량을 읽습니다.
 * 띄어쓰기가 없어도 됩니다 (말한 것을 받아쓰면 띄어쓰기가 제멋대로입니다).
 *   "두개" "2개" "세짝" "둘" "10" → 2, 2, 3, 2, 10
 */
export function qtyAfter(gap: string): { qty: number; unit: string } | null {
  const g = gap.replace(/^[은는이가을를의도랑와과에서]+/, "");
  const digit = new RegExp(`^(\\d+)\\s*(${UNIT_RE})?`).exec(g);
  if (digit) {
    return { qty: Math.max(1, Math.min(99, parseInt(digit[1], 10))), unit: digit[2] ?? "개" };
  }
  const ko = new RegExp(`^(${KO_NUM_RE})\\s*(${UNIT_RE})?`).exec(g);
  if (ko) {
    // 단위가 없으면 그 뒤에 다른 말이 이어지면 안 됩니다
    // (예: "세탁기" 의 '세' 를 수량으로 잘못 읽지 않도록)
    if (!ko[2] && g.length > ko[1].length) return null;
    return { qty: KO_NUM[ko[1]] ?? 1, unit: ko[2] ?? "개" };
  }
  return null;
}

/** 한 조각(예: "냉장고 두 대")에서 품목 하나를 찾습니다 (닮은 이름까지 봅니다) */
export function matchItem(chunk: string, index: AliasEntry[]): ItemMatch | null {
  const { qty, unit, rest } = extractQty(chunk);
  const key = normalize(rest).replace(/[은는이가을를의도랑와과에서요]+$/, "");
  if (key.length < 2) return null;

  const scored = index
    .map((e) => ({ e, s: similarity(key, e.key) }))
    .filter((x) => x.s >= MIN_SCORE)
    .sort((a, b) => b.s - a.s || a.e.key.length - b.e.key.length);
  if (!scored.length) return null;

  // 같은 품목이 여러 별칭으로 걸리면 하나로 묶습니다
  const seen = new Set<string>();
  const uniq = scored.filter((x) => !seen.has(x.e.id) && seen.add(x.e.id));
  const top = uniq[0];
  const second = uniq[1];

  // 1등과 2등이 비슷하면 확신을 낮춰 확인을 받습니다
  const gap = second ? top.s - second.s : 1;
  const confidence = Math.min(1, top.s * (gap < 0.12 ? 0.7 : 1));

  return {
    id: top.e.id,
    name: top.e.name,
    qty,
    unit,
    confidence,
    candidates: uniq.slice(0, 4).map((x) => ({ id: x.e.id, name: x.e.name })),
    raw: chunk.trim(),
  };
}

// ============ 추가작업 · 차량 ============

export interface ExtraWork {
  /** OPTION_PRESETS 의 이름과 맞춥니다 */
  name: string;
  raw: string;
}
export interface TruckHint {
  truck1t: number;
  truck5t: number;
  ladder: boolean;
}

const WORK_WORDS: { name: string; words: string[] }[] = [
  { name: "에어컨 이전 설치", words: ["에어컨설치", "에어컨이전", "에어컨이전설치", "에어컨달아"] },
  { name: "에어컨 철거", words: ["에어컨철거", "에어컨떼", "에어컨분리"] },
  { name: "세탁기 설치", words: ["세탁기설치"] },
  { name: "입주 청소", words: ["입주청소", "청소해", "청소도", "청소만", "청소까지"] },
  { name: "폐기물 처리", words: ["폐기물", "버릴것", "버릴짐", "폐기"] },
  { name: "장롱 분해·조립", words: ["장롱분해", "장롱조립", "농분해"] },
  { name: "피아노 운반", words: ["피아노운반"] },
  { name: "금고 운반", words: ["금고운반"] },
  { name: "포장 자재비", words: ["포장자재", "포장이사", "포장비"] },
  { name: "주차/도로 사용료", words: ["주차비", "도로사용료"] },
];

/** 문장 전체에서 추가작업을 찾습니다 */
export function matchExtraWork(text: string): ExtraWork[] {
  const key = normalize(text);
  const out: ExtraWork[] = [];
  for (const w of WORK_WORDS) {
    const hit = w.words.find((x) => key.includes(normalize(x)));
    if (hit) out.push({ name: w.name, raw: hit });
  }
  return out;
}

/**
 * 문장 전체에서 차량(1톤·5톤)과 사다리차를 찾습니다.
 * "1톤 두 대" 처럼 대수를 뒤에 말해도 읽습니다.
 */
export function matchTruck(text: string): TruckHint | null {
  const key = normalize(text);
  const ladder = /사다리차|사다리쓰|사다리불|스카이/.test(key);
  const count = (tonRe: RegExp) => {
    const m = tonRe.exec(key);
    if (!m) return 0;
    const after = key.slice(m.index + m[0].length);
    const q = qtyAfter(after);
    return q?.qty ?? 1;
  };
  const truck1t = count(/(?:1톤|일톤|1t)\s*(?:차|트럭)?/);
  const truck5t = count(/(?:5톤|오톤|5t)\s*(?:차|트럭)?/);
  if (!ladder && !truck1t && !truck5t) return null;
  return { truck1t, truck5t, ladder };
}

// ============ 공간(방) 찾기 ============

/** 자주 쓰는 공간 이름의 다른 말 */
const ROOM_ALIASES: Record<string, string[]> = {
  안방: ["안방", "큰방", "주침실", "부부방", "메인방"],
  작은방: ["작은방", "골방", "둘째방", "아이방", "애기방", "서재"],
  입구방: ["입구방", "현관방", "첫번째방"],
  거실: ["거실", "리빙룸", "마루"],
  부엌: ["부엌", "주방", "키친"],
  베란다: ["베란다", "발코니", "다용도실", "세탁실"],
};

/** 말한 문장에서 어느 공간인지 찾습니다 (없으면 null) */
export function matchRoom(text: string, roomNames: string[]): string | null {
  const key = normalize(text);
  let best: { name: string; len: number } | null = null;
  for (const name of roomNames) {
    const aliases = [name, ...(ROOM_ALIASES[name] ?? [])];
    for (const a of aliases) {
      const k = normalize(a);
      if (k.length >= 2 && key.includes(k)) {
        // 더 긴 이름이 더 정확합니다 (작은방 > 방)
        if (!best || k.length > best.len) best = { name, len: k.length };
      }
    }
  }
  return best?.name ?? null;
}

// ============ 문장 쪼개기 ============

/** 긴 문장을 품목 단위로 자릅니다 */
export function splitChunks(text: string): string[] {
  return text
    .replace(/[,·]/g, " 그리고 ")
    .split(/\s*(?:그리고|하고|이랑|랑|또|또한|및|,)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ============ 전체 해석 ============

export interface VoiceParseResult {
  /** 말한 그대로 (화면에 같이 보여 줍니다) */
  transcript: string;
  /** 말에서 찾은 공간 이름 (없으면 null → 지금 고른 공간에 담습니다) */
  room: string | null;
  /** 바로 담아도 되는 품목 */
  items: ItemMatch[];
  /** 확신이 낮아 확인이 필요한 품목 */
  needConfirm: ItemMatch[];
  /** 아예 못 알아들은 조각 */
  unknown: string[];
  extraWork: ExtraWork[];
  truck: TruckHint | null;
}

/**
 * 말한 문장 하나를 통째로 해석합니다.
 *
 * @param text       말한 문장
 * @param roomNames  지금 견적서에 있는 공간 이름들
 * @param custom     사장님이 직접 만든 품목
 */
export function parseVoice(
  text: string,
  roomNames: string[],
  custom: { id: string; name: string }[] = [],
): VoiceParseResult {
  const index = buildAliasIndex(custom);
  const extraWork = matchExtraWork(text);
  const truck = matchTruck(text);

  // 추가작업·차량으로 이미 쓴 말은 품목에서 뺍니다.
  // 지운 자리에 칸막이(|)를 넣어 앞뒤 말이 붙어 버리지 않게 합니다.
  // (공간 이름은 아직 지우지 않습니다 — "주방 박스" 처럼 품목 이름에
  //  공간 이름이 들어 있는 경우가 있어, 품목을 먼저 찾고 나서 지웁니다)
  // 지울 때는 글자 수를 그대로 두고 칸막이로 덮습니다
  // (아래에서 원문의 띄어쓰기 자리를 그대로 쓰기 때문입니다)
  const blank = (s: string, re: RegExp) => s.replace(re, (m) => "|".repeat(m.length));
  let body = normalize(text);
  for (const w of extraWork) body = blank(body, new RegExp(normalize(w.raw), "g"));
  body = blank(body, /사다리차|사다리불러|스카이/g);
  body = blank(body, /(?:1톤|일톤|1t|5톤|오톤|5t)(?:차|트럭)?/g);
  body = blank(body, /그리고|하고|이랑|또한|및/g);

  // 띄어쓰기를 없애기 전 자리를 기억해 둡니다.
  // 말과 말 사이에서 시작·끝나는 이름을 더 믿기 위해서입니다.
  // 원문에서 띄어 쓴 자리를 body 기준 번호로 옮깁니다
  const spacedAt = new Set<number>();
  {
    let n = 0;
    for (const ch of normalizeKeepSpace(text)) {
      if (ch === " ") spacedAt.add(n);
      else n++;
    }
  }
  const isBoundary = (i: number, len: number) => ({
    start: i === 0 || body[i - 1] === "|" || spacedAt.has(i),
    end: i + len >= body.length || body[i + len] === "|" || spacedAt.has(i + len),
  });
  /**
   * 이름이 끝난 자리가 말이 끝난 자리인지 봅니다.
   * 뒤에 수량·조사·칸막이가 오거나 글이 끝나야 합니다.
   * ("거실 장식장" 에서 '거실장' 을 품목으로 잘못 읽지 않도록 막아 줍니다)
   */
  const endsWell = (i: number, len: number) => {
    const rest = body.slice(i + len);
    if (!rest || rest[0] === "|") return true;
    if (spacedAt.has(i + len)) return true;
    if (/^[은는이가을를도랑와과에서요]/.test(rest)) return true;
    return qtyAfter(rest) !== null;
  };

  // 품목 이름을 문장 안에서 직접 찾습니다.
  // 말한 것을 받아쓰면 띄어쓰기가 제멋대로라, 잘라 놓고 맞추는 것보다 정확합니다.
  // 1) 앞뒤가 모두 말의 경계인 이름 → 2) 앞이 경계인 이름 → 3) 나머지 순으로,
  //    각 단계 안에서는 긴 이름부터 (겹치지 않게) 찾습니다.
  const taken = new Array<boolean>(body.length).fill(false);
  const hits: { id: string; name: string; key: string; start: number; end: number }[] = [];
  const sorted = [...index].sort((a, b) => b.key.length - a.key.length);
  for (const pass of [0, 1, 2]) {
    for (const e of sorted) {
      let from = 0;
      for (;;) {
        const i = body.indexOf(e.key, from);
        if (i < 0) break;
        from = i + 1;
        const j = i + e.key.length;
        const b = isBoundary(i, e.key.length);
        if (pass === 0 && !(b.start && b.end)) continue;
        if (pass === 1 && !(b.start && endsWell(i, e.key.length))) continue;
        if (pass === 2 && !endsWell(i, e.key.length)) continue;
        let free = true;
        for (let k = i; k < j; k++)
          if (taken[k]) {
            free = false;
            break;
          }
        if (!free) continue;
        for (let k = i; k < j; k++) taken[k] = true;
        hits.push({ id: e.id, name: e.name, key: e.key, start: i, end: j });
      }
    }
  }
  hits.sort((a, b) => a.start - b.start);

  // 품목으로 쓰이지 않고 남은 말에서만 공간 이름을 찾습니다
  const uncovered = body
    .split("")
    .map((ch, i) => (taken[i] ? "|" : ch))
    .join("");
  const room = matchRoom(uncovered, roomNames);

  const items: ItemMatch[] = [];
  const needConfirm: ItemMatch[] = [];
  const unknown: string[] = [];

  /** 같은 품목을 두 번 말하면 수량만 더합니다 (같은 줄이 두 개 생기지 않게) */
  const put = (m: ItemMatch) => {
    const dupe = [...items, ...needConfirm].find((x) => x.id === m.id);
    if (dupe) {
      dupe.qty += m.qty;
      return;
    }
    if (m.confidence < CONFIRM_BELOW) needConfirm.push(m);
    else items.push(m);
  };

  hits.forEach((h, n) => {
    const gap = body.slice(h.end, hits[n + 1]?.start ?? body.length);
    const q = qtyAfter(gap);
    put({
      id: h.id,
      name: h.name,
      qty: q?.qty ?? 1,
      unit: q?.unit ?? "개",
      confidence: 1,
      candidates: [{ id: h.id, name: h.name }],
      raw: h.key,
    });
  });

  // 품목으로 잡히지 않고 남은 말 — 닮은 이름을 찾아 후보로 보여 줍니다
  let cursor = 0;
  const leftovers: string[] = [];
  for (const h of hits) {
    leftovers.push(body.slice(cursor, h.start));
    cursor = h.end;
  }
  leftovers.push(body.slice(cursor));
  for (const raw of leftovers) {
    // 공간 이름으로 이미 쓴 말은 품목 후보에서 뺍니다
    // ("거실" 을 'TV장·거실장' 후보로 내밀지 않도록)
    let cut = raw;
    if (room) {
      for (const a of [room, ...(ROOM_ALIASES[room] ?? [])]) {
        cut = cut.replace(new RegExp(normalize(a), "g"), "|");
      }
    }
    for (const piece of cut.split("|")) {
      const cleaned = piece
        .replace(new RegExp(`(${KO_NUM_RE})?\\s*(${UNIT_RE})`, "g"), "")
        .replace(/\d+/g, "")
        .replace(/[은는이가을를의도랑와과에서요주세요있어요같이좀해야필요할게]/g, "");
      if (cleaned.length < 2) continue;
      const m = matchItem(cleaned, index);
      if (!m) {
        unknown.push(piece);
        continue;
      }
      // 이미 담긴 품목이면 다시 담지 않습니다
      if ([...items, ...needConfirm].some((x) => x.id === m.id)) continue;
      // 문장에서 바로 못 찾은 말이라 확신을 낮춰 확인을 받습니다
      put({ ...m, confidence: Math.min(m.confidence, CONFIRM_BELOW - 0.01) });
    }
  }

  return { transcript: text, room, items, needConfirm, unknown, extraWork, truck };
}
