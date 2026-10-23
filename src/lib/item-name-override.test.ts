import { describe, expect, it } from "vitest";
import { cleanItemName } from "./favorite-items.functions";

describe("품목 이름 수정", () => {
  it("빈 이름은 빈 값으로 정리되어 저장되지 않는다", () => {
    expect(cleanItemName("   ")).toBe("");
  });
  it("앞뒤 공백을 지우고 전체 이름을 유지한다", () => {
    expect(cleanItemName("  드레스룸   옷장 ")).toBe("드레스룸 옷장");
  });
});
