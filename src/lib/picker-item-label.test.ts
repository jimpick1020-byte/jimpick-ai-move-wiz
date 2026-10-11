import { describe, expect, it } from "vitest";
import { pickerItemLabel } from "./picker-item-label";

describe("four-screen item labels", () => {
  it("uses known Korean aliases without changing IDs", () => {
    expect(pickerItemLabel("walltv", "walltv")).toBe("벽걸이TV");
    expect(pickerItemLabel("fridge", "fridge.png")).toBe("냉장고");
    expect(pickerItemLabel("box", "box")).toBe("박스");
  });
  it("prefers real and recovered names over internal IDs", () => {
    expect(pickerItemLabel("ci_ai_abcdef", "", "슈퍼싱글 침대")).toBe("슈퍼싱글 침대");
    expect(pickerItemLabel("fridge", "김치냉장고")).toBe("김치냉장고");
  });
  it("does not expose unknown internal filenames", () => {
    expect(pickerItemLabel("unknown", "unknown.png")).toBe("품목명 확인 필요");
  });
});