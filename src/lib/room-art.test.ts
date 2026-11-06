import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { roomArtKey } from "./room-art";

describe("roomArtKey", () => {
  test("화장실 계열", () => {
    for (const n of ["화장실", "욕실 2", "욕실2", "안방 화장실", "안방화장실"]) assert.equal(roomArtKey(n), "bathroom");
  });
  test("공간별", () => {
    assert.equal(roomArtKey("주방"), "kitchen");
    assert.equal(roomArtKey("부엌"), "kitchen");
    assert.equal(roomArtKey("거실"), "living");
    assert.equal(roomArtKey("안방"), "bedroom");
    assert.equal(roomArtKey("침실 1"), "bedroom");
    assert.equal(roomArtKey("작은방"), "small");
    assert.equal(roomArtKey("서재"), "study");
    assert.equal(roomArtKey("공부방"), "study");
    assert.equal(roomArtKey("드레스룸"), "dress");
    assert.equal(roomArtKey("옷방"), "dress");
    assert.equal(roomArtKey("세탁실"), "laundry");
    assert.equal(roomArtKey("발코니"), "balcony");
    assert.equal(roomArtKey("베란다 2"), "balcony");
    assert.equal(roomArtKey("창고"), "storage");
  });
  test("알 수 없는 이름은 중립", () => {
    assert.equal(roomArtKey("공간 3"), "neutral");
    assert.equal(roomArtKey(""), "neutral");
  });
});
