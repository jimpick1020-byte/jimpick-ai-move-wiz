import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { isSameCardDoubleTap, pickedIdsInInputOrder, withRoomDisposal, withRoomQuantity } from "./room-item-state";
import type { Room } from "./jimpick";

const rooms: Room[] = [{ id: "a", name: "안방", items: { bed: 2, desk: 1 }, disposal: { bed: true } }, { id: "b", name: "거실", items: { bed: 1 } }];
describe("shared room item rules", () => {
  it("recognizes the same card within 350ms, not another card or 351ms", () => {
    assert.equal(isSameCardDoubleTap({ key: "안방:bed", at: 100 }, "안방:bed", 450), true);
    assert.equal(isSameCardDoubleTap({ key: "안방:bed", at: 100 }, "안방:bed", 451), false);
    assert.equal(isSameCardDoubleTap({ key: "안방:bed", at: 100 }, "안방:desk", 200), false);
  });
  it("quantity changes preserve disposal and other rooms without duplicate IDs", () => {
    const next = withRoomQuantity(rooms, "안방", "bed", 3);
    assert.equal(next[0].items.bed, 3);
    assert.equal(next[0].disposal?.bed, true);
    assert.deepEqual(Object.keys(next[0].items), ["bed", "desk"]);
    assert.equal(next[1], rooms[1]);
    assert.equal(rooms[0].items.bed, 2);
  });
  it("removing a selected item clears only its quantity and disposal", () => {
    const next = withRoomQuantity(rooms, "안방", "bed", 0);
    assert.equal(next[0].items.bed, undefined);
    assert.equal(next[0].disposal?.bed, undefined);
    assert.equal(next[0].items.desk, 1);
    assert.equal(next[1], rooms[1]);
  });
  it("disposal can be restored without changing quantity and unselected items cannot be disposed", () => {
    assert.equal(withRoomDisposal(rooms, "안방", "bed", false)[0].disposal?.bed, undefined);
    assert.equal(withRoomDisposal(rooms, "안방", "bed", false)[0].items.bed, 2);
    assert.equal(withRoomDisposal(rooms, "안방", "missing", true)[0], rooms[0]);
  });
  it("picked items keep the order they were added in, ignoring category rank, and drop zero quantities", () => {
    assert.deepEqual(pickedIdsInInputOrder({ sofa: 1, bed: 2, fridge: 1, box: 0 }), ["sofa", "bed", "fridge"]);
    assert.deepEqual(pickedIdsInInputOrder({ bed: 2, desk: 1 }), ["bed", "desk"]);
    assert.deepEqual(pickedIdsInInputOrder({}), []);
  });
});
