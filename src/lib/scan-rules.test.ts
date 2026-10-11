import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { confidenceTier, dedupedAddQty, isBacklit, needsSecondPass } from "./scan-rules";

describe("사진 인식 판정", () => {
  it("80% 이상은 자동 등록", () => {
    assert.equal(confidenceTier(0.8), "auto");
  });
  it("50~79%는 사용자 확인", () => {
    assert.equal(confidenceTier(0.5), "check");
    assert.equal(confidenceTier(0.79), "check");
  });
  it("50% 미만은 미확인", () => {
    assert.equal(confidenceTier(0.49), "unknown");
  });
  it("확실한 품목은 2차 분석하지 않음", () => {
    assert.equal(needsSecondPass({ confidence: 0.92, item_id: "fridge" }), false);
    assert.equal(needsSecondPass({ confidence: 0.6, item_id: "fridge" }), true);
  });
  it("여러 사진의 같은 물건은 수량을 더하지 않음", () => {
    assert.equal(dedupedAddQty(1, 1), 0);
    assert.equal(dedupedAddQty(2, 1), 1);
  });
  it("밝은 창과 어두운 물건이 넓으면 역광", () => {
    const g = [...Array(20).fill(0.95), ...Array(40).fill(0.05), ...Array(40).fill(0.5)];
    assert.equal(isBacklit(g), true);
    assert.equal(isBacklit(Array(100).fill(0.5)), false);
  });
});
