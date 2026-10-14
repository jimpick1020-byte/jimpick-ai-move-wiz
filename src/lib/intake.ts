/**
 * 고객 사전정보 입력 링크 — 화면과 서버가 함께 쓰는 순수 규칙.
 * (데이터베이스·네트워크 없이 시험할 수 있게 분리했습니다.)
 */

/** 출발지 평수 (추천용) — 0~6 */
export const INTAKE_SIZES = ["5평 이하", "5~10평", "10~20평", "20~30평", "30~40평", "40~50평", "50평 이상"] as const;
export type IntakeGroup = "가구" | "가전" | "주방";
/** 고객 링크 4단계에 보이는 분류 (생활용품·운동·레저 등은 고객 화면에 표시하지 않습니다) */
export const INTAKE_GROUPS = ["가구", "가전", "주방"] as const;

export interface IntakeBaseItem {
  id: string;
  name: string;
  group: IntakeGroup;
  /** 카드 묶음 이름 (침대·소파·TV 등) */
  kind: string;
  rooms: string[];
  /** 추천할 평수 범위 [최소, 최대] (INTAKE_SIZES 번호) */
  sizes: [number, number];
  img?: string;
  /** 기존 품목 목록에 없는 고객 링크 전용 품목의 부피(견적 화면 계산용) */
  vol?: number;
}

const f = (id: string, name: string, kind: string, rooms: string[], sizes: [number, number], img?: string, vol?: number): IntakeBaseItem =>
  ({ id, name, group: "가구", kind, rooms, sizes, img, vol });
const e = (id: string, name: string, kind: string, rooms: string[], sizes: [number, number], img?: string, vol?: number): IntakeBaseItem =>
  ({ id, name, group: "가전", kind, rooms, sizes, img, vol });
const k = (id: string, name: string, kind: string, rooms: string[], sizes: [number, number], img?: string, vol?: number): IntakeBaseItem =>
  ({ id, name, group: "주방", kind, rooms, sizes, img, vol });
const BR = ["안방", "작은방"];

