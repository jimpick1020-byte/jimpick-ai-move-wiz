/**
 * 고객 공유 견적서의 품목 이름·그림.
 * 공유 자료에는 실제로 선택한 품목의 이름·그림만 담고(업체 전체 카탈로그 제외),
 * 각 방 카드에 명시적인 그림 주소를 붙입니다. 옛 자료에 내부 ID나 가짜 기본 상자만 남아 있으면
 * 같은 견적 자료 → 같은 견적 업체 카탈로그 순으로 되살리고, 실자료가 없을 때만 중립 문구/그림 없음을 씁니다.
 */

export const NO_IMAGE_ICON = "none:no-image";
export const UNKNOWN_ITEM_NAME = "품목 정보 없음";
/** 실제 품목이 아닌 「연결 없음」 기본 상자 그림 */
export const FAKE_DEFAULT_BOX = "/assets/items-3d/packing/moving-box-medium.webp";
/** 공개 저장 한도 — 넘으면 자르지 않고 오류로 처리합니다 */
export const SHARED_SNAPSHOT_MAX = 300_000;

/** 이름이 아니라 내부 키·파일 주소인지. 「책장/수납장」처럼 슬래시가 든 정상 이름은 통과합니다. */
export function isPlaceholderName(name: unknown, id: string): boolean {
  const v = typeof name === "string" ? name.trim() : "";
  if (!v || v === id || v === UNKNOWN_ITEM_NAME) return true;
  if (/^(ci_|ai_|generated_)/i.test(v)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return true;
  if (/^(\/|\.{1,2}\/|https?:|blob:|data:)/i.test(v)) return true;
  if (/^[\w.-]+\.(png|jpe?g|webp|gif|svg)$/i.test(v)) return true;
  return false;
}

const ICON_ROUTE = /^\/api\/public\/item-icon\/[0-9a-f-]{36}\.png(\?v=\d{1,16})?$/i;
const APP_ASSET = /^\/assets\/[\w-]+(\/[\w-]+)*\.(webp|png|jpe?g|svg)$/i;
const CDN_ASSET = /^\/__l5e\/assets-v1\/[0-9a-f-]{36}\/[\w.-]+\.(webp|png|jpe?g|svg)$/i;

/**
 * 앱의 승인된 영구 그림 경로로 정규화합니다(아니면 null).
 * 같은 앱 도메인의 절대 주소는 경로로 바꾸고, 서명·브라우저 전용·임의 외부 주소는 버립니다.
 */
export function normalizeIcon(icon: unknown): string | null {
  if (typeof icon !== "string" || !icon || icon.length > 300) return null;
  let path = icon;
  if (/^https:\/\//i.test(icon)) {
    try {
      const u = new URL(icon);
      if (!/(^|\.)lovable\.app$/i.test(u.hostname) || u.username || u.password || u.port) return null;
      path = u.pathname + u.search;
    } catch { return null; }
  }
  return ICON_ROUTE.test(path) || APP_ASSET.test(path) || CDN_ASSET.test(path) ? path : null;
}

export interface CatalogRow {
  item_id: string;
  id: string;
  display_name?: string | null;
  requested_name?: string | null;
  original_name?: string | null;
  name?: string | null;
  status?: string | null;
  active?: boolean | null;
  image_path?: string | null;
  storage_path?: string | null;
}

/** 기본 품목 정보 — 작성 카드와 같은 그림 리소스 */
export type BuiltinOf = (id: string, name: string) => { name?: string; icon: string } | null;

function catalogName(row: CatalogRow, id: string): string | null {
  for (const v of [row.display_name, row.requested_name, row.original_name, row.name]) {
    const c = (v ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!isPlaceholderName(c, id)) return c;
  }
  return null;
}
function catalogIcon(row: CatalogRow): string | null {
  return row.status === "ready" && row.active !== false && (row.image_path || row.storage_path)
    ? `/api/public/item-icon/${row.id}.png` : null;
}

type SnapItem = { id: string; name?: string; qty?: number; disposal?: boolean; icon?: string };
type Custom = { id: string; name?: string; icon?: string; [k: string]: unknown };
export type SharedSnap = {
  draft?: { itemNames?: Record<string, string>; customItems?: Custom[]; [k: string]: unknown };
  rooms?: { items?: SnapItem[]; [k: string]: unknown }[];
  [k: string]: unknown;
};

const validName = (n: unknown, id: string) => (isPlaceholderName(n, id) ? null : String(n).trim());
const realIcon = (icon: unknown, builtin: boolean) => {
  const v = normalizeIcon(icon);
  return v && (builtin || v !== FAKE_DEFAULT_BOX) ? v : null;
};

function pickedIds(snap: SharedSnap): string[] {
  const ids: string[] = [];
  for (const room of Array.isArray(snap?.rooms) ? snap.rooms : [])
    for (const it of Array.isArray(room?.items) ? room.items : [])
      if (it && typeof it.id === "string" && it.id && !ids.includes(it.id)) ids.push(it.id);
  return ids;
}

/** 저장 자료만으로 이름·그림이 정해지지 않아 카탈로그 확인이 필요한 선택 품목 ID(전부, 한도 없음) */
export function idsNeedingCatalog(snap: SharedSnap, builtinOf: BuiltinOf): string[] {
  const custom = new Map((snap?.draft?.customItems ?? []).filter(Boolean).map((c) => [c.id, c]));
  const need = new Set<string>();
  for (const room of Array.isArray(snap?.rooms) ? snap.rooms : [])
    for (const it of Array.isArray(room?.items) ? room.items : []) {
      try {
        if (!it?.id) continue;
        const c = custom.get(it.id);
        const b = builtinOf(it.id, "");
        if (b) continue;
        const named = validName(it.name, it.id) || validName(snap.draft?.itemNames?.[it.id], it.id) || validName(c?.name, it.id);
        const pic = realIcon(it.icon, false) || realIcon(c?.icon, false);
        if (!named || !pic) need.add(it.id);
      } catch { /* 행 하나의 문제는 건너뜁니다 */ }
    }
  return [...need];
}

/**
 * 공개용 스냅샷 — 방·순서·수량·폐기 표시는 그대로 두고, 각 카드에 이름과 명시적 그림을 붙이며
 * draft.customItems/itemNames 는 선택한 품목만 남깁니다. 요금·결제 값은 건드리지 않습니다.
 */
export function compactSharedSnapshot(input: SharedSnap, rows: CatalogRow[], builtinOf: BuiltinOf): SharedSnap {
  if (!input || typeof input !== "object" || !Array.isArray(input.rooms)) return input;
  const snap: SharedSnap = { ...input, draft: { ...(input.draft ?? {}) } };
  const draft = snap.draft!;
  const srcNames = draft.itemNames && typeof draft.itemNames === "object" ? draft.itemNames : {};
  const srcCustom = new Map((Array.isArray(draft.customItems) ? draft.customItems : []).filter((c) => c && typeof c.id === "string").map((c) => [c.id, c]));
  const byId = new Map(rows.filter((r) => r && r.item_id).map((r) => [r.item_id, r]));
  const resolved = new Map<string, { name: string; icon: string; builtin: boolean }>();

  const resolve = (it: SnapItem) => {
    const hit = resolved.get(it.id);
    if (hit) {
      // 같은 ID가 여러 방에 있으면 유효한 이름·그림이 있는 행을 공유합니다
      if (hit.name === UNKNOWN_ITEM_NAME && validName(it.name, it.id)) hit.name = validName(it.name, it.id)!;
      if (hit.icon === NO_IMAGE_ICON && realIcon(it.icon, hit.builtin)) hit.icon = realIcon(it.icon, hit.builtin)!;
      return hit;
    }
    const c = srcCustom.get(it.id);
    const row = byId.get(it.id);
    const b = builtinOf(it.id, validName(it.name, it.id) ?? "");
    const name = validName(it.name, it.id) ?? validName(srcNames[it.id], it.id) ?? validName(c?.name, it.id) ??
      (row && catalogName(row, it.id)) ?? validName(b?.name, it.id) ?? UNKNOWN_ITEM_NAME;
    const icon = realIcon(it.icon, !!b) ?? realIcon(c?.icon, !!b) ?? (row && catalogIcon(row)) ?? (b ? realIcon(b.icon, true) : null) ?? NO_IMAGE_ICON;
    const r = { name, icon, builtin: !!b };
    resolved.set(it.id, r);
    return r;
  };

  snap.rooms = input.rooms.map((room) => {
    if (!room || !Array.isArray(room.items)) return room;
    return { ...room, items: room.items.map((it) => {
      try {
        if (!it || typeof it.id !== "string" || !it.id) return it;
        resolve(it);
        return it;
      } catch { return it; }
    }) };
  });
  // 두 번째 단계: 같은 ID의 최종 값으로 모든 방 카드를 맞춥니다
  snap.rooms = snap.rooms.map((room) => !room || !Array.isArray(room.items) ? room : { ...room, items: room.items.map((it) => {
    const r = it && resolved.get(it.id);
    return r ? { ...it, name: r.name, icon: r.icon } : it;
  }) });

  const ids = [...resolved.keys()];
  const itemNames: Record<string, string> = {};
  const customItems: Custom[] = [];
  for (const id of ids) {
    const r = resolved.get(id)!;
    const savedName = validName(srcNames[id], id);
    if (savedName) itemNames[id] = savedName;
    else if (!r.builtin && r.name !== UNKNOWN_ITEM_NAME) itemNames[id] = r.name;
    const c = srcCustom.get(id);
    if (c || !r.builtin) customItems.push({ ...(c ?? { cat: "기타", extra: 0 }), id, name: validName(c?.name, id) ?? r.name, icon: r.icon });
  }
  draft.itemNames = itemNames;
  draft.customItems = customItems;
  return snap;
}

/** 선택 품목만 담은 공개 JSON — 한도를 넘으면 자르지 않고 null 을 돌려줍니다 */
export function serializeSharedSnapshot(snap: SharedSnap, builtinOf: BuiltinOf, rows: CatalogRow[] = []): string | null {
  const json = JSON.stringify(compactSharedSnapshot(snap, rows, builtinOf));
  return json.length > SHARED_SNAPSHOT_MAX ? null : json;
}

/** 서버가 토큰으로 확인한 견적 소유 업체의 선택 품목만, 나눠서 모두 조회합니다 */
export async function loadOwnerCatalogRows(
  query: (ownerId: string, ids: string[]) => Promise<CatalogRow[] | null>,
  ownerId: string,
  ids: string[],
  chunk = 100,
): Promise<CatalogRow[]> {
  if (!ownerId || !ids.length) return [];
  const out: CatalogRow[] = [];
  for (let i = 0; i < ids.length; i += chunk) {
    const part = ids.slice(i, i + chunk);
    try {
      const rows = await query(ownerId, part);
      for (const r of rows ?? []) if (part.includes(r.item_id) && !out.some((o) => o.item_id === r.item_id)) out.push(r);
    } catch { /* 이 묶음만 실패 — 나머지는 저장 자료로 복구합니다 */ }
  }
  return out;
}
