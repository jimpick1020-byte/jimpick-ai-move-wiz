import type { Estimate, Room } from './jimpick';
import type { ExtraOrigin } from './multi-origin';
import type { IntakeForm } from './intake';

export type HouseId = 'origin-1' | 'origin-2';
export const houseLabel = (h: HouseId) => (h === 'origin-1' ? '첫 번째 집' : '두 번째 집');
export const activeHouseOf = (e: Pick<Estimate, 'activeHouse'>): HouseId => e.activeHouse ?? 'origin-1';
export const roomHouse = (r: Room): HouseId => (r.originId === 'origin-2' ? 'origin-2' : 'origin-1');

/** Swap the editable origin fields (from*) with the other house stored in extraOrigin. */
function swapOrigin(e: Estimate, otherId: HouseId): Estimate {
  const o = e.extraOrigin ?? { id: otherId, address: '', detail: '', ladder: false } as ExtraOrigin;
  const held: ExtraOrigin = {
    id: activeHouseOf(e), address: e.fromAddress, detail: e.fromDetail, x: e.fromX, y: e.fromY,
    jibun: e.fromJibun, zip: e.fromZip, size: e.sizeTab, floor: e.fromFloor, env: e.fromEnv,
    ladder: !!e.ladderFrom, ladderPrice: e.ladderFromPrice, ladderSeparate: e.ladderFromSeparate,
    ladderManual: e.ladderFromManual, ladderNote: e.ladderFromNote,
    truck5t: e.ladderFromTruck5t, truck1t: e.ladderFromTruck1t,
    floorEdited: e.fromFloorEdited, decideOnVisit: e.fromDecideOnVisit,
  };
  return {
    ...e, extraOrigin: held,
    fromAddress: o.address ?? '', fromDetail: o.detail ?? '', fromX: o.x ?? null, fromY: o.y ?? null,
    fromJibun: o.jibun, fromZip: o.zip, sizeTab: o.size ?? e.sizeTab, fromFloor: o.floor ?? 1,
    fromEnv: o.env, ladderFrom: !!o.ladder, ladderFromPrice: o.ladderPrice ?? 0,
    ladderFromSeparate: !!o.ladderSeparate, ladderFromManual: o.ladderManual, ladderFromNote: o.ladderNote,
    ladderFromTruck5t: o.truck5t, ladderFromTruck1t: o.truck1t,
    fromFloorEdited: o.floorEdited, fromDecideOnVisit: o.decideOnVisit,
  } as Estimate;
}

/** Make `target` the house being edited; each house keeps its own fields and last writing step. */
export function switchHouse(e: Estimate, target: HouseId): Estimate {
  const cur = activeHouseOf(e);
  if (cur === target) return { ...e, activeHouse: target };
  const steps = { ...e.houseSteps, [cur]: e.lastWritingScreen ?? 'step1' };
  const swapped = swapOrigin(e, target);
  return { ...swapped, activeHouse: target, houseSteps: steps, lastWritingScreen: steps[target] ?? 'step1' };
}
/** House 1 in the from* fields — used for sheets so labels stay stable. */
export const canonicalHouse = (e: Estimate): Estimate => (e.houseLinked && e.activeHouse === 'origin-2' ? switchHouse(e, 'origin-1') : e);

/** First open of the second house: seed its origin and rooms from its link answer without touching house 1. */
export function seedSecondHouse(e: Estimate, form: Partial<IntakeForm> | null | undefined, requestId: string): Estimate {
  const hasRooms = e.rooms.some(r => r.originId === 'origin-2');
  const filled = !!e.extraOrigin?.address || hasRooms;
  if (filled || !form) return { ...e, houseLinked: true, roomsCustomized: true };
  const names = [...new Set([...(form.spaces ?? []), ...Object.keys(form.rooms ?? {})])];
  const rooms: Room[] = names.map((name, i) => {
    const picks = form.rooms?.[name] ?? {};
    return { id: `${requestId}-origin-2-${i}`, originId: 'origin-2', kind: name, name: `두 번째 집 · ${name}`,
      items: Object.fromEntries(Object.entries(picks).map(([id, p]) => [id, p.qty])),
      disposal: Object.fromEntries(Object.entries(picks).filter(([, p]) => p.disposal).map(([id]) => [id, true])) };
  });
  const tagged = e.rooms.map(r => (r.originId ? r : { ...r, originId: 'origin-1' }));
  return { ...e, houseLinked: true, roomsCustomized: true, rooms: [...tagged, ...rooms],
    extraOrigin: { id: 'origin-2', address: form.fromAddress ?? '', detail: form.fromDetail ?? '', x: form.fromX, y: form.fromY,
      jibun: form.fromJibun, zip: form.fromZip, size: form.fromSize, floor: form.fromFloor,
      env: form.ladderFrom ? undefined : form.fromEnv, ladder: !!form.ladderFrom } } as Estimate;
}
