import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { DEFAULT_SIZE_PRESETS } from "./size-presets";
import { SIZE_TABS } from "../components/jimpick/screens";

/** 4단계에 실제로 보여 주는 방 순서 = 평수 구획 + 기본품목에 적힌 방 */
const visibleRooms = (key: string) => {
  const tab = SIZE_TABS.find((t) => t.key === key);
  assert.ok(tab, `${key} 평수 구획이 없습니다`);
  const preset = DEFAULT_SIZE_PRESETS[key] ?? [];
  return [...new Set([...tab.rooms, ...preset.map((r) => r.room)])];
};

describe("40~50평 / 50~60평 방 구성", () => {
  it("40~50평에는 기타·서재·작은방이 없고 정한 순서대로 보인다", () => {
    assert.deepEqual(visibleRooms("40~50평"), ["안방", "작은방1", "작은방2", "입구방", "거실", "부엌", "베란다"]);
    for (const gone of ["기타", "서재", "작은방"]) {
      assert.ok(!visibleRooms("40~50평").includes(gone), `40~50평에 ${gone}이 남아 있습니다`);
    }
  });

  it("50~60평에는 기타·서재·작은방이 없고 정한 순서대로 보인다", () => {
    assert.deepEqual(visibleRooms("50~60평"), ["안방", "작은방1", "작은방2", "서재방", "입구방", "거실", "부엌", "베란다"]);
    for (const gone of ["기타", "서재", "작은방"]) {
      assert.ok(!visibleRooms("50~60평").includes(gone), `50~60평에 ${gone}이 남아 있습니다`);
    }
  });

  it("나머지 평수는 그대로다", () => {
    assert.deepEqual(visibleRooms("20~30평"), ["안방", "작은방", "거실", "부엌", "베란다", "입구방"]);
    assert.deepEqual(visibleRooms("30~40평"), ["안방", "작은방", "입구방", "거실", "부엌", "베란다"]);
    assert.deepEqual(visibleRooms("60~70평"), ["안방", "작은방1", "작은방2", "작은방3", "서재방", "입구방", "거실", "부엌", "베란다"]);
  });

  it("삭제한 방의 품목이 다른 방으로 옮겨가지 않는다", () => {
    const rooms40 = DEFAULT_SIZE_PRESETS["40~50평"].map((r) => r.room);
    assert.deepEqual(rooms40, ["안방", "작은방2", "거실", "부엌", "베란다"]);
    const rooms50 = DEFAULT_SIZE_PRESETS["50~60평"].map((r) => r.room);
    assert.deepEqual(rooms50, ["안방", "작은방2", "입구방", "거실", "부엌", "베란다"]);
  });
});
