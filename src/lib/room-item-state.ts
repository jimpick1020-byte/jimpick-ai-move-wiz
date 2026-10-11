import type { Room } from "./jimpick";

export const CARD_DOUBLE_TAP_MS = 350;
export function isSameCardDoubleTap(previous: { key: string; at: number } | null, key: string, at: number) {
  return !!previous && previous.key === key && at - previous.at <= CARD_DOUBLE_TAP_MS;
}

/** Only the target room/item changes; removal also clears its disposal marker. */
export function withRoomQuantity(rooms: Room[], roomName: string, id: string, qty: number): Room[] {
  return rooms.map((room) => {
    if (room.name !== roomName) return room;
    const items = { ...room.items };
    const disposal = { ...room.disposal };
    if (qty <= 0) { delete items[id]; delete disposal[id]; }
    else items[id] = qty;
    return { ...room, items, disposal };
  });
}

export function withRoomDisposal(rooms: Room[], roomName: string, id: string, disposed: boolean): Room[] {
  return rooms.map((room) => {
    if (room.name !== roomName || !(room.items[id] > 0)) return room;
    const disposal = { ...room.disposal };
    if (disposed) disposal[id] = true;
    else delete disposal[id];
    return { ...room, disposal };
  });
}

/**
 * 선택 품목 화면은 분류와 무관하게 담는 순서 그대로 보여 줍니다.
 * 저장된 열쇠 순서(먼저 담은 품목이 앞)를 지키고, 수량이 0인 품목은 빼서 돌려줍니다.
 */
export function pickedIdsInInputOrder(items: Record<string, number>): string[] {
  return Object.entries(items).filter(([, qty]) => qty > 0).map(([id]) => id);
}
