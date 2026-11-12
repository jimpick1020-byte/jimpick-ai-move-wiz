import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calendarReservationShown } from "./calendar-visibility";

describe("contract calendar shows every confirmed reservation", () => {
  it("shows a reservation confirmed by the estimate's own deposit, even without a confirmed receipt", () => {
    assert.equal(
      calendarReservationShown({ payment_status: "deposit_paid", deposit_paid: 90000 }),
      true,
    );
    assert.equal(
      calendarReservationShown({ payment_status: "unpaid", deposit_paid: 50000, balance_paid: 0 }),
      true,
    );
  });

  it("shows a reservation confirmed only by payment status, even when the deposit amount is 0", () => {
    assert.equal(
      calendarReservationShown({ payment_status: "deposit_paid", deposit_paid: 0 }),
      true,
    );
    assert.equal(
      calendarReservationShown({ payment_status: "partial", deposit_paid: 0, balance_paid: 0 }),
      true,
    );
  });

  it("shows a completed payment", () => {
    assert.equal(
      calendarReservationShown({ payment_status: "completed", deposit_paid: 80000, balance_paid: 850000 }),
      true,
    );
  });

  it("keeps quotes, reservation requests and deposit-waiting estimates off the calendar", () => {
    assert.equal(calendarReservationShown({ payment_status: "unpaid", deposit_paid: 0 }), false);
    assert.equal(
      calendarReservationShown({ payment_status: "unpaid", deposit_paid: 0, balance_paid: 0 }),
      false,
    );
  });
});
