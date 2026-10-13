import { describe, expect, test } from "bun:test";
import { paymentReview, type PaymentEvidence } from "./payment-review";
const receipt: PaymentEvidence = { amount: 100000, status: "pending_review", source: "sms_paste", depositorName: "입금자", paymentKind: "deposit" };
describe("actual payment review", () => {
  test("no receipt means no border even with stored amounts", () => expect(paymentReview([], "partial", 100000, 900000, 1000000)).toBeNull());
  test("customer declaration is not actual payment", () => expect(paymentReview([{ ...receipt, source: "customer_claim" }], "unpaid", 0, 0, 1000000)).toBeNull());
  test("unconfirmed deposit has deposit border and depositor", () => expect(paymentReview([receipt], "unpaid", 0, 0, 1000000)).toEqual({ kind: "deposit", names: ["입금자"] }));
  test("confirmed deposit removes border", () => expect(paymentReview([{ ...receipt, status: "confirmed" }], "deposit_paid", 100000, 0, 1000000)).toBeNull());
  test("full actual balance waits for completion", () => expect(paymentReview([{ ...receipt, amount: 900000, paymentKind: "balance" }], "deposit_paid", 100000, 0, 1000000)?.kind).toBe("balance"));
  test("short balance is not full balance", () => expect(paymentReview([{ ...receipt, amount: 899999, paymentKind: "balance" }], "deposit_paid", 100000, 0, 1000000)).toBeNull());
  test("completed removes red border", () => expect(paymentReview([{ ...receipt, amount: 900000, paymentKind: "balance" }], "completed", 100000, 900000, 1000000)).toBeNull());
});