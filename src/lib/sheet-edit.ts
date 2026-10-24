import { calcEstimate, itemNameById, ITEM_CATALOG, type Estimate } from './jimpick';
import { calcDeposit } from './deposit-rule';

export function sheetRoomsOf(draft: Estimate) {
  return draft.rooms.map(room => ({ id: room.id, name: room.name,
    items: Object.entries(room.items).filter(([, qty]) => qty > 0).map(([id, qty]) => ({
      id, qty, disposal: !!room.disposal?.[id],
      name: draft.itemNames?.[id] || draft.customItems?.find(item => item.id === id)?.name || ITEM_CATALOG.find(item => item.id === id)?.name || itemNameById(id) || id,
    })),
  })).filter(room => room.items.length);
}

export function editedSheet(draft: Estimate, patch: Partial<Estimate>) {
  const next = { ...draft, ...patch };
  const { total, parts } = calcEstimate(next);
  next.total = total;
  next.deposit = calcDeposit(total);
  if (next.sheetSnapshot) next.sheetSnapshot = { ...next.sheetSnapshot, total, parts, rooms: sheetRoomsOf(next) };
  return next;
}

export function toggleSheetDisposal(draft: Estimate, roomId: string, itemId: string): Partial<Estimate> {
  return { rooms: draft.rooms.map(room => room.id !== roomId || !(room.items[itemId] > 0) ? room : {
    ...room, disposal: { ...room.disposal, [itemId]: !room.disposal?.[itemId] },
  }) };
}

export function isDoubleTap(first: { at: number; x: number; y: number } | null, next: { at: number; x: number; y: number }) {
  return !!first && next.at - first.at <= 320 && Math.hypot(next.x - first.x, next.y - first.y) <= 12;
}