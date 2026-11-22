import { test, expect } from "vitest";
import { storagePaymentPlan, storagePaymentPlanError } from "./storage-payment";
import { homeReviewStages } from "./home-reservation-stage";
import { uniquePaymentReceipts } from "./payment-review";
import { isFullyPaid, paymentStatusFromAmounts } from "./payment.functions";
import { paymentSummaryParts } from "./payment-method";

test("2,002,000 / rounded plan 200,000 / real 100,000: planned 802,000 != actual 1,902,000", () => {
  expect(storagePaymentPlan({ total: 2002000, plannedDeposit: 200000, depositPaid: 100000, plannedInterim: 1000000 })).toMatchObject({ plannedFinal: 802000, remaining: 1902000, interimDue: 1000000, total: 2002000 });
});
test("약정과 확인된 중도금을 중복 차감하거나 실제 수납·잔금을 반올림하지 않는다", () => {
  expect(storagePaymentPlan({ total: 2002001, plannedDeposit: 200000, plannedInterim: 1000000, depositPaid: 123456, interimPaid: 333333, balancePaid: 1 })).toMatchObject({ plannedFinal: 802001, remaining: 1545211, paid: 456790, interimDue: 666667 });
});
test("confirmed interim 1,000,000 leaves 902,000", () => {
  expect(storagePaymentPlan({ total: 2002000, plannedDeposit: 100000, depositPaid: 100000, plannedInterim: 1000000, interimPaid: 1000000 })).toMatchObject({ remaining: 902000, interimDue: 0 });
});
test("partial interim 400,000 leaves interim 600,000 and total due 1,502,000", () => {
  expect(storagePaymentPlan({ total: 2002000, plannedDeposit: 100000, depositPaid: 100000, plannedInterim: 1000000, interimPaid: 400000 })).toMatchObject({ remaining: 1502000, interimDue: 600000, plannedFinal: 902000 });
});
test("zero/unset interim preserves ordinary two-payment plan", () => {
  expect(storagePaymentPlan({ total: 2002000, plannedDeposit: 100000 })).toMatchObject({ plannedFinal: 1902000, remaining: 2002000, interimDue: 0 });
});
test("plan sum cannot exceed total and negative amounts rejected", () => {
  expect(storagePaymentPlanError(2002000, 100000, 1902001)).not.toBeNull();
  expect(storagePaymentPlanError(2002000, 100000, 1902000)).toBeNull();
  expect(storagePaymentPlanError(2002000, 100000, -1)).not.toBeNull();
});
test("total reduction preserves receipts and displays excess without raising quote", () => {
  expect(storagePaymentPlan({ total: 1000000, plannedDeposit: 100000, depositPaid: 100000, plannedInterim: 500000, interimPaid: 1000000 })).toMatchObject({ total: 1000000, paid: 1100000, remaining: 0, overpaid: 100000 });
});
test("interim queue is neither deposit nor balance; only pending and deduped", () => {
  const r = { id: "interim", amount: 1000000, paymentKind: "interim", paymentMethod: "bank_transfer", source: "customer_claim", depositorName: "가상", status: "pending_review" };
  expect(homeReviewStages({ paymentReceipts: [r, r] })).toEqual(["interim_waiting"]);
  for (const status of ["confirmed", "rejected", "canceled", "excluded"]) expect(homeReviewStages({ paymentReceipts: [{ ...r, status }] })).toEqual([]);
  expect(uniquePaymentReceipts([r, r])).toHaveLength(1);
});
test("archived/full payment checks include interim, but interim alone never sets completed", () => {
  expect(isFullyPaid({ total: 2002000, depositPaid: 100000, interimPaid: 1000000, balancePaid: 902000, paymentStatus: "completed" })).toBe(true);
  expect(paymentStatusFromAmounts(2002000, 100000, 0, 2000000)).toBe("partial");
  expect(isFullyPaid({ total: 2002000, depositPaid: 100000, interimPaid: 2000000, balancePaid: 0, paymentStatus: "partial" })).toBe(false);
  expect(isFullyPaid({ total: 2002000, depositPaid: 100000, interimPaid: 2000000, balancePaid: 0, paymentStatus: "completed" })).toBe(true);
  expect(paymentSummaryParts(2002000, 100000, 902000, 100000, 1000000).balance).toBe(0);
});