/** 고객 링크 기본 큰 가구·가전 — 기존 품목 id를 쓰고, 없는 것만 intake- 전용 id를 씁니다. 작은 생활용품·잔짐은 넣지 않습니다. */
export const INTAKE_BASE_ITEMS: IntakeBaseItem[] = [
  // 침대
  f("single-bed-01", "싱글 침대", "침대", BR, [0, 6], "/assets/items-3d/furniture/bed.webp"),
  f("super-single-bed-01", "슈퍼싱글 침대", "침대", BR, [0, 6], "/assets/items-3d/furniture/bed.webp"),
  f("double-bed-01", "더블 침대", "침대", BR, [1, 4], "/assets/items-3d/furniture/bed.webp"),
  f("queen-bed-01", "퀸 침대", "침대", BR, [2, 6], "/assets/items-3d/furniture/bed.webp"),
  f("king-bed-01", "킹 침대", "침대", BR, [3, 6], "/assets/items-3d/furniture/bed.webp"),
  f("family-bed-01", "패밀리 침대", "침대", BR, [3, 6], "/assets/items-3d/furniture/bed.webp"),
  f("bunk-bed-01", "2층 침대", "침대", ["작은방"], [3, 6], "/assets/items-3d/furniture/bunk-bed.webp"),
  f("storage-bed-01", "수납 침대", "침대", BR, [1, 6], "/assets/items-3d/furniture/bed.webp"),
  // 소파
  f("intake-sofa-1seat", "1인용 소파", "소파", ["거실", "안방"], [0, 6], "/assets/items-3d/furniture/armchair.webp", 0.4),
  f("two-seat-sofa-01", "2인용 소파", "소파", ["거실"], [1, 4], "/assets/items-3d/furniture/three-seat-sofa.webp"),
  f("three-seat-sofa-01", "3인용 소파", "소파", ["거실"], [2, 6], "/assets/items-3d/furniture/three-seat-sofa.webp"),
  f("four-seat-sofa-01", "4인용 이상 소파", "소파", ["거실"], [3, 6], "/assets/items-3d/furniture/corner-sofa.webp"),
  f("intake-sofa-couch", "카우치형 소파", "소파", ["거실"], [3, 6], "/assets/items-3d/furniture/corner-sofa.webp", 1.2),
  f("intake-sofa-recliner", "리클라이너 소파", "소파", ["거실"], [2, 6], "/assets/items-3d/furniture/recliner.webp", 0.8),
  // 수납·책상·식탁
  f("wardrobe-01", "장롱", "장롱", BR, [2, 6], "/assets/items-3d/furniture/wardrobe.webp"),
  f("chest-of-drawers-01", "서랍장", "서랍장", BR, [0, 6], "/assets/items-3d/furniture/chest-of-drawers.webp"),
  f("dressing-table-01", "화장대", "화장대", ["안방"], [1, 6], "/assets/items-3d/furniture/dressing-table.webp"),
  f("desk-01", "책상", "책상", ["작은방", "거실"], [0, 6], "/assets/items-3d/furniture/desk.webp"),
  f("bookshelf-01", "책장", "책장", ["작은방", "거실"], [1, 6], "/assets/items-3d/furniture/bookshelf.webp"),
  f("living-room-cabinet-01", "거실장", "거실장", ["거실"], [2, 6], "/assets/items-3d/furniture/tv-stand.webp"),
  f("dining-table-01", "식탁", "식탁", ["부엌", "거실"], [1, 6], "/assets/items-3d/furniture/dining-table.webp"),
  f("massage-chair-01", "안마의자", "안마의자", ["거실"], [3, 6], "/assets/items-3d/furniture/massage-chair.webp"),
  f("digital-piano-01", "디지털피아노", "피아노", ["거실", "작은방"], [2, 6], "/assets/items-3d/special/digital-piano.webp"),
  // TV
  e("smart-tv-32-inch-01", "TV 32인치 이하", "TV", ["거실", "안방", "작은방"], [0, 2], "/assets/items-3d/appliances/television.webp"),
  e("intake-tv-40", "TV 40~49인치", "TV", ["거실", "안방"], [1, 3], "/assets/items-3d/appliances/television.webp", 0.2),
  e("intake-tv-50", "TV 50~59인치", "TV", ["거실", "안방"], [2, 4], "/assets/items-3d/appliances/television.webp", 0.25),
  e("intake-tv-60", "TV 60~69인치", "TV", ["거실"], [3, 6], "/assets/items-3d/appliances/television.webp", 0.3),
  e("tv-75-inch-01", "TV 70~79인치", "TV", ["거실"], [3, 6], "/assets/items-3d/appliances/television.webp"),
  e("tv-85-inch-01", "TV 80인치 이상", "TV", ["거실"], [4, 6], "/assets/items-3d/appliances/television.webp"),
  // 냉장·세탁
  e("refrigerator-01", "냉장고", "냉장고", ["부엌"], [0, 6], "/assets/items-3d/appliances/side-by-side-refrigerator.webp"),
  e("kimchi-refrigerator-01", "김치냉장고", "김치냉장고", ["부엌", "베란다"], [2, 6], "/assets/items-3d/appliances/kimchi-refrigerator.webp"),
  e("freezer-01", "냉동고", "냉장고", ["부엌", "베란다"], [3, 6], "/assets/items-3d/appliances/one-door-refrigerator.webp"),
  e("washing-machine-01", "세탁기", "세탁기", ["베란다"], [0, 6], "/assets/items-3d/appliances/drum-washing-machine.webp"),
  e("clothes-dryer-01", "건조기", "건조기", ["베란다"], [2, 6], "/assets/items-3d/appliances/clothes-dryer.webp"),
  e("clothes-styler-01", "스타일러", "스타일러", ["안방"], [2, 6], "/assets/items-3d/appliances/styler.webp"),
  // 에어컨·주방
  e("stand-air-conditioner-01", "스탠드 에어컨", "에어컨", ["거실"], [2, 6], "/assets/items-3d/appliances/tower-air-conditioner.webp"),
  e("wall-air-conditioner-01", "벽걸이 에어컨", "에어컨", ["안방", "작은방", "거실"], [0, 6], "/assets/items-3d/appliances/wall-air-conditioner.webp"),
  k("water-purifier-01", "정수기", "정수기", ["부엌"], [1, 6], "/assets/items-3d/appliances/water-purifier.webp"),
  k("microwave-oven-01", "전자레인지", "전자레인지", ["부엌"], [0, 6], "/assets/items-3d/appliances/microwave.webp"),
  k("dishwasher-01", "식기세척기", "식기세척기", ["부엌"], [2, 6], "/assets/items-3d/appliances/dishwasher.webp"),
];

