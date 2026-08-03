import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// ============ Types ============
export type MoveType = "포장이사" | "반포장이사" | "일반이사" | "보관이사" | "사무실이사";
export type WorkEnv = "없음" | "계단" | "엘리베이터" | "계단+엘리베이터";
export type EstimateStatus = "작성중" | "진행중" | "완료" | "취소";

export interface RoomItems {
  [itemId: string]: number;
}
export interface Room {
  id: string;
  name: string;
  items: RoomItems;
}
export interface OptionItem {
  id: string;
  name: string;
  enabled: boolean;
  price: number;
  /** 별도(견적 합계에서 제외) */
  separate: boolean;
}
export interface CustomItem {
  id: string;
  name: string;
  cat: string;
  extra: number;
}
export interface Estimate {
  id: string;
  createdAt: number;
  status: EstimateStatus;
  customerName: string;
  phone: string;
  moveType: MoveType;
  moveDate: string;
  moveTime: string;
  fromAddress: string;
  fromDetail: string;
  toAddress: string;
  toDetail: string;
  /** 출발지·도착지 좌표 (경도 x, 위도 y) */
  fromX?: number | null;
  fromY?: number | null;
  toX?: number | null;
  toY?: number | null;
  distanceKm: number;
  durationMin: number;
  workEnv: WorkEnv;
  fromFloor: number;
  toFloor: number;
  workers: number;
  kitchenStaff: number;
  truck1t: number;
  truck5t: number;
  ladder: number;
  /** 사다리차 상세 */
  ladderFrom: boolean;
  ladderTo: boolean;
  ladderFromPrice: number;
  ladderToPrice: number;
  ladderPrice: number;
  ladderSeparate: boolean;
  /** 사다리차 출발지·도착지 별도 여부 (견적 합계에서 제외) */
  ladderFromSeparate: boolean;
  ladderToSeparate: boolean;
  /** 상세 내역에서 직접 추가·수정하는 항목 */
  extraCharges: { id: string; label: string; amount: number }[];
  /** 고객 메모 */
  memo: string;
  /** 특약사항 */
  specialTerms: string;
  rooms: Room[];
  /** 5단계에서 고른 평수 구간 (예: "30~40평") */
  sizeTab?: string;
  customItems: CustomItem[];
  hiddenItems: string[];
  options: OptionItem[];

  storageStart: string;
  storageEnd: string;
  storageDaily: number;
  /** 보관이사가 아니어도 보관 서비스를 추가한 경우 */
  storageEnabled?: boolean;

  /** 기본 운송료 직접 입력 (null이면 자동 계산) */
  transportOverride?: number | null;
  /** 예상 견적 금액 직접 입력 (null이면 자동 합계) */
  totalOverride?: number | null;
  total: number;
}

