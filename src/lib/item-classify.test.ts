import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyItem, splitItemNames } from "./item-classify";

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
test("쉼표로 나눈 4개 품목은 각각 분류", () => {
  const names = splitItemNames("흙침대, 돌소파, 돌침대, 흙소파");
  assert.deepEqual(names, ["흙침대", "돌소파", "돌침대", "흙소파"]);
  assert.deepEqual(names.map((n) => classifyItem(n).group), ["침대", "거실 가구", "침대", "거실 가구"]);
});
test("줄바꿈·중복 이름 분리", () => {
  assert.deepEqual(splitItemNames("골프백\n골프백,\n 자전거 "), ["골프백", "자전거"]);
});
