import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// ============ Types ============
export type MoveType = "포장이사" | "반포장이사" | "일반이사" | "보관이사" | "사무실이사";
export type WorkEnv = "계단" | "엘리베이터" | "계단+엘리베이터";
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
  /** 고객 메모 */
  memo: string;
  /** 특약사항 */
  specialTerms: string;
  rooms: Room[];
  customItems: CustomItem[];
  hiddenItems: string[];
  options: OptionItem[];
  storageStart: string;
  storageEnd: string;
  storageDaily: number;
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

/** 30평대 기준 방별 기본 품목 배치 */
export const PRESET_30PY: Record<string, RoomItems> = {
  안방: { bed: 1, wardrobe: 2, vanity: 1, drawer: 1, aircon: 1 },
  작은방: { bed: 1, desk: 1, chair: 1, shelf: 1, wardrobe: 1 },
  입구방: { desk: 1, shelf: 1, drawer: 1, box: 4 },
  거실: { sofa: 1, tv: 1, table: 1, chair: 4, aircon: 1, shelf: 1, airpurifier: 1 },
  부엌: { fridge: 1, kimchi: 1, microwave: 1, waterpurifier: 1, riceCooker: 1, gasrange: 1, dishrack: 1 },
  베란다: { washer: 1, dryer: 1, drying: 1, vacuum: 1, toolbox: 1, plant: 3, box: 5 },
};

// ============ Pricing ============
export const PRICING = {
  truck1t: 250000,
  truck5t: 850000,
  ladder: 200000,
  worker: 150000,
  kitchenStaff: 150000,
  baseKm: 20,
  perKm: 2000,
  stairPerFloor: 30000,
};

export function calcEstimate(e: Estimate): { total: number; parts: { label: string; amount: number }[] } {
  const ladderFee = e.ladderSeparate ? 0 : e.ladderPrice || e.ladder * PRICING.ladder;
  const autoTransport = e.truck1t * PRICING.truck1t + e.truck5t * PRICING.truck5t + ladderFee;
  const transport =
    e.transportOverride === null || e.transportOverride === undefined ? autoTransport : e.transportOverride;
  const stairFloors =
    e.workEnv.includes("계단") ? Math.max(0, e.fromFloor - 1) + Math.max(0, e.toFloor - 1) : 0;
  const stairFee = stairFloors * PRICING.stairPerFloor;
  const optionFee = e.options
    .filter((o) => o.enabled && !o.separate)
    .reduce((s, o) => s + (o.price || 0), 0);
  let storageFee = 0;
  if (e.moveType === "보관이사" && e.storageStart && e.storageEnd) {
    const days = Math.max(
      0,
      Math.round((new Date(e.storageEnd).getTime() - new Date(e.storageStart).getTime()) / 86400000)
    );
    storageFee = days * (e.storageDaily || 0);
  }
  const sum = transport + stairFee + optionFee + storageFee;
  const total = e.totalOverride === null || e.totalOverride === undefined ? sum : e.totalOverride;
  return {
    total,
    parts: [
      { label: "기본 운송료", amount: transport },
      { label: "계단 추가비", amount: stairFee },
      { label: "옵션 비용", amount: optionFee },
      { label: "보관료", amount: storageFee },
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
    truck5t: 1,
    ladder: 0,
    ladderFrom: false,
    ladderTo: false,
    ladderFromPrice: 0,
    ladderToPrice: 0,
    ladderPrice: 0,
    ladderSeparate: false,
    memo: "",
    specialTerms: "",
    rooms: DEFAULT_ROOMS.map((n) => ({ id: `r_${n}`, name: n, items: { ...(PRESET_30PY[n] || {}) } })),
    customItems: [],
    hiddenItems: [],
    options: [...DEFAULT_OPTIONS],
    storageStart: "",
    storageEnd: "",
    storageDaily: 20000,
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
  | "step5"
  | "step6"
  | "ai"
  | "options"
  | "result"
  | "history"
  | "customers"
  | "signup"
  | "subscription"
  | "settings";

interface AppState {
  loggedIn: boolean;
  savedId: string;
  screen: Screen;
  draft: Estimate;
  estimates: Estimate[];
  currentRoomId: string;
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
}

const AppCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "jimpick_v8_state";

export function JimpickProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    if (typeof window === "undefined")
      return {
        loggedIn: false,
        savedId: "",
        screen: "splash",
        draft: newEstimate(),
        estimates: [],
        currentRoomId: "",
      };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as AppState;
        return { ...s, screen: s.loggedIn ? "home" : "splash" };
      }
    } catch {}
    return {
      loggedIn: false,
      savedId: "",
      screen: "splash",
      draft: newEstimate(),
      estimates: [],
      currentRoomId: "",
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

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
  return n.toLocaleString("ko-KR") + "원";
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


