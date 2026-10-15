/**
 * 현금 결제완료 규칙.
 *
 * 현금으로 받은 잔금은 입금 기록이 없으므로 사장님 확인만으로 완료하며,
 * 잔금은 총액에서 이미 확인된 예약금을 뺀 금액으로 기록합니다.
 */
import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { cashBalanceDue } from "./payment.functions";

describe("cash completion", () => {
  test("cash balance is total minus the confirmed deposit", () =>
    assert.equal(cashBalanceDue(1_020_000, 20_000), 1_000_000));
  test("without a deposit the full total is the cash balance", () =>
    assert.equal(cashBalanceDue(500_000, 0), 500_000));
  test("a deposit larger than the total never goes negative", () =>
    assert.equal(cashBalanceDue(300_000, 400_000), 0));
  test("a zero total leaves nothing to collect", () =>
    assert.equal(cashBalanceDue(0, 10_000), 0));
});
