import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isWaitingHistoryTarget } from "./history-focus";

test("입금 대기 이동은 선택한 estimate_id만 강조", () => {
  assert.equal(isWaitingHistoryTarget("estimate-kim", "estimate-kim", "deposit_waiting"), true);
  assert.equal(isWaitingHistoryTarget("estimate-kim", "estimate-other", "deposit_waiting"), false);
});
test("입금 확인과 결제 완료 후 선택 강조 해제", () => {
  assert.equal(isWaitingHistoryTarget("estimate-kim", "estimate-kim", "reservation_confirmed"), false);
  assert.equal(isWaitingHistoryTarget("estimate-kim", "estimate-kim", "payment_completed"), false);
});
test("잔금 대기 이동도 선택한 고객만 강조하고 완료 후 해제", () => {
  assert.equal(isWaitingHistoryTarget("estimate-kim", "estimate-kim", "balance_waiting"), true);
  assert.equal(isWaitingHistoryTarget("estimate-kim", "estimate-other", "balance_waiting"), false);
  assert.equal(isWaitingHistoryTarget("estimate-kim", "estimate-kim", "payment_completed"), false);
});