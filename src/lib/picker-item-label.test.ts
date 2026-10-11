import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { pickerItemLabel } from "./picker-item-label";

describe("four-screen item labels", () => {
  it("uses known Korean aliases without changing IDs", () => {
    assert.equal(pickerItemLabel("walltv", "walltv"), "벽걸이TV");
    assert.equal(pickerItemLabel("fridge", "fridge.png"), "냉장고");
    assert.equal(pickerItemLabel("box", "box"), "박스");
  });
  it("prefers real and recovered names over internal IDs", () => {
    assert.equal(pickerItemLabel("ci_ai_abcdef", "", "슈퍼싱글 침대"), "슈퍼싱글 침대");
    assert.equal(pickerItemLabel("fridge", "김치냉장고"), "김치냉장고");
  });
  it("does not expose unknown internal filenames", () => {
    assert.equal(pickerItemLabel("unknown", "unknown.png"), "품목명 확인 필요");
  });
});