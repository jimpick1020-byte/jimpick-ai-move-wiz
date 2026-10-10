import { describe, expect, test } from "bun:test";
import { isDepositConfirmedRow, shiftMonth } from "./monthly-stats";

const base = { estimate_id: "e", sheet_version: 1, move_date: "2026-10-13", total: 1000000, deposit_paid: 0, balance_paid: 0, payment_status: "unpaid", contract_status: "active" };

describe("월 통계", () => {
  test("예약금 입금 확인만 집계", () => {
    expect(isDepositConfirmedRow(base)).toBe(false);
    expect(isDepositConfirmedRow({ ...base, payment_status: "deposit_paid" })).toBe(true);
    expect(isDepositConfirmedRow({ ...base, deposit_paid: 100000 })).toBe(true);
  });
  test("취소 계약 제외", () => {
    expect(isDepositConfirmedRow({ ...base, deposit_paid: 100000, contract_status: "cancelled" })).toBe(false);
  });
  test("월 이동", () => {
    expect(shiftMonth("2026-10", -1)).toBe("2026-09");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});
