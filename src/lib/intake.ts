/**
 * 고객 사전정보 입력 링크 — 화면과 서버가 함께 쓰는 순수 규칙.
 * (데이터베이스·네트워크 없이 시험할 수 있게 분리했습니다.)
 */

/** 고객 링크에 기본으로 보이는 큰 가구·가전 (기존 품목 목록의 id를 그대로 씁니다) */
export const INTAKE_BASE_ITEMS: { id: string; name: string; path: string; rooms: string[] }[] = [
  { id: "bed-01", name: "침대", path: "/assets/items-3d/bedroom-furniture/bed-01.webp", rooms: ["안방", "작은방"] },
  { id: "wardrobe-01", name: "장롱", path: "/assets/items-3d/bedroom-furniture/wardrobe-01.webp", rooms: ["안방", "작은방"] },
  { id: "chest-of-drawers-01", name: "서랍장", path: "/assets/items-3d/bedroom-furniture/chest-of-drawers-01.webp", rooms: ["안방", "작은방"] },
  { id: "dressing-table-01", name: "화장대", path: "/assets/items-3d/bedroom-furniture/dressing-table-01.webp", rooms: ["안방", "작은방"] },
  { id: "desk-01", name: "책상", path: "/assets/items-3d/office-furniture/desk-01.webp", rooms: ["작은방", "거실"] },
  { id: "bookshelf-01", name: "책장", path: "/assets/items-3d/storage-furniture/bookshelf-01.webp", rooms: ["작은방", "거실"] },
  { id: "sofa-01", name: "소파", path: "/assets/items-3d/living-furniture/sofa-01.webp", rooms: ["거실"] },
  { id: "living-room-cabinet-01", name: "거실장", path: "/assets/items-3d/living-furniture/living-room-cabinet-01.webp", rooms: ["거실"] },
  { id: "dining-table-01", name: "식탁", path: "/assets/items-3d/kitchen-furniture/dining-table-01.webp", rooms: ["부엌", "거실"] },
  { id: "refrigerator-01", name: "냉장고", path: "/assets/items-3d/appliances-large/refrigerator-01.webp", rooms: ["부엌"] },
  { id: "kimchi-refrigerator-01", name: "김치냉장고", path: "/assets/items-3d/appliances-large/kimchi-refrigerator-01.webp", rooms: ["부엌", "베란다"] },
  { id: "washing-machine-01", name: "세탁기", path: "/assets/items-3d/appliances-large/washing-machine-01.webp", rooms: ["베란다"] },
  { id: "clothes-dryer-01", name: "건조기", path: "/assets/items-3d/appliances-large/clothes-dryer-01.webp", rooms: ["베란다"] },
  { id: "clothes-styler-01", name: "스타일러", path: "/assets/items-3d/appliances-large/clothes-styler-01.webp", rooms: ["안방"] },
  { id: "television-01", name: "TV", path: "/assets/items-3d/av/television-01.webp", rooms: ["거실", "안방"] },
  { id: "air-conditioner-01", name: "에어컨", path: "/assets/items-3d/season-appliance/air-conditioner-01.webp", rooms: ["거실", "안방", "작은방"] },
  { id: "water-purifier-01", name: "정수기", path: "/assets/items-3d/living-appliance/water-purifier-01.webp", rooms: ["부엌"] },
  { id: "microwave-oven-01", name: "전자레인지", path: "/assets/items-3d/kitchen-appliance/microwave-oven-01.webp", rooms: ["부엌"] },
  { id: "dishwasher-01", name: "식기세척기", path: "/assets/items-3d/appliances-large/dishwasher-01.webp", rooms: ["부엌"] },
  { id: "massage-chair-01", name: "안마의자", path: "/assets/items-3d/appliances-large/massage-chair-01.webp", rooms: ["거실"] },
  { id: "digital-piano-01", name: "디지털피아노", path: "/assets/items-3d/av/digital-piano-01.webp", rooms: ["거실", "작은방"] },
];

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

/**
 * 상세주소에서 「명확하게 적힌」 층수만 찾습니다.
 * 「3층」「지하 1층」「B1」만 인정하고, 「502호」 같은 호수는 층수로 보지 않습니다.
 * 확실하지 않으면 null (→ 방문 확인 예정).
 */
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
  return null;
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
  const fromFloor = strictFloor(form.fromDetail);
  const toFloor = strictFloor(form.toDetail);
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
      if (p.disposal) r.disposal![id] = true;
      else delete r.disposal![id];
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
    rooms,
    intakeRequestId: meta.intakeRequestId,
    intakeFromFloor: floorText(fromFloor),
    intakeToFloor: floorText(toFloor),
  };
  // 층수: 사장님이 직접 고친 값은 덮어쓰지 않고, 확실한 경우만 넣습니다.
  if (!base.fromFloorEdited && fromFloor !== null) out.fromFloor = fromFloor;
  if (!base.toFloorEdited && toFloor !== null) out.toFloor = toFloor;
  // 엘리베이터·사다리차: 방문 후 결정 — 처음 만들 때만 비워 둡니다(사장님이 고른 값은 보존).
  if (!base.intakeRequestId) {
    delete out.fromEnv;
    delete out.toEnv;
    out.ladderFrom = false;
    out.ladderTo = false;
    out.intakeSiteDecision = "방문 후 결정";
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
    `${v.customerName} 고객님, 방문견적 전 기본정보 입력을 부탁드립니다.`,
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
