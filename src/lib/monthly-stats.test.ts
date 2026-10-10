import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isDepositConfirmedRow, shiftMonth } from "./monthly-stats";

const base = { estimate_id: "e", sheet_version: 1, move_date: "2026-10-13", total: 1000000, deposit_paid: 0, balance_paid: 0, payment_status: "unpaid", contract_status: "active" };

test("예약금 입금 확인만 집계", () => {
  assert.equal(isDepositConfirmedRow(base), false);
  assert.equal(isDepositConfirmedRow({ ...base, payment_status: "deposit_paid" }), true);
  assert.equal(isDepositConfirmedRow({ ...base, deposit_paid: 100000 }), true);
});
test("취소 계약 제외", () => {
  assert.equal(isDepositConfirmedRow({ ...base, deposit_paid: 100000, contract_status: "cancelled" }), false);
});
test("월 이동", () => {
  assert.equal(shiftMonth("2026-10", -1), "2026-09");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});