// ============ Constants ============
export const CATEGORIES = ["전체", "가구", "가전", "주방", "생활용품", "잔짐"] as const;
export const ITEM_CATALOG: { id: string; name: string; cat: string; emoji: string; extra?: number }[] = [
  { id: "bed", name: "침대", cat: "가구", emoji: "🛏️", extra: 20000 },
  { id: "wardrobe", name: "장롱", cat: "가구", emoji: "🚪", extra: 30000 },
  { id: "sofa", name: "소파", cat: "가구", emoji: "🛋️", extra: 20000 },
  { id: "fridge", name: "냉장고", cat: "가전", emoji: "🧊", extra: 30000 },
  { id: "washer", name: "세탁기", cat: "가전", emoji: "🌀", extra: 20000 },
  { id: "tv", name: "TV", cat: "가전", emoji: "📺", extra: 10000 },
  { id: "table", name: "식탁", cat: "가구", emoji: "🍽️", extra: 10000 },
  { id: "chair", name: "의자", cat: "가구", emoji: "🪑" },
  { id: "desk", name: "책상", cat: "가구", emoji: "🖥️", extra: 10000 },
  { id: "shelf", name: "책장", cat: "가구", emoji: "📚", extra: 10000 },
  { id: "aircon", name: "에어컨", cat: "가전", emoji: "❄️", extra: 30000 },
  { id: "microwave", name: "전자레인지", cat: "주방", emoji: "🍱" },
  { id: "waterpurifier", name: "정수기", cat: "주방", emoji: "💧" },
  { id: "kimchi", name: "김치냉장고", cat: "가전", emoji: "🥬", extra: 30000 },
  { id: "vanity", name: "화장대", cat: "가구", emoji: "💄" },
  { id: "drawer", name: "서랍장", cat: "가구", emoji: "🗄️" },
  { id: "dryer", name: "건조기", cat: "가전", emoji: "♨️", extra: 20000 },
  { id: "airpurifier", name: "공기청정기", cat: "가전", emoji: "🍃" },
  { id: "riceCooker", name: "밥솥", cat: "주방", emoji: "🍚" },
  { id: "gasrange", name: "가스레인지", cat: "주방", emoji: "🔥" },
  { id: "dishrack", name: "식기건조대", cat: "주방", emoji: "🍽️" },
  { id: "vacuum", name: "청소기", cat: "생활용품", emoji: "🧹" },
  { id: "drying", name: "빨래건조대", cat: "생활용품", emoji: "🧺" },
  { id: "toolbox", name: "공구함", cat: "생활용품", emoji: "🧰" },
  { id: "plant", name: "화분", cat: "생활용품", emoji: "🪴" },
  { id: "box", name: "이삿짐 박스", cat: "잔짐", emoji: "📦" },
  { id: "clothbox", name: "옷박스", cat: "잔짐", emoji: "👕" },
  { id: "bigbox", name: "대박스", cat: "잔짐", emoji: "📦" },
  { id: "midbox", name: "중박스", cat: "잔짐", emoji: "🗃️" },
  { id: "basket", name: "바구니", cat: "잔짐", emoji: "🧺" },
  { id: "bag", name: "잡화 가방", cat: "잔짐", emoji: "👜" },
  { id: "vinyl", name: "비닐 포장", cat: "잔짐", emoji: "🛍️" },
];
export const DEFAULT_ROOMS = ["안방", "작은방", "입구방", "거실", "부엌", "베란다"];
/** 옵션 품목은 기본값 없이 사용자가 직접 추가합니다. */
export const DEFAULT_OPTIONS: OptionItem[] = [];
/** 견적서에 자주 쓰는 옵션 금액 (빠른 추가용, 금액은 수정 가능) */
export const OPTION_PRESETS: { name: string; price: number }[] = [
  { name: "에어컨 이전 설치", price: 150000 },
  { name: "에어컨 철거", price: 80000 },
  { name: "세탁기 설치", price: 30000 },
  { name: "입주 청소", price: 250000 },
  { name: "폐기물 처리", price: 100000 },
  { name: "장롱 분해·조립", price: 100000 },
  { name: "피아노 운반", price: 200000 },
  { name: "금고 운반", price: 150000 },
  { name: "포장 자재비", price: 50000 },
  { name: "주차/도로 사용료", price: 30000 },
];

/** 기본 품목 프리셋 없음 — 품목은 사장님이 직접 담습니다. */
export const PRESET_30PY: Record<string, RoomItems> = {};

// ============ Pricing ============
export interface Pricing {
  truck1t: number;
  truck5t: number;
  ladder: number;
  worker: number;
  kitchenStaff: number;
  baseKm: number;
  perKm: number;
  stairPerFloor: number;
}

export const DEFAULT_PRICING: Pricing = {
  truck1t: 250000,
  truck5t: 850000,
  ladder: 200000,
  worker: 150000,
  kitchenStaff: 150000,
  baseKm: 20,
  perKm: 2000,
  stairPerFloor: 30000,
};

const PRICING_KEY = "jimpick_pricing_v1";

/** 업체별 단가 (설정 화면에서 수정 가능) */
export function getPricing(): Pricing {
  if (typeof window === "undefined") return DEFAULT_PRICING;
  try {
    const raw = localStorage.getItem(PRICING_KEY);
    if (!raw) return DEFAULT_PRICING;
    return { ...DEFAULT_PRICING, ...(JSON.parse(raw) as Partial<Pricing>) };
  } catch {
    return DEFAULT_PRICING;
  }
}

