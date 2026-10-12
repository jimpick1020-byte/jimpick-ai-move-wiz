import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { normalizeContour, normalizeShelfLines, shelfTierCount, scanDisplayLabel, scanCropBounds, mapCropPoint } from "./scan-geometry";

const shelves = [200, 500].map((y) => ({ start: { x: 100, y }, end: { x: 800, y } }));
describe("사진 윤곽선·책장 단수", () => {
  it("내부 선반 2개는 3단 책장이며 실제 95%를 표시한다", () => {
    const count = shelfTierCount("책장", shelves, true, 0.95);
    assert.equal(count, 3);
    assert.equal(scanDisplayLabel({ name: "책장", confidence: 0.97, shelf_count: count, shelf_confidence: 0.95 }), "3단 책장 95%");
  });
  it("가림·불확실한 선반은 단수를 추측하지 않는다", () => {
    assert.equal(shelfTierCount("책장", shelves, false, 0.95), null);
    assert.equal(shelfTierCount("책장", shelves, true, 0.79), null);
    assert.equal(shelfTierCount("책장", null, true, 0.95), null);
  });
  it("책과 주변 물건은 책장 단수로 계산하지 않는다", () => {
    assert.equal(shelfTierCount("책", shelves, true, 0.95), null);
    assert.equal(shelfTierCount("서랍장", shelves, true, 0.95), null);
    assert.equal(normalizeShelfLines([...shelves, shelves[0], { start: { x: 400, y: 100 }, end: { x: 405, y: 800 } }]).length, 2);
  });
  it("구 결과에 윤곽이 없으면 사각형을 대신 만들어내지 않는다", () => {
    assert.equal(normalizeContour(undefined), null);
    assert.equal(normalizeContour([{ x: 0, y: 0 }, { x: 5, y: 5 }]), null);
    const contour = [{ x: 100, y: 100 }, { x: 800, y: 150 }, { x: 700, y: 900 }, { x: 200, y: 850 }];
    assert.deepEqual(normalizeContour(contour), contour);
  });
  it("조각 사진 좌표를 원본 사진 좌표로 변환한다", () => {
    const crop = scanCropBounds({ x: 200, y: 200, w: 400, h: 400 }, 1000, 1000);
    assert.deepEqual(crop, { x: 140, y: 140, w: 520, h: 520 });
    assert.deepEqual(mapCropPoint({ x: 500, y: 500 }, crop, 1000, 1000), { x: 400, y: 400 });
  });
});