import { describe, expect, test } from "vitest";
import { balanceClaimBlock, claimAlreadyRecorded } from "./payment-review";
import { customerPaymentDue } from "./customer-payment";

const base = { confirmed: true, seenAmount: 90000, dueKind: "balance" as const, dueAmount: 90000, depositPaid: 10000, paymentStatus: "deposit_paid", contractCancelled: false, latest: true };

describe("customer balance claim", () => {
  test("100000 total, 10000 confirmed deposit → 90000 balance accepted", () => {
    const due = customerPaymentDue(100000, 10000, 0, "deposit_paid", 10000);
    expect(due).toMatchObject({ kind: "balance", amount: 90000 });
    expect(balanceClaimBlock(base)).toBeNull();
  });
  test("unchecked is blocked", () => expect(balanceClaimBlock({ ...base, confirmed: false })).not.toBeNull());
  test("changed amount is blocked", () => expect(balanceClaimBlock({ ...base, seenAmount: 80000 })).not.toBeNull());
  test("cancelled / refunded / completed / old version blocked", () => {
    expect(balanceClaimBlock({ ...base, contractCancelled: true })).not.toBeNull();
    expect(balanceClaimBlock({ ...base, paymentStatus: "refunded" })).not.toBeNull();
    expect(balanceClaimBlock({ ...base, paymentStatus: "completed" })).not.toBeNull();
    expect(balanceClaimBlock({ ...base, latest: false })).not.toBeNull();
  });
  test("no confirmed deposit → no balance claim", () => expect(balanceClaimBlock({ ...base, depositPaid: 0 })).not.toBeNull());
  test("earlier deposit claim does not block balance claim; pending bank balance of same amount does", () => {
    const deposit = { amount: 10000, status: "confirmed", paymentKind: "deposit" };
    expect(claimAlreadyRecorded([deposit], "balance", 90000)).toBe(false);
    expect(claimAlreadyRecorded([deposit, { amount: 90000, status: "pending_review", paymentKind: "balance" }], "balance", 90000)).toBe(true);
  });
});