/** 예전 고객 링크(1차)에서 쓰던 품목 — 이미 제출된 자료의 이름 표시용 */
export const INTAKE_LEGACY_NAMES: Record<string, string> = {
  "bed-01": "침대", "sofa-01": "소파", "television-01": "TV", "air-conditioner-01": "에어컨",
};

/** 견적 화면에서도 이름·부피를 알 수 있도록: 고객 링크 전용 품목 */
export const INTAKE_EXTRA_ITEMS = INTAKE_BASE_ITEMS.filter((b) => b.id.startsWith("intake-"));

export function intakeItemName(id: string): string | undefined {
  return INTAKE_BASE_ITEMS.find((b) => b.id === id)?.name ?? INTAKE_LEGACY_NAMES[id];
}

export function customerItemLabel(...values: (string | null | undefined)[]): string {
  const aliases: Record<string, string> = { "bookself-01": "책장", "bookshelf-01": "책장", "digital-piano-01": "디지털 피아노", "sofa-01": "소파" };
  for (const value of values) {
    if (!value) continue;
    if (/[가-힣]/.test(value) && !/\.(png|jpe?g|webp)$/i.test(value)) return value;
    const name = aliases[value.replace(/\.(png|jpe?g|webp)$/i, "")] ?? intakeItemName(value);
    if (name) return name;
  }
  return "품목명 확인 필요";
}

export function isLargeCustomerItem(name: string): boolean {
  return /침대|장롱|옷장|서랍장|수납장|화장대|책상|책장|소파|거실장|식탁|테이블|냉장고|냉동고|세탁기|건조기|스타일러|TV|티비|텔레비|에어컨|정수기|전자레인지|식기세척기|안마의자|피아노/i.test(name);
}

export function customerCatalogRoleAllowed(roles: string[]): boolean {
  return roles.includes("admin") || roles.includes("super_admin");
}

/** 평수에 맞는 추천인지 */
export function fitsSize(sizes: [number, number] | undefined, size: string | undefined): boolean {
  const i = INTAKE_SIZES.indexOf((size ?? "") as (typeof INTAKE_SIZES)[number]);
  if (i < 0 || !sizes) return true;
  return i >= sizes[0] && i <= sizes[1];
}

export const INTAKE_ROOMS = ["거실", "안방", "작은방", "부엌", "베란다", "기타"] as const;
export type IntakeRoom = (typeof INTAKE_ROOMS)[number];

/** 고객이 고른 한 품목: 일반 이사 품목 또는 폐기물 (둘 중 하나만) */
export interface IntakePick {
  qty: number;
  disposal: boolean;
}
/** 방 → 품목 id → 선택 */
export type IntakeRooms = Record<string, Record<string, IntakePick>>;

export interface IntakeForm {
  customerName: string;
  phone: string;
  moveDate: string;
  moveTime: string;
  fromAddress: string;
  fromDetail: string;
  toAddress: string;
  toDetail: string;
  fromX?: number | null;
  fromY?: number | null;
  toX?: number | null;
  toY?: number | null;
  fromJibun?: string;
  fromZip?: string;
  toJibun?: string;
  toZip?: string;
  /** 출발지 평수 (추천용) */
  fromSize?: string;
  /** 3단계에서 고른 공간 (4단계 방 목록) */
  spaces?: string[];
  moveType?: "포장이사" | "반포장이사" | "일반이사" | "보관이사" | "사무실이사";
  storageEnabled?: boolean;
  memo?: string;
  fromEnv?: "계단" | "엘리베이터";
  toEnv?: "계단" | "엘리베이터";
  fromFloor?: number | null;
  toFloor?: number | null;
  fromFloorEdited?: boolean;
  toFloorEdited?: boolean;
  ladderFrom?: boolean;
  ladderTo?: boolean;
  /** 고객이 작업 방식을 모를 때: 방문 후 결정 */
  fromDecideOnVisit?: boolean;
  toDecideOnVisit?: boolean;
  rooms: IntakeRooms;
}

