import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { withRoomQuantityStep } from "./room-item-state";
import type { Room } from "./jimpick";

describe("+·− quantity steps", () => {
  it("14 then +20 and −5 rapid taps becomes exactly 29", () => {
    let rooms: Room[] = [{ id: "a", name: "안방", items: { bed: 14 } }];
    for (let i = 0; i < 20; i++) rooms = withRoomQuantityStep(rooms, "안방", "bed", 1);
    for (let i = 0; i < 5; i++) rooms = withRoomQuantityStep(rooms, "안방", "bed", -1);
    assert.equal(rooms[0]!.items["bed"], 29);
  });
  it("never goes below zero", () => {
    let rooms: Room[] = [{ id: "a", name: "안방", items: { bed: 1 } }];
    rooms = withRoomQuantityStep(rooms, "안방", "bed", -1);
    rooms = withRoomQuantityStep(rooms, "안방", "bed", -1);
    assert.equal(rooms[0]!.items["bed"] ?? 0, 0);
  });
});
