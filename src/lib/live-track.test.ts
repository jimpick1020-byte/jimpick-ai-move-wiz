import { test } from "node:test";
import assert from "node:assert/strict";
import { BIG_ITEMS, MIN_AREA, bigItemLabel, sameTrack } from "./live-track";

test("작은 물건(책·컵·가방·의자)은 분석 대상이 아님", () => {
  for (const c of ["book", "cup", "backpack", "chair", "remote", "vase"]) assert.equal(BIG_ITEMS.has(c), false);
  assert.ok(MIN_AREA >= 0.05);
});

test("책상/식탁은 임의로 확정하지 않고 선택지를 줌", () => {
  assert.deepEqual(bigItemLabel("dining table", 0.9, null), { label: "", choices: ["책상", "식탁"], score: 0.9 });
});

test("냉장고는 신뢰도 70% 미만이면 품목 확인 필요", () => {
  assert.equal(bigItemLabel("refrigerator", 0.65, null).label, "");
  assert.equal(bigItemLabel("refrigerator", 0.8, null).label, "냉장고");
});

test("서랍 틈 4줄(5단)이면 5단 서랍장, 가짜 신뢰도 없음", () => {
  assert.deepEqual(bigItemLabel("_center", 0, 5), { label: "5단 서랍장", choices: [], score: 0 });
});

test("다른 종류로 바뀌면 새 detection", () => {
  assert.equal(sameTrack("refrigerator", [0, 0, 0.5, 0.5], "dining table", [0, 0, 0.5, 0.5]), false);
  assert.equal(sameTrack("bed", [0, 0, 0.5, 0.5], "bed", [0.02, 0, 0.52, 0.5]), true);
});
