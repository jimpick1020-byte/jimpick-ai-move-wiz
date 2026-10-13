import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { paymentReview, type PaymentEvidence } from "./payment-review";
const receipt: PaymentEvidence = { amount: 100000, status: "pending_review", source: "sms_paste", depositorName: "입금자", paymentKind: "deposit" };
describe("actual payment review", () => {
  test("no receipt means no border even with stored amounts", () => assert.equal(paymentReview([], "partial", 100000, 900000, 1000000), null));
  test("customer declaration is not actual payment", () => assert.equal(paymentReview([{ ...receipt, source: "customer_claim" }], "unpaid", 0, 0, 1000000), null));
  test("unconfirmed deposit has deposit border and depositor", () => assert.deepEqual(paymentReview([receipt], "unpaid", 0, 0, 1000000), { kind: "deposit", names: ["입금자"] }));
  test("confirmed deposit removes border", () => assert.equal(paymentReview([{ ...receipt, status: "confirmed" }], "deposit_paid", 100000, 0, 1000000), null));
  test("full actual balance waits for completion", () => assert.equal(paymentReview([{ ...receipt, amount: 900000, paymentKind: "balance" }], "deposit_paid", 100000, 0, 1000000)?.kind, "balance"));
  test("short balance is not full balance", () => assert.equal(paymentReview([{ ...receipt, amount: 899999, paymentKind: "balance" }], "deposit_paid", 100000, 0, 1000000), null));
  test("completed removes red border", () => assert.equal(paymentReview([{ ...receipt, amount: 900000, paymentKind: "balance" }], "completed", 100000, 900000, 1000000), null));
});