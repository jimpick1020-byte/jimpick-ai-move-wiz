import { isLadderSeparate, type Estimate } from "./jimpick";
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
  return {
    ...snapshot, rooms,
    workers: snapshot.workers ?? draft?.workers,
    kitchenStaff: snapshot.kitchenStaff ?? draft?.kitchenStaff,
    extraWorkItems: snapshot.extraWorkItems ?? draft?.options?.filter(o => o.enabled).map(o => ({ id: o.id, name: o.name, separate: !!o.separate })),
  };
}