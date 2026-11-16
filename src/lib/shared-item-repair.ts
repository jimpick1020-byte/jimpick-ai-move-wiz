/**
 * 고객 공유 견적서의 품목 이름·그림 복구.
 * 견적 작성 화면에서 보이던 이름/그림을 공유 자료에 남기고, 옛 공유 자료에
 * 내부 ID나 가짜 기본 상자만 남아 있으면 같은 견적 업체의 카탈로그로 되살립니다.
 * 실자료가 전혀 없을 때만 중립 문구와 「그림 없음」 표시를 씁니다.
 */

/** 그림이 없음을 뜻하는 표시 — Icon3D 가 상자 대신 중립 아이콘을 그립니다 */
export const NO_IMAGE_ICON = "none:no-image";
/** 실자료가 없을 때 보여 주는 이름 */
export const UNKNOWN_ITEM_NAME = "품목 정보 없음";
/** 실제 품목이 아닌 「연결 없음」 기본 상자 그림 */
export const FAKE_DEFAULT_BOX = "/assets/items-3d/packing/moving-box-medium.webp";

const BAD_NAME = /^(ci_ai_|ci_|ai_|generated_|[0-9a-f]{8}-[0-9a-f-]{27,}$)|\.(png|jpe?g|webp|gif)$|\//i;

export function isPlaceholderName(name: unknown, id: string): boolean {
  const v = typeof name === "string" ? name.trim() : "";
  return !v || v === id || BAD_NAME.test(v) || v === UNKNOWN_ITEM_NAME;
}

/** 로그인·기기·일회성 서명 없이 계속 열리는 그림 주소인지 */
export function isDurableIcon(icon: unknown): icon is string {
  if (typeof icon !== "string" || !icon) return false;
  if (icon === FAKE_DEFAULT_BOX || icon === NO_IMAGE_ICON) return false;
  if (/^(blob:|data:)/i.test(icon)) return false;
  if (/\/storage\/v1\/object\/sign\/|[?&]token=/i.test(icon)) return false;
  if (/^\/api\/public\/item-icon\/[0-9a-f-]{36}\.png(\?v=\d+)?$/i.test(icon)) return true;
  if (icon.startsWith("/assets/")) return true;
  return /^https:\/\//i.test(icon);
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

function catalogName(row: CatalogRow, id: string): string | null {
  for (const v of [row.display_name, row.requested_name, row.original_name, row.name]) {
    const c = (v ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (c && !isPlaceholderName(c, id)) return c;
  }
  return null;
}

function catalogIcon(row: CatalogRow): string | null {
  return row.status === "ready" && row.active !== false && (row.image_path || row.storage_path)
    ? `/api/public/item-icon/${row.id}.png`
    : null;
}

type SnapItem = { id: string; name?: string; qty?: number; disposal?: boolean };
type Snap = {
  draft?: { itemNames?: Record<string, string>; customItems?: { id: string; name?: string; icon?: string; [k: string]: unknown }[]; [k: string]: unknown };
  rooms?: { items?: SnapItem[]; [k: string]: unknown }[];
  [k: string]: unknown;
};

/** 공유 자료에서 실제 이름·그림이 비어 있어 카탈로그 확인이 필요한 품목 ID */
export function idsNeedingCatalog(snap: Snap, isBuiltin: (id: string) => boolean): string[] {
  const need = new Set<string>();
  const custom = new Map((snap.draft?.customItems ?? []).map((c) => [c?.id, c]));
  for (const room of snap.rooms ?? []) for (const it of room.items ?? []) {
    if (!it?.id || isBuiltin(it.id)) continue;
    const c = custom.get(it.id);
    const named = !isPlaceholderName(snap.draft?.itemNames?.[it.id], it.id) || !isPlaceholderName(c?.name, it.id) || !isPlaceholderName(it.name, it.id);
    if (!named || !isDurableIcon(c?.icon)) need.add(it.id);
  }
  return [...need].slice(0, 200);
}

/**
 * 방 구분·순서·수량·폐기 표시는 그대로 두고 이름·그림만 채웁니다.
 * 우선순위: 유효한 기존 스냅샷 → 같은 견적 업체 카탈로그 → 중립 문구/그림 없음.
 */
export function repairSharedSnapshot(snap: Snap, rows: CatalogRow[], isBuiltin: (id: string) => boolean): Snap {
  if (!snap || !Array.isArray(snap.rooms)) return snap;
  const byId = new Map(rows.map((r) => [r.item_id, r]));
  const draft = (snap.draft ??= {});
  const itemNames = { ...(draft.itemNames ?? {}) };
  const customItems = [...(draft.customItems ?? [])];
  const idx = new Map(customItems.map((c, i) => [c?.id, i]));
  const resolved = new Map<string, { name: string; icon: string }>();

  for (const room of snap.rooms) for (const it of room.items ?? []) {
    if (!it?.id || isBuiltin(it.id)) continue;
    let r = resolved.get(it.id);
    if (!r) {
      const i = idx.get(it.id);
      const c = i === undefined ? undefined : customItems[i];
      const row = byId.get(it.id);
      const name =
        [itemNames[it.id], c?.name, it.name].find((n) => !isPlaceholderName(n, it.id))?.trim() ??
        (row && catalogName(row, it.id)) ??
        UNKNOWN_ITEM_NAME;
      const icon = (isDurableIcon(c?.icon) ? c!.icon : null) ?? (row && catalogIcon(row)) ?? NO_IMAGE_ICON;
      r = { name, icon };
      resolved.set(it.id, r);
      if (name !== UNKNOWN_ITEM_NAME && isPlaceholderName(itemNames[it.id], it.id)) itemNames[it.id] = name;
      if (c) customItems[i!] = { ...c, name: isPlaceholderName(c.name, it.id) ? name : c.name, icon };
      else { idx.set(it.id, customItems.length); customItems.push({ id: it.id, name, cat: "기타", extra: 0, icon }); }
    }
    if (isPlaceholderName(it.name, it.id)) it.name = r.name;
  }
  draft.itemNames = itemNames;
  draft.customItems = customItems;
  return snap;
}
