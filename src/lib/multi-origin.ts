import type { Estimate, Room } from './jimpick';

export interface ExtraOrigin {
  id: 'origin-1' | 'origin-2';
  address: string;
  detail: string;
  x?: number | null;
  y?: number | null;
  jibun?: string;
  zip?: string;
  size?: string;
  floor?: number | null;
  env?: '계단' | '엘리베이터';
  ladder: boolean;
  ladderPrice?: number;
  ladderSeparate?: boolean;
  ladderManual?: boolean;
  ladderNote?: string;
  truck5t?: number;
  truck1t?: number;
  floorEdited?: boolean;
  decideOnVisit?: boolean;
}

export const HOUSE_SIZES = ['10~20평', '20~30평', '30~40평', '40~50평', '50~60평', '60~70평'];
export function emptyExtraOrigin(): ExtraOrigin {
  return { id: 'origin-2', address: '', detail: '', ladder: false };
}
export function originHasInput(origin: ExtraOrigin, rooms: Room[] = []) {
  return !!(origin.address || origin.detail || origin.size || origin.floor || origin.env || origin.ladder || rooms.some(r => r.originId === origin.id && Object.values(r.items).some(q => q > 0)));
}
export function extraLadderIncluded(e: Pick<Estimate, 'extraOrigin' | 'ladderSeparate'>): number {
  const o = e.extraOrigin;
  return o?.ladder && !o.ladderSeparate && !e.ladderSeparate ? Math.max(0, o.ladderPrice || 0) : 0;
}
export function addSecondOrigin(e: Estimate): Partial<Estimate> {
  if (e.extraOrigin) return {};
  const names = e.rooms.length ? e.rooms.map(r => r.kind || r.name) : ['안방', '작은방', '거실'];
  return { extraOrigin: emptyExtraOrigin(), routeMode: 'sequential', roomsCustomized: true,
    rooms: [...e.rooms.map(r => ({ ...r, originId: 'origin-1', kind: r.kind || r.name, name: `출발지 1 · ${r.name}` })),
      ...names.map((name, i) => ({ id: `origin-2-room-${i}`, originId: 'origin-2', name: `출발지 2 · ${name}`, kind: name, items: {}, disposal: {} }))] };
}
export function removeSecondOrigin(e: Estimate): Partial<Estimate> {
  return { extraOrigin: undefined, routeMode: undefined, routeSegments: undefined,
    rooms: e.rooms.filter(r => r.originId !== 'origin-2').map(r => ({ ...r, name: r.name.replace(/^출발지 1 · /, '') })) };
}
export function routeLegs(e: Pick<Estimate, 'fromX' | 'fromY' | 'toX' | 'toY' | 'extraOrigin' | 'routeMode'>) {
  const from = e.fromX && e.fromY ? { x: e.fromX, y: e.fromY } : null;
  const to = e.toX && e.toY ? { x: e.toX, y: e.toY } : null;
  const o = e.extraOrigin;
  const second = o?.x && o.y ? { x: o.x, y: o.y } : null;
  if (!from || !to || (o && !second)) return [];
  if (!second) return [{ from, to }];
  return e.routeMode === 'separate' ? [{ from, to }, { from: second, to }] : [{ from, to: second }, { from: second, to }];
}