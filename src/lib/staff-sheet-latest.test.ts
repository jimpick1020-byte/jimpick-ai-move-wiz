import { test } from "node:test";
import assert from "node:assert/strict";
import { repairStaffSheet } from "./staff-sheet-display";
const base = { customerName: "A", customerPhone: "", moveDate: "2026-01-01", moveTime: "", moveType: "포장이사", sizeTab: "20~30평", fromAddress: "가", fromDetail: "", toAddress: "나", toDetail: "", fromFloor: 1, toFloor: 1, workEnv: "", truckText: "1톤 트럭 1대", distanceKm: 0, durationMin: 0, extraWork: [], note: "", staffName: "", staffPhone: "", rooms: [] } as never;
test("도착지 평수는 출발지 값으로 채우지 않음", () => {
  assert.equal(repairStaffSheet(base).toSizeTab, undefined);
  assert.equal(repairStaffSheet(base, { draft: { toSizeTab: "" } as never }).toSizeTab, "");
});
test("최신 저장 견적의 평수·차량을 반영하고 사다리차는 차량에 넣지 않음", () => {
  const r = repairStaffSheet(base, { draft: { sizeTab: "30~40평", toSizeTab: "10평대", truck1t: 0, truck5t: 2, ladder: 1 } as never });
  assert.equal(r.sizeTab, "30~40평");
  assert.equal(r.toSizeTab, "10평대");
  assert.equal(r.truckText, "5톤 트럭 2대");
});
