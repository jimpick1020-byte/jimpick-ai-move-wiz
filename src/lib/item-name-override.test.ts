import { test } from "node:test";
import { strict as assert } from "node:assert";
import { cleanRenamedItem } from "./favorite-items.functions";

test("빈 이름은 빈 값으로 정리되어 저장되지 않는다", () => {
  assert.equal(cleanRenamedItem("   "), "");
});
test("앞뒤 공백을 지우고 전체 이름을 유지한다", () => {
  assert.equal(cleanRenamedItem("  드레스룸   옷장 "), "드레스룸 옷장");
});
