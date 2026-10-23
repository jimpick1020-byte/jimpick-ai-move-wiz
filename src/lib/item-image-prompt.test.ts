import { test } from "node:test";
import assert from "node:assert/strict";
import { buildItemImagePrompt } from "./item-image-prompt";
test("스피닝바이크 is an exercise bike, never a dryer", () => {
  const p = buildItemImagePrompt("스피닝바이크");
  assert.match(p, /exercise bike/); assert.match(p, /pedals/); assert.match(p, /NOT look like: clothes dryer/);
});
test("빨래건조대 is a drying rack, not the electric dryer", () => {
  assert.match(buildItemImagePrompt("빨래건조대"), /drying rack/);
  assert.doesNotMatch(buildItemImagePrompt("빨래건조대"), /It must clearly be: electric front-loading/);
});
test("counts from the name", () => {
  assert.match(buildItemImagePrompt("6단 서랍장"), /exactly 6 stacked drawers/);
  assert.match(buildItemImagePrompt("4도어 냉장고"), /exactly 4 doors/);
  assert.match(buildItemImagePrompt("2층침대"), /bunk bed/);
});
