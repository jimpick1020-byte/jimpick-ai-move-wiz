import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { intakeToEstimate, estimateToIntake } from "./intake-estimate-adapter";
import { mergeIntakeIntoDraft } from "./intake";
import { newEstimate, type Estimate } from "./jimpick";
import type { IntakeForm } from "./intake";

const base = {
  customerName: "시험", phone: "01012345678", fromAddress: "서울", toAddress: "부산",
  fromDetail: "101동101호", toDetail: "202동202호", rooms: {},
} as unknown as IntakeForm;

describe("고객 작업 조건은 계단·엘리베이터·사다리차 중 하나만", () => {
  it("사다리차만 고른 고객 폼은 초안에 엘리베이터 선택이 없다", () => {
    const draft = intakeToEstimate({ ...base, ladderTo: true });
    assert.equal(draft.toEnv, undefined);
    assert.equal(draft.ladderTo, true);
  });

  it("아무것도 고르지 않은 고객 폼은 어떤 작업 방식도 기본 선택되지 않는다", () => {
    const draft = intakeToEstimate(base);
    assert.equal(draft.fromEnv, undefined);
    assert.equal(draft.toEnv, undefined);
    assert.equal(draft.ladderFrom, false);
    assert.equal(draft.ladderTo, false);
  });

  it("방식과 사다리차가 함께 저장된 옛 폼은 사다리차만 남긴다", () => {
    const draft = intakeToEstimate({ ...base, toEnv: "엘리베이터", ladderTo: true, fromEnv: "엘리베이터", ladderFrom: true });
    assert.equal(draft.toEnv, undefined);
    assert.equal(draft.ladderTo, true);
    assert.equal(draft.fromEnv, undefined);
    assert.equal(draft.ladderFrom, true);
  });

  it("방문 후 결정을 고르면 그 장소의 방식·사다리차가 모두 비워진다", () => {
    const draft = intakeToEstimate({ ...base, toEnv: "엘리베이터", ladderTo: true, toDecideOnVisit: true });
    assert.equal(draft.toEnv, undefined);
    assert.equal(draft.ladderTo, false);
  });

  it("초안을 다시 고객 폼으로 옮겨도 사다리차가 있으면 방식 선택이 남지 않는다", () => {
    const draft = intakeToEstimate({ ...base, toEnv: "엘리베이터", ladderTo: true });
    const form = estimateToIntake(draft, base);
    assert.equal(form.toEnv, undefined);
    assert.equal(form.ladderTo, true);
  });

  it("고객이 사다리차를 고르면 업체가 남겨 둔 그 장소의 방식 선택도 비워진다", () => {
    const out = mergeIntakeIntoDraft(
      { ...newEstimate(), intakeRequestId: "req-prev", toEnv: "계단", fromEnv: "엘리베이터" } as unknown as Record<string, unknown>,
      { ...base, ladderTo: true, toEnv: undefined } as unknown as IntakeForm,
      null,
      { intakeRequestId: "req-1" },
    ) as unknown as Estimate;
    assert.equal(out.toEnv, undefined);
    assert.equal(out.ladderTo, true);
    assert.equal(out.fromEnv, "엘리베이터");
  });

  it("옛 폼에 방식과 사다리차가 함께 있으면 병합에서도 사다리차만 남는다", () => {
    const out = mergeIntakeIntoDraft(
      { ...newEstimate(), intakeRequestId: "req-prev" } as unknown as Record<string, unknown>,
      { ...base, toEnv: "엘리베이터", ladderTo: true } as unknown as IntakeForm,
      null,
      { intakeRequestId: "req-2" },
    ) as unknown as Estimate;
    assert.equal(out.toEnv, undefined);
    assert.equal(out.ladderTo, true);
  });
});
