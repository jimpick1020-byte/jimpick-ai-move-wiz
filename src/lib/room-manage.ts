import type { Room } from "./jimpick";

/** 방 이름 정리 — 앞뒤 공백 제거, 20자 제한 */
export function cleanRoomName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 20);
}

/** 같은 견적 안에서 이름이 겹치지 않는지 확인합니다(자기 자신 제외). */
export function roomNameError(rooms: Room[], name: string, exceptId?: string): string | null {
  const n = cleanRoomName(name);
  if (!n) return "방 이름을 입력해 주세요.";
  if (rooms.some((r) => r.id !== exceptId && r.name === n)) return "같은 이름의 방이 이미 있습니다.";
  return null;
}

export function newRoomId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 화면에 보이던 방 순서를 견적 자료로 고정합니다.
 * 보이는 방은 그 순서대로, 화면에 없던 방은 담긴 품목이 있을 때만 뒤에 남깁니다.
 */
export function materializeRooms(rooms: Room[], shownNames: string[]): Room[] {
  const used = new Set<string>();
  const out: Room[] = shownNames.map((name) => {
    const hit = rooms.find((r) => r.name === name);
    if (hit) { used.add(hit.id); return { ...hit, kind: hit.kind ?? name }; }
    return { id: `r_${name}`, name, kind: name, items: {}, disposal: {} };
  });
  for (const r of rooms) {
    if (used.has(r.id) || out.some((o) => o.id === r.id)) continue;
    if (Object.values(r.items ?? {}).some((q) => q > 0)) out.push({ ...r, kind: r.kind ?? r.name });
  }
  return out;
}

export function addRoom(rooms: Room[], name: string, id = newRoomId()): Room[] {
  return [...rooms, { id, name: cleanRoomName(name), items: {}, disposal: {} }];
}

/** 이름만 바꿉니다 — 같은 방(ID)의 품목·수량·폐기 표시·그림 종류는 그대로입니다. */
export function renameRoom(rooms: Room[], id: string, name: string): Room[] {
  return rooms.map((r) => (r.id === id ? { ...r, kind: r.kind ?? r.name, name: cleanRoomName(name) } : r));
}

/** 이 견적의 그 방(ID)만 지웁니다. */
export function deleteRoom(rooms: Room[], id: string): Room[] {
  return rooms.filter((r) => r.id !== id);
}

/** from 위치의 방을 to 위치로 옮깁니다. 위치가 같으면 원래 배열 그대로 돌려줍니다. */
export function moveRoom(rooms: Room[], id: string, toIndex: number): Room[] {
  const from = rooms.findIndex((r) => r.id === id);
  if (from < 0) return rooms;
  const to = Math.max(0, Math.min(rooms.length - 1, toIndex));
  if (from === to) return rooms;
  const next = [...rooms];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
