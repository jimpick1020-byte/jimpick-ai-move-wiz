import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyItem } from "./item-classify";

test("슈퍼싱글 침대 → 가구/침대/침대(슈퍼싱글)", () => {
  const c = classifyItem("슈퍼싱글 침대", "가전");
  assert.deepEqual([c.cat, c.group, c.variant, c.confident], ["가구", "침대", "침대(슈퍼싱글)", true]);
});
test("6인 원목 식탁 → 가구/식탁·의자/식탁(6인)", () => {
  const c = classifyItem("6인 원목 식탁");
  assert.deepEqual([c.cat, c.group, c.variant], ["가구", "식탁·의자", "식탁(6인)"]);
});
test("5단 플라스틱 서랍장 → 가구/침실 수납/서랍장", () => {
  const c = classifyItem("5단 플라스틱 서랍장");
  assert.deepEqual([c.cat, c.group, c.variant], ["가구", "침실 수납", "서랍장"]);
});
test("골프백 → 운동·레저/골프용품", () => {
  const c = classifyItem("골프백");
  assert.deepEqual([c.cat, c.group], ["운동·레저", "골프용품"]);
});
test("키워드 없는 품목은 현재 카테고리의 기타, 확인 필요", () => {
  const c = classifyItem("반짝이 오브제", "주방");
  assert.deepEqual([c.cat, c.group, c.confident], ["주방", "기타", false]);
  assert.equal(classifyItem("반짝이 오브제").cat, null);
});
