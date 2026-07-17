import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// ============ Types ============
export type MoveType = "포장이사" | "반포장이사" | "일반이사" | "보관이사" | "사무실이사";
export type WorkEnv = "계단" | "엘리베이터";
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
  rooms: Room[];
  options: OptionItem[];
  storageStart: string;
  storageEnd: string;
  storageDaily: number;
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
];
export const DEFAULT_ROOMS = ["안방", "작은방", "입구방", "거실", "부엌", "베란다"];
export const DEFAULT_OPTIONS: Omit<OptionItem, "enabled" | "price">[] = [
  { id: "aircon-move", name: "에어컨 이전 설치" },
  { id: "tv-mount", name: "벽걸이 TV 설치" },
  { id: "piano", name: "피아노 운반" },
  { id: "stonebed", name: "돌침대" },
  { id: "safe", name: "대형 금고" },
  { id: "waste", name: "폐기물 처리" },
  { id: "ladder-fee", name: "사다리차 비용" },
  { id: "extra-work", name: "추가 작업비" },
];

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
  const transport = e.truck1t * PRICING.truck1t + e.truck5t * PRICING.truck5t + e.ladder * PRICING.ladder;
  const labor = e.workers * PRICING.worker + e.kitchenStaff * PRICING.kitchenStaff;
  const extraKm = Math.max(0, e.distanceKm - PRICING.baseKm);
  const distanceFee = extraKm * PRICING.perKm;
  const stairFloors =
    e.workEnv === "계단" ? Math.max(0, e.fromFloor - 1) + Math.max(0, e.toFloor - 1) : 0;
  const stairFee = stairFloors * PRICING.stairPerFloor;
  let itemFee = 0;
  for (const r of e.rooms) {
    for (const [id, qty] of Object.entries(r.items)) {
      const it = ITEM_CATALOG.find((x) => x.id === id);
      if (it?.extra) itemFee += it.extra * qty;
    }
  }
  const optionFee = e.options.filter((o) => o.enabled).reduce((s, o) => s + (o.price || 0), 0);
  let storageFee = 0;
  if (e.moveType === "보관이사" && e.storageStart && e.storageEnd) {
    const days = Math.max(
      0,
      Math.round((new Date(e.storageEnd).getTime() - new Date(e.storageStart).getTime()) / 86400000)
    );
    storageFee = days * (e.storageDaily || 0);
  }
  const total = transport + labor + distanceFee + stairFee + itemFee + optionFee + storageFee;
  return {
    total,
    parts: [
      { label: "기본 운송료", amount: transport },
      { label: "작업 인원", amount: labor },
      { label: "거리 추가비", amount: distanceFee },
      { label: "계단 추가비", amount: stairFee },
      { label: "품목 추가비", amount: itemFee },
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
    rooms: DEFAULT_ROOMS.map((n) => ({ id: `r_${n}`, name: n, items: {} })),
    options: DEFAULT_OPTIONS.map((o) => ({ ...o, enabled: false, price: 0 })),
    storageStart: "",
    storageEnd: "",
    storageDaily: 20000,
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
const STORAGE_KEY = "jimpick_v7_state";

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
