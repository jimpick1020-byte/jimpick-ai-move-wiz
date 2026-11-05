import { describe, it, expect } from "vitest";
import { addRoom, deleteRoom, materializeRooms, moveRoom, renameRoom, roomNameError } from "./room-manage";
import type { Room } from "./jimpick";

const rooms: Room[] = [
  { id: "r_안방", name: "안방", items: { bed: 1 }, disposal: { bed: true } },
  { id: "r_거실", name: "거실", items: { sofa: 2 } },
];

describe("방 관리", () => {
  it("방 추가는 빈 방만 만든다", () => {
    const next = addRoom(rooms, " 서재 ", "r_x");
    expect(next[2]).toMatchObject({ id: "r_x", name: "서재", items: {} });
  });
  it("이름 변경 시 같은 ID의 품목·폐기 표시·그림 종류 유지", () => {
    const next = renameRoom(rooms, "r_안방", "옷방");
    expect(next[0]).toMatchObject({ id: "r_안방", name: "옷방", kind: "안방", items: { bed: 1 }, disposal: { bed: true } });
    expect(next[1]).toBe(rooms[1]);
  });
  it("중복 이름은 막는다", () => {
    expect(roomNameError(rooms, "거실")).not.toBeNull();
    expect(roomNameError(rooms, "안방", "r_안방")).toBeNull();
  });
  it("이동은 ID 기준으로 순서만 바꾼다", () => {
    const next = moveRoom(rooms, "r_거실", 0);
    expect(next.map((r) => r.id)).toEqual(["r_거실", "r_안방"]);
    expect(moveRoom(rooms, "r_안방", 0)).toBe(rooms);
  });
  it("삭제는 선택한 방만 지운다", () => {
    expect(deleteRoom(rooms, "r_안방").map((r) => r.id)).toEqual(["r_거실"]);
  });
  it("화면 순서를 고정할 때 품목이 있는 숨은 방은 남긴다", () => {
    const next = materializeRooms(rooms, ["거실", "부엌"]);
    expect(next.map((r) => r.name)).toEqual(["거실", "부엌", "안방"]);
  });
});
