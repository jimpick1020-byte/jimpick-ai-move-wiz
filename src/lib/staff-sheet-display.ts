import { isLadderSeparate, sideConditionText, type Estimate } from "./jimpick";
import type { StaffSheetSnapshot } from "./staff-share";
import { compactSharedSnapshot, normalizeIcon, FAKE_DEFAULT_BOX } from "./shared-item-repair";
import { builtinItemOf } from "./shared-item-builtin";

/** Reuse the customer sheet's selected-item snapshots; never consult a global company registry. */
export function staffSheetDetails(draft: Estimate, rooms: { name: string; items: { id: string; name: string; qty: number; icon?: string; disposal?: boolean }[] }[]) {
  const repaired = compactSharedSnapshot({ draft: { itemNames: draft.itemNames, customItems: draft.customItems.map(item => ({ ...item })) }, rooms }, [], builtinItemOf);
  return {
    workers: draft.workers,
    kitchenStaff: draft.kitchenStaff,
    rooms: repaired.rooms as StaffSheetSnapshot["rooms"],
    extraWorkItems: draft.options.filter(o => o.enabled).map(o => ({ id: o.id, name: o.name, separate: !!o.separate })),
    extraWork: [
      ...draft.options.filter(o => o.enabled).map(o => `${o.name}${o.separate ? " · 별도" : ""}`),
      draft.ladderFrom ? `사다리차 출발지${isLadderSeparate(draft, "from") ? " · 별도" : ""}` : "",
      draft.ladderTo ? `사다리차 도착지${isLadderSeparate(draft, "to") ? " · 별도" : ""}` : "",
    ].filter(Boolean),
  };
}

/** Repair only the token's work sheet from its own saved estimate, never expose the estimate draft. */
export function repairStaffSheet(snapshot: StaffSheetSnapshot, source?: { draft?: Partial<Estimate>; rooms?: StaffSheetSnapshot["rooms"] }): StaffSheetSnapshot {
  const draft = source?.draft;
  const savedItems = source?.rooms?.flatMap(room => room.items) ?? [];
  const inputRooms = snapshot.rooms.map(room => ({ ...room, items: room.items.map(item => {
    const saved = savedItems.find(s => s.id && s.id === item.id);
    const valid = normalizeIcon(item.icon);
    return { ...item, icon: valid && valid !== FAKE_DEFAULT_BOX ? valid : saved?.icon ?? item.icon };
  }) }));
  const rooms = compactSharedSnapshot({ rooms: inputRooms as never, draft: {
    itemNames: draft?.itemNames,
    customItems: draft?.customItems?.map(item => ({ ...item })),
  } }, [], builtinItemOf).rooms as StaffSheetSnapshot["rooms"];
  // 최신 저장 견적이 있으면 표시 항목을 그 값으로 맞춥니다(금액은 넣지 않음).
  const d = draft as Estimate | undefined;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const latest: Partial<StaffSheetSnapshot> = d ? {
    customerName: str(d.customerName) ?? snapshot.customerName,
    customerPhone: str(d.phone) ?? snapshot.customerPhone,
    moveDate: str(d.moveDate) ?? snapshot.moveDate,
    moveTime: str(d.moveTime) ?? snapshot.moveTime,
    moveType: d.moveType != null ? String(d.moveType) : snapshot.moveType,
    sizeTab: str(d.sizeTab) ?? snapshot.sizeTab,
    toSizeTab: "toSizeTab" in d ? str(d.toSizeTab) ?? "" : snapshot.toSizeTab,
    ...(str(d.fromAddress) != null ? { fromAddress: d.fromAddress, fromDetail: d.fromDetail ?? "", fromX: d.fromX ?? null, fromY: d.fromY ?? null } : {}),
    ...(str(d.toAddress) != null ? { toAddress: d.toAddress, toDetail: d.toDetail ?? "", toX: d.toX ?? null, toY: d.toY ?? null } : {}),
    ...(typeof d.fromFloor === "number" && typeof d.toFloor === "number" ? (() => { try { return { fromEnv: sideConditionText(d, "from"), toEnv: sideConditionText(d, "to") }; } catch { return {}; } })() : {}),
    ...(typeof d.truck1t === "number" || typeof d.truck5t === "number" ? { truckText: [
      (d.truck5t ?? 0) > 0 ? `5톤 트럭 ${d.truck5t}대` : "", (d.truck1t ?? 0) > 0 ? `1톤 트럭 ${d.truck1t}대` : "",
    ].filter(Boolean).join(" · ") } : {}),
    specialTerms: str(d.specialTerms) ?? snapshot.specialTerms,
  } : {};
  const rooms2 = source?.rooms?.length ? compactSharedSnapshot({ rooms: source.rooms as never, draft: {
    itemNames: draft?.itemNames, customItems: draft?.customItems?.map(item => ({ ...item })),
  } }, [], builtinItemOf).rooms as StaffSheetSnapshot["rooms"] : rooms;
  return {
    ...snapshot, ...latest, rooms: rooms2,
    workers: draft?.workers ?? snapshot.workers,
    kitchenStaff: draft?.kitchenStaff ?? snapshot.kitchenStaff,
    extraWorkItems: draft?.options ? draft.options.filter(o => o.enabled).map(o => ({ id: o.id, name: o.name, separate: !!o.separate })) : snapshot.extraWorkItems,
  };
  return {
    ...snapshot, rooms,
    workers: snapshot.workers ?? draft?.workers,
    kitchenStaff: snapshot.kitchenStaff ?? draft?.kitchenStaff,
    extraWorkItems: snapshot.extraWorkItems ?? draft?.options?.filter(o => o.enabled).map(o => ({ id: o.id, name: o.name, separate: !!o.separate })),
  };
}