export function savePricing(p: Pricing) {
  try {
    localStorage.setItem(PRICING_KEY, JSON.stringify(p));
  } catch {}
}

/** @deprecated getPricing() 사용 */
export const PRICING = DEFAULT_PRICING;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 보관 일수 (시작일·종료일 기준). 종료일이 빠르면 -1 */
export function storageDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
  const d = Math.round((e - s) / 86400000);
  return d < 0 ? -1 : d;
}

/** 보관 서비스 사용 여부 */
export function usesStorage(e: Estimate): boolean {
  return e.moveType === "보관이사" || Boolean(e.storageEnabled);
}

export function storageFeeOf(e: Estimate): number {
  if (!usesStorage(e)) return 0;
  const days = storageDays(e.storageStart, e.storageEnd);
  if (days <= 0) return 0;
  return days * Math.max(0, num(e.storageDaily));
}

/** 5톤 차량 1대에 기본 포함되는 인원 */
export const BASE_WORKERS = 2;
export const BASE_KITCHEN = 1;

/** 중앙 견적 계산 서비스 — 모든 화면이 이 함수만 사용합니다. */
export function calcEstimate(
  e: Estimate,
  pricing: Pricing = getPricing(),
): { total: number; parts: { label: string; amount: number }[] } {
  const hasSidePrice = num(e.ladderFromPrice) + num(e.ladderToPrice) > 0;
  const sideFee =
    (e.ladderFromSeparate ? 0 : num(e.ladderFromPrice)) + (e.ladderToSeparate ? 0 : num(e.ladderToPrice));
  const ladderCount = num(e.ladder) || (e.ladderFrom ? 1 : 0) + (e.ladderTo ? 1 : 0);
  const ladderFee = e.ladderSeparate
    ? 0
    : hasSidePrice
      ? sideFee
      : num(e.ladderPrice) || ladderCount * pricing.ladder;

  /** 차량 선택은 종류별로 1회만 금액에 반영합니다 (대수 곱하지 않음) */
  const truck5Fee = num(e.truck5t) > 0 ? pricing.truck5t : 0;
  const truck1Fee = num(e.truck1t) > 0 ? pricing.truck1t : 0;
  const extraKm = Math.max(0, num(e.distanceKm) - pricing.baseKm);
  const distanceFee = Math.round(extraKm * pricing.perKm);
  const stairFloors = e.workEnv.includes("계단")
    ? Math.max(0, num(e.fromFloor) - 1) + Math.max(0, num(e.toFloor) - 1)
    : 0;
  const stairFee = stairFloors * pricing.stairPerFloor;

  /** 수작업 비용 — 사다리차를 쓰지 않는 구간만 인원 1명당 2만원 */
  const manualWork = e.workEnv.includes("계단") || e.workEnv.includes("엘리베이터");
  const manualSides = manualWork ? (e.ladderFrom ? 0 : 1) + (e.ladderTo ? 0 : 1) : 0;
  const manualWorkers = Math.max(0, num(e.workers));
  const MANUAL_PER_WORKER = 20000;
  const manualFee = manualSides * manualWorkers * MANUAL_PER_WORKER;
  const manualSideLabel =
    manualSides === 2 ? "출발지·도착지" : manualSides === 1 ? (e.ladderFrom ? "도착지" : "출발지") : "";

  const autoTransport = truck5Fee + truck1Fee + distanceFee + stairFee + manualFee + ladderFee;
  const overridden = e.transportOverride !== null && e.transportOverride !== undefined;
  const transport = overridden ? num(e.transportOverride) : autoTransport;

  const optionFee = e.options
    .filter((o) => o.enabled && !o.separate)
    .reduce((s, o) => s + Math.max(0, num(o.price)), 0);
  const storageFee = storageFeeOf(e);
  const extras = (e.extraCharges ?? []).reduce((s2, x) => s2 + num(x.amount), 0);

  const sum = transport + optionFee + storageFee + extras;
  const raw = e.totalOverride === null || e.totalOverride === undefined ? sum : num(e.totalOverride);
  const total = Math.max(0, Math.round(Number.isFinite(raw) ? raw : 0));

  const parts = overridden
    ? [{ label: "기본 운송료 (직접 입력)", amount: transport }]
    : [
        { label: "기본 차량 비용 (5톤)", amount: truck5Fee },
        { label: "차 증차비용 (1톤)", amount: truck1Fee },
        { label: `거리 추가비 (${pricing.baseKm}km 초과 ${extraKm.toFixed(1)}km)`, amount: distanceFee },
        { label: "사다리차 비용", amount: ladderFee },
      ].filter((p) => p.amount > 0);



  return {
    total,
    parts: [
      ...(parts.length > 0 ? parts : [{ label: "기본 운송료", amount: transport }]),
      ...(optionFee > 0 ? [{ label: "옵션 비용", amount: optionFee }] : []),
      ...(storageFee > 0 ? [{ label: "보관료", amount: storageFee }] : []),
      ...(e.extraCharges ?? []).map((x) => ({ label: x.label || "추가 항목", amount: num(x.amount) })),
    ],
  };
}



