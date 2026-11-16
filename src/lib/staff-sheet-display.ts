import { isLadderSeparate, type Estimate } from "./jimpick";
import type { StaffSheetSnapshot } from "./staff-share";
import { compactSharedSnapshot } from "./shared-item-repair";
import { builtinItemOf } from "./shared-item-builtin";

/** Reuse the customer sheet's selected-item snapshots; never consult a global company registry. */
export function staffSheetDetails(draft: Estimate, rooms: { name: string; items: { id: string; name: string; qty: number; icon?: string; disposal?: boolean }[] }[]) {
  const repaired = compactSharedSnapshot({ draft, rooms }, [], builtinItemOf);
  return {
    workers: draft.workers,
    kitchenStaff: draft.kitchenStaff,
    rooms: repaired.rooms as StaffSheetSnapshot["rooms"],
    extraWork: [
      ...draft.options.filter(o => o.enabled).map(o => `${o.name}${o.separate ? " · 별도" : ""}`),
      draft.ladderFrom ? `사다리차 출발지${isLadderSeparate(draft, "from") ? " · 별도" : ""}` : "",
      draft.ladderTo ? `사다리차 도착지${isLadderSeparate(draft, "to") ? " · 별도" : ""}` : "",
    ].filter(Boolean),
  };
}