export function emptyIntakeForm(name = "", phone = ""): IntakeForm {
  return {
    customerName: name, phone, moveDate: "", moveTime: "", fromAddress: "", fromDetail: "",
    toAddress: "", toDetail: "", rooms: {},
  };
}

/** 사장님 화면에 보이는 링크 상태 */
export type IntakeStatusLabel =
  | "링크 미발송" | "발송 완료" | "고객 열람" | "작성 중" | "입력 완료" | "사장님 확인 완료" | "링크 만료" | "링크 취소";

/** 방문 일정 안내 문자 (업체 휴대폰 문자 앱에 자동 입력) */
export function visitSmsText(v: { customerName: string; date: string; time: string | null; address: string; contact: string; link: string | null }): string {
  const [, m, d] = v.date.split("-").map(Number);
  return [
    "[짐픽 방문견적 안내]", "",
    `${v.customerName || "고객"} 고객님,`,
    `${m}월 ${d}일 ${v.time || "약속한 시간"}에 방문견적을 위해 찾아가겠습니다.`, "",
    `방문 주소: ${v.address || "방문 시 확인"}`, "",
    `일정 변경 문의: ${v.contact}`,
    ...(v.link ? ["", `일정 확인: ${v.link}`] : []),
  ].join("\n");
}

/** 홈 「고객 요청」 화면용 상태 */
export function requestStatusLabel(r: { status: string; expires_at: string; last_sent_at?: string | null; visit_status?: string; visit_date?: string | null; visit_customer_confirmed_at?: string | null }): string {
  if (r.status === "cancelled") return "취소";
  if (r.visit_status === "scheduled" && r.visit_date) return r.visit_customer_confirmed_at ? "고객 일정 확인" : "방문 일정 확정";
  if (r.status === "submitted" || r.status === "confirmed") return "입력 완료";
  if (r.status === "editing") return "작성 중";
  if (r.status === "opened") return "고객 열람";
  if (r.status === "sent" || r.last_sent_at) return "문자 발송";
  return "문자 미발송";
}

export function intakeStatusLabel(r: { status: string; expires_at: string }, now = Date.now()): IntakeStatusLabel {
  if (r.status === "cancelled") return "링크 취소";
  if (r.status === "confirmed") return "사장님 확인 완료";
  if (r.status === "submitted") return "입력 완료";
  if (new Date(r.expires_at).getTime() <= now) return "링크 만료";
  if (r.status === "editing") return "작성 중";
  if (r.status === "opened") return "고객 열람";
  if (r.status === "sent") return "발송 완료";
  return "링크 미발송";
}

/** 명시된 층을 우선하고 동·호가 구분된 호수에서만 층수를 계산합니다. */
export function strictFloor(detail: string | null | undefined): number | null {
  const t = (detail ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const under = t.match(/지하\s*(\d{1,2})\s*층/) ?? t.match(/(?:^|[^A-Za-z0-9])B\s*(\d{1,2})(?:\s*층)?(?![0-9호])/i);
  if (under) {
    const n = Number(under[1]);
    return n >= 1 && n <= 10 ? -n : null;
  }
  const m = t.match(/(?:^|[^0-9])(\d{1,3})\s*층/);
  if (m) {
    const n = Number(m[1]);
    return n >= 1 && n <= 150 ? n : null;
  }
  const room = t.match(/\d+\s*동\s*(\d{3,5})(?:\s*호)?(?!\d)/)
    ?? t.match(/(?:^|\s)(\d{1,4})\s*[-/]\s*(\d{3,5})(?!\d)/);
  const unit = room ? Number(room[2] ?? room[1]) : Number(t.match(/(?:^|[^\d])(\d{3,5})\s*호/)?.[1]);
  const floor = Math.floor(unit / 100);
  return Number.isFinite(floor) && floor >= 1 && floor <= 150 ? floor : null;
}

/** 층수 표시 (고객에게는 보이지 않고 사장님 화면에만 보입니다) */
export function floorText(n: number | null): string {
  if (n === null) return "방문 확인 예정";
  return n < 0 ? `지하 ${-n}층` : `${n}층`;
}

/** 카드 한 번 누르기: 없으면 일반 품목으로 선택, 있으면 해제 */
export function tapOnce(room: Record<string, IntakePick>, id: string): Record<string, IntakePick> {
  const next = { ...room };
  if (next[id]) delete next[id];
  else next[id] = { qty: 1, disposal: false };
  return next;
}

/**
 * 두 번 빠르게 누르기: 폐기물 ↔ 일반 전환.
 * 선택되지 않은 카드는 폐기물 1개로 바로 선택합니다. 수량은 그대로 유지합니다(중복 없음).
 */
export function tapTwice(room: Record<string, IntakePick>, id: string, disposalAllowed = true): Record<string, IntakePick> {
  const next = { ...room };
  const cur = next[id];
  if (!cur) next[id] = { qty: 1, disposal: disposalAllowed };
  else next[id] = { qty: cur.qty, disposal: disposalAllowed ? !cur.disposal : false };
  return next;
}

export function setQty(room: Record<string, IntakePick>, id: string, qty: number): Record<string, IntakePick> {
  const next = { ...room };
  const q = Math.max(0, Math.min(20, Math.floor(qty)));
  if (q === 0) delete next[id];
  else if (next[id]) next[id] = { ...next[id], qty: q };
  return next;
}

/** 고객 입력을 견적 초안의 방 이름으로 (「기타」는 기존 「입구방」 대신 그대로 씁니다) */
type DraftRoom = { id: string; name: string; items: Record<string, number>; disposal?: Record<string, boolean> };

/**
 * 고객 입력을 견적 초안에 합칩니다.
 *  - 고객이 입력하는 칸만 고칩니다(금액·인원·차량·옵션 등 사장님 칸은 그대로).
 *  - 지난번 고객 입력으로 들어간 품목만 빼고 새 입력을 넣어, 다시 제출해도 수량이 겹치지 않습니다.
 *  - 엘리베이터·사다리차는 고르지 않은 상태(방문 후 결정)로 둡니다.
 */
export function mergeIntakeIntoDraft(
  base: Record<string, unknown>,
  form: IntakeForm,
  prev: IntakeRooms | null,
  meta: { intakeRequestId: string },
): Record<string, unknown> {
  const fromFloor = form.fromFloorEdited ? form.fromFloor ?? null : strictFloor(`${form.fromDetail} ${form.fromAddress}`);
  const toFloor = form.toFloorEdited ? form.toFloor ?? null : strictFloor(`${form.toDetail} ${form.toAddress}`);
  const rooms: DraftRoom[] = ((base.rooms as DraftRoom[] | undefined) ?? []).map((r) => ({
    ...r, items: { ...(r.items ?? {}) }, disposal: { ...(r.disposal ?? {}) },
  }));
  // 1) 지난 고객 입력분 제거
  for (const [roomName, picks] of Object.entries(prev ?? {})) {
    const r = rooms.find((x) => x.name === roomName);
    if (!r) continue;
    for (const id of Object.keys(picks)) {
      delete r.items[id];
      delete r.disposal?.[id];
    }
  }
  // 2) 새 고객 입력 반영
  for (const [roomName, picks] of Object.entries(form.rooms)) {
    const list = Object.entries(picks).filter(([, p]) => p.qty > 0);
    if (!list.length) continue;
    let r = rooms.find((x) => x.name === roomName);
    if (!r) {
      r = { id: `r_${roomName}`, name: roomName, items: {}, disposal: {} };
      rooms.push(r);
    }
    for (const [id, p] of list) {
      r.items[id] = p.qty;
      if (!r.disposal) r.disposal = {};
      if (p.disposal) r.disposal[id] = true;
      else delete r.disposal[id];
    }
  }
  const out: Record<string, unknown> = {
    ...base,
    customerName: form.customerName.trim(),
    phone: form.phone,
    moveDate: form.moveDate,
    moveTime: form.moveTime || (base.moveTime as string) || "",
    fromAddress: form.fromAddress,
    fromDetail: form.fromDetail,
    toAddress: form.toAddress,
    toDetail: form.toDetail,
    fromX: form.fromX ?? null,
    fromY: form.fromY ?? null,
    toX: form.toX ?? null,
    toY: form.toY ?? null,
    fromJibun: form.fromJibun ?? "",
    fromZip: form.fromZip ?? "",
    toJibun: form.toJibun ?? "",
    toZip: form.toZip ?? "",
    rooms,
    intakeRequestId: meta.intakeRequestId,
    intakeFromFloor: floorText(fromFloor),
    intakeToFloor: floorText(toFloor),
  };
  // 평수는 추천용 참고 정보로만 남깁니다(사장님 화면의 평수·기본 품목은 바꾸지 않음).
  out.intakeFromSize = form.fromSize ?? "";
  if (form.fromSize && (INTAKE_SIZES as readonly string[]).includes(form.fromSize)) out.sizeTab = form.fromSize;
  if (form.moveType) out.moveType = form.moveType;
  if (form.storageEnabled !== undefined) out.storageEnabled = form.storageEnabled;
  if (form.memo !== undefined) out.memo = form.memo;
  for (const name of form.spaces ?? []) {
    if (!rooms.some(r => r.name === name)) rooms.push({ id: `r_${name}`, name, items: {}, disposal: {} });
  }
  // 층수: 사장님이 직접 고친 값은 덮어쓰지 않고, 확실한 경우만 넣습니다.
  if (!base.fromFloorEdited) out.fromFloor = fromFloor;
  if (!base.toFloorEdited) out.toFloor = toFloor;
  // 엘리베이터·사다리차: 방문 후 결정 — 처음 만들 때만 비워 둡니다(사장님이 고른 값은 보존).
  if (!base.intakeRequestId) {
    delete out.fromEnv;
    delete out.toEnv;
    out.ladderFrom = false;
    out.ladderTo = false;
    out.intakeSiteDecision = "방문 후 결정";
  }
  for (const side of ["from", "to"] as const) {
    const envKey = `${side}Env` as const;
    const ladderKey = side === "from" ? "ladderFrom" : "ladderTo";
    if (form[envKey] !== undefined) out[envKey] = form[envKey];
    if (form[ladderKey] !== undefined) out[ladderKey] = form[ladderKey];
    // 고객이 「방문 후 결정」을 고르면 그 장소의 작업 방식·사다리차는 비워 둡니다.
    const decide = side === "from" ? form.fromDecideOnVisit : form.toDecideOnVisit;
    out[`${side}DecideOnVisit`] = !!decide;
    if (decide) { delete out[envKey]; out[ladderKey] = false; }
  }
  if (form.fromEnv || form.toEnv) {
    const methods = [form.fromEnv, form.toEnv];
    out.workEnv = methods.includes("계단") && methods.includes("엘리베이터") ? "계단+엘리베이터" : methods.includes("계단") ? "계단" : "엘리베이터";
  }
  return out;
}

/** 견적 초안 메모용 요약 (폐기물 처리비용은 방문 후 확인) */
export function intakeSummary(form: IntakeForm, nameOf: (id: string) => string): string[] {
  const lines: string[] = [];
  for (const room of Object.keys(form.rooms)) {
    const picks = Object.entries(form.rooms[room]).filter(([, p]) => p.qty > 0);
    if (!picks.length) continue;
    const move = picks.filter(([, p]) => !p.disposal).map(([id, p]) => `${nameOf(id)} ${p.qty}`);
    const waste = picks.filter(([, p]) => p.disposal).map(([id, p]) => `${nameOf(id)} ${p.qty}`);
    if (move.length) lines.push(`${room}: ${move.join(", ")}`);
    if (waste.length) lines.push(`${room} 폐기물: ${waste.join(", ")}`);
  }
  return lines;
}

export function intakeSmsText(v: { customerName: string; link: string; contact: string }): string {
  return [
    "[JIMPICK 짐픽]",
    "",
    `${v.customerName.trim() ? `${v.customerName.trim()} ` : ""}고객님, 방문견적 전 기본정보 입력을 부탁드립니다.`,
    "",
    "아래 링크에서 이사 날짜, 주소와 큰 가구·가전만 간단히 선택해 주세요.",
    "",
    v.link,
    "",
    "층수, 작업환경, 잔짐과 정확한 견적은 방문 시 자세히 확인해 드리겠습니다.",
    "",
    `문의: ${v.contact}`,
  ].join("\n");
}