// ============ Store ============
export function newEstimate(): Estimate {
  return {
    id: `est_${Date.now()}`,
    createdAt: Date.now(),
    status: "작성중",
    customerName: "",
    phone: "",
    moveType: "포장이사",
    moveDate: "",
    moveTime: "오전 09:00",
    fromAddress: "",
    fromDetail: "",
    toAddress: "",
    toDetail: "",
    fromX: null,
    fromY: null,
    toX: null,
    toY: null,
    distanceKm: 0,
    durationMin: 0,
    workEnv: "엘리베이터",
    fromFloor: 1,
    toFloor: 1,
    workers: 2,
    kitchenStaff: 1,
    truck1t: 0,
    truck5t: 0,

    ladder: 0,
    ladderFrom: false,
    ladderTo: false,
    ladderFromPrice: 0,
    ladderToPrice: 0,
    ladderPrice: 0,
    ladderSeparate: false,
    ladderFromSeparate: false,
    ladderToSeparate: false,
    extraCharges: [],
    memo: "",
    specialTerms: "",
    rooms: DEFAULT_ROOMS.map((n) => ({ id: `r_${n}`, name: n, items: {} as RoomItems })),
    sizeTab: "30~40평",

    customItems: [],
    hiddenItems: [],
    options: [...DEFAULT_OPTIONS],
    storageStart: "",
    storageEnd: "",
    storageDaily: 20000,
    storageEnabled: false,

    transportOverride: null,
    totalOverride: null,
    total: 0,
  };
}

export type Screen =
  | "splash"
  | "login"
  | "home"
  | "step1"
  | "step2"
  | "step3"
  | "step4"
  | "step6"
  | "plan"
  | "ai"
  | "options"
  | "result"
  | "history"
  | "customers"
  | "signup"
  | "subscription"
  | "settings"
  | "stats";

interface AppState {
  loggedIn: boolean;
  savedId: string;
  screen: Screen;
  draft: Estimate;
  estimates: Estimate[];
  currentRoomId: string;
  /** 5~6단계 진입 직전에 자동 저장되는 스냅샷 */
  stepSnapshot?: Estimate | null;
}

interface Ctx extends AppState {
  setScreen: (s: Screen) => void;
  login: (id: string, remember: boolean) => void;
  logout: () => void;
  updateDraft: (patch: Partial<Estimate>) => void;
  resetDraft: () => void;
  saveDraft: () => void;
  deleteEstimate: (id: string) => void;
  loadEstimate: (id: string) => void;
  setCurrentRoom: (id: string) => void;
  /** 5~6단계 변경 직전 스냅샷으로 즉시 복원 */
  restoreStepSnapshot: () => boolean;
}


const AppCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "jimpick_v8_state";

