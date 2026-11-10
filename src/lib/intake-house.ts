import { emptyIntakeForm, mergeIntakeIntoDraft, type IntakeForm } from './intake';
import type { Estimate, Room } from './jimpick';

export const DESTINATION_KEYS = ['toAddress', 'toDetail', 'toX', 'toY', 'toJibun', 'toZip', 'toSize', 'toFloor', 'toFloorEdited', 'toEnv', 'ladderTo', 'toDecideOnVisit'] as const;
export type SharedDestination = Partial<Pick<IntakeForm, typeof DESTINATION_KEYS[number]>>;
export function mergeHouseDestination(saved: SharedDestination, incoming: IntakeForm): SharedDestination {
  const out: SharedDestination = { ...saved };
  const hasAddress = !!saved.toAddress?.trim();
  for (const key of DESTINATION_KEYS) {
    const value = incoming[key];
    // A previously loaded, blank or different address must not replace a committed destination.
    if (hasAddress && incoming.toAddress?.trim() !== saved.toAddress?.trim()) continue;
    if (value === undefined || value === null || value === '') continue;
    if (out[key] !== undefined && out[key] !== null && out[key] !== '') continue;
    Object.assign(out, { [key]: value });
  }
  return out;
}
export function houseForm(saved: Partial<IntakeForm>, phone: string, destination: SharedDestination): IntakeForm {
  return { ...emptyIntakeForm('', phone), ...saved, ...destination, extraOrigin: undefined, rooms: saved.rooms ?? {} };
}
export function mergeHouseEstimate(base: Estimate, first: IntakeForm, second: IntakeForm, requestId: string): Estimate {
  if (base.intakeOwnerStartedAt) return base;
  // Merge each origin in its own namespace. Persist IDs; never match two houses by room name alone.
  const originRooms = (origin: 'origin-1' | 'origin-2', form: IntakeForm): Room[] => {
    const existing = base.rooms.filter(r => (r.originId ?? 'origin-1') === origin);
    const names = [...new Set([...existing.map(r => r.kind || r.name.replace(/^출발지 [12] · /, '')), ...(form.spaces ?? []), ...Object.keys(form.rooms)])];
    return names.map((name, i) => {
      const old = existing.find(r => (r.kind || r.name.replace(/^출발지 [12] · /, '')) === name);
      const picks = form.rooms[name] ?? {};
      return { ...old, id: old?.id || `${requestId}-${origin}-${i}`, originId: origin, kind: name,
        name: `${origin === 'origin-1' ? '첫 번째 집' : '두 번째 집'} · ${name}`,
        items: Object.fromEntries(Object.entries(picks).map(([id, p]) => [id, p.qty])),
        disposal: Object.fromEntries(Object.entries(picks).filter(([, p]) => p.disposal).map(([id]) => [id, true])) };
    });
  };
  const merged = mergeIntakeIntoDraft({ ...base, rooms: [] }, { ...first, extraOrigin: undefined }, null, { intakeRequestId: requestId }) as unknown as Estimate;
  return { ...merged, roomsCustomized: true, houseLinked: true,
    rooms: [...originRooms('origin-1', first), ...originRooms('origin-2', second)],
    extraOrigin: { ...base.extraOrigin, id: 'origin-2', address: second.fromAddress, detail: second.fromDetail,
      x: second.fromX, y: second.fromY, jibun: second.fromJibun, zip: second.fromZip,
      size: second.fromSize, floor: second.fromFloor, env: second.ladderFrom ? undefined : second.fromEnv, ladder: !!second.ladderFrom },
  } as Estimate;
}