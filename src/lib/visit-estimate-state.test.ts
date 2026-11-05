import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import type { Estimate } from "./jimpick";
import { areaOnlyPatch, linkedLocalEstimate, visitResumeScreen } from "./visit-estimate-state";
const request = { id: "request-1", estimate_id: "estimate-1", source_estimate_id: null };
const e = { id: "estimate-1", intakeRequestId: "request-1", status: "작성중", lastWritingScreen: "step6", rooms: [{ id: "r", name: "안방", items: { box: 12 }, disposal: { box: true } }], depositOverride: 50000 } as Estimate;
describe("visit estimate preservation", () => {
  it("repeat start retains current room quantities and custom deposit, not older server copy", () => {
    assert.equal(linkedLocalEstimate(request, e, [{ ...e, rooms: [] }]), e);
    assert.equal(linkedLocalEstimate(request, e, [])?.rooms[0].items.box, 12);
    assert.equal(linkedLocalEstimate(request, e, [])?.depositOverride, 50000);
  });
  it("resumes last writing step and opens completed estimate as sheet", () => {
    assert.equal(visitResumeScreen(e), "step6");
    assert.equal(visitResumeScreen({ ...e, status: "완료" }), "result");
  });
  it("does not infer a connection from phone or customer name", () => {
    assert.equal(linkedLocalEstimate(request, { ...e, id: "other", intakeRequestId: undefined }, []), undefined);
  });
  it("rejects multiple verifiable links rather than overwriting one", () => {
    assert.throws(() => linkedLocalEstimate(request, e, [{ ...e, id: "other" }]), /여러 개/);
  });
  it("area change adds no items and preserves origin and destination independence", () => {
    const result = { ...e, toSizeTab: "10~20평", ...areaOnlyPatch("40~50평") };
    assert.equal(result.toSizeTab, "10~20평"); assert.equal(result.sizeTab, "40~50평");
    assert.equal(result.rooms, e.rooms); assert.equal(result.rooms[0].disposal?.box, true);
    assert.deepEqual(Object.keys(areaOnlyPatch("40~50평")), ["sizeTab"]);
  });
});