import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calendarDepositConfirmed } from "./calendar-deposit";

describe("contract calendar actual deposit", () => {
  const paid = { payment_status: "deposit_paid", deposit_paid: 100000, deposit_paid_at: "2026-10-14T13:00:00Z" };
  it("does not show a move date without a confirmed actual receipt", () => {
    assert.equal(calendarDepositConfirmed(paid, false), false);
  });
  it("shows a move contract only after confirmed receipt and owner payment confirmation", () => {
    assert.equal(calendarDepositConfirmed(paid, true), true);
    assert.equal(calendarDepositConfirmed({ ...paid, deposit_paid_at: null }, true), false);
  });
  it("hides the contract after payment confirmation is cancelled or refunded", () => {
    assert.equal(calendarDepositConfirmed({ ...paid, payment_status: "unpaid", deposit_paid: 0 }, true), false);
  });
});