export function JimpickProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => ({
    loggedIn: false,
    savedId: "",
    screen: "splash" as Screen,
    draft: newEstimate(),
    estimates: [],
    currentRoomId: "",
    stepSnapshot: null,
  }));

  const [hydrated, setHydrated] = useState(false);

  // 하이드레이션 이후에 저장된 상태를 불러옵니다 (SSR 불일치 방지)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as AppState;
        setState({ ...s, screen: s.loggedIn ? "home" : "splash" });
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated]);

  const ctx: Ctx = {
    ...state,
    setScreen: (screen) => setState((s) => ({ ...s, screen })),
    login: (id, remember) =>
      setState((s) => ({ ...s, loggedIn: true, savedId: remember ? id : "", screen: "home" })),
    logout: () => setState((s) => ({ ...s, loggedIn: false, screen: "login" })),
    updateDraft: (patch) => setState((s) => ({ ...s, draft: { ...s.draft, ...patch } })),
    resetDraft: () =>
      setState((s) => ({ ...s, draft: newEstimate(), currentRoomId: "" })),
    saveDraft: () =>
      setState((s) => {
        const { total } = calcEstimate(s.draft);
        const finalized: Estimate = { ...s.draft, total, status: "완료" };
        const idx = s.estimates.findIndex((e) => e.id === finalized.id);
        const estimates =
          idx >= 0
            ? s.estimates.map((e) => (e.id === finalized.id ? finalized : e))
            : [finalized, ...s.estimates];
        return { ...s, estimates, draft: finalized };
      }),
    deleteEstimate: (id) =>
      setState((s) => ({ ...s, estimates: s.estimates.filter((e) => e.id !== id) })),
    loadEstimate: (id) =>
      setState((s) => {
        const e = s.estimates.find((x) => x.id === id);
        return e ? { ...s, draft: { ...e }, screen: "result" } : s;
      }),
    setCurrentRoom: (id) => setState((s) => ({ ...s, currentRoomId: id })),
  };

  return <AppCtx.Provider value={ctx}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

export function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
export function won(n: number) {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return v.toLocaleString("ko-KR") + "원";
}

/** "2026-08-01" + "오전 09:00" → "2026년 8월 1일 오전 09:00" */
export function formatMoveDateTime(date: string, time: string): string {
  if (!date) return "이사 날짜 미입력";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return `${date} ${time ?? ""}`.trim();
  return `${y}년 ${m}월 ${d}일${time ? ` ${time}` : ""}`;
}

/** 방별 품목 요약: 품목 종류 수와 총 수량 */
export function roomSummary(items: RoomItems): { kinds: number; count: number } {
  const values = Object.values(items || {}).filter((v) => Number(v) > 0);
  return { kinds: values.length, count: values.reduce((a, b) => a + Number(b), 0) };
}


/** localStorage에서 견적 ID로 찾기 (공유 페이지 등 Provider 외부에서도 사용) */
export function loadEstimateFromStorage(id: string): Estimate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as AppState;
    return state.estimates.find((e) => e.id === id) || null;
  } catch {
    return null;
  }
}



/** 품목 이름만으로 분류(가구/가전/주방/생활용품/잔짐)를 자동 추정 */
const CAT_KEYWORDS: { cat: string; words: string[] }[] = [
  {
    cat: "가전",
    words: [
      "냉장고","김치","세탁기","건조기","tv","티비","텔레비","에어컨","공기청정","청정기","컴퓨터","pc","모니터","프린터",
      "스타일러","안마의자","비데","보일러","선풍기","히터","온풍기","제습기","가습기","오디오","스피커","전자","로봇청소기",
    ],
  },
  {
    cat: "주방",
    words: ["전자레인지","레인지","정수기","밥솥","가스","인덕션","식기","오븐","에어프라이","커피","냄비","그릇","주방","싱크"],
  },
  {
    cat: "가구",
    words: ["침대","장롱","옷장","붙박이","소파","식탁","의자","책상","책장","화장대","서랍","선반","수납장","테이블","협탁","침구장","피아노","금고","진열장","거울","행거"],
  },
  {
    cat: "생활용품",
    words: ["청소기","건조대","공구","화분","자전거","유모차","운동","런닝","골프","캠핑","빨래","다리미","쓰레기","우산","신발","텐트"],
  },
  {
    cat: "잔짐",
    words: ["박스","바구니","가방","상자","잡화","기타","짐"],
  },
];

export function guessCategory(name: string): string {
  const n = name.toLowerCase().replace(/\s/g, "");
  for (const { cat, words } of CAT_KEYWORDS) {
    if (words.some((w) => n.includes(w))) return cat;
  }
  return "잔짐";
}
