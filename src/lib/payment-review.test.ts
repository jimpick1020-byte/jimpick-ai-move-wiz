import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { paymentReview, pendingReceipt, balanceReceiptReady, receiptPaymentKind, type PaymentEvidence } from "./payment-review";
const receipt: PaymentEvidence = { amount: 950000, status: "pending_review", source: "sms_paste", depositorName: "시험 입금자", paymentKind: "deposit" };
describe("owner receipt review", () => {
  test("950000 pending deposit requires review", () => assert.equal(paymentReview([receipt], "unpaid", 0, 0, 2000000)?.amount, 950000));
  test("950000 short balance also requires orange review", () => assert.equal(paymentReview([{ ...receipt, paymentKind: "balance" }], "deposit_paid", 100000, 0, 2000000)?.kind, "deposit"));
  test("stored completed state cannot hide pending receipt", () => assert.equal(paymentReview([receipt], "completed", 0, 0, 950000)?.amount, 950000));
  test("positive pending imported record requires review regardless of source", () => assert.equal(paymentReview([{ ...receipt, source: "bank_import" }], "unpaid", 0, 0, 2000000)?.amount, 950000));
  test("zero amount never needs review", () => assert.equal(pendingReceipt({ ...receipt, amount: 0 }), false));
  test("receipt amount alone never confirms it", () => { assert.equal(pendingReceipt(receipt), true); assert.equal(receipt.status, "pending_review"); });
  test("confirmed 950000 removes orange", () => assert.equal(paymentReview([{ ...receipt, status: "confirmed" }], "unpaid", 0, 0, 2000000), null));
  test("no receipt means no border even with stored amounts", () => assert.equal(paymentReview([], "partial", 950000, 950000, 2000000), null));
  test("rejected receipt does not need confirmation", () => assert.equal(pendingReceipt({ ...receipt, status: "rejected" }), false));
  test("multiple depositors retain individual names and amounts", () => {
    const second = { ...receipt, amount: 50000, depositorName: "두번째 입금자" };
    const review = paymentReview([receipt, second], "unpaid", 0, 0, 2000000);
    assert.equal(review?.amount, 1000000);
    assert.deepEqual(review?.receipts.map((r) => [r.depositorName, r.amount]), [["시험 입금자", 950000], ["두번째 입금자", 50000]]);
  });
  test("confirming one record leaves the other pending", () => assert.equal(paymentReview([{ ...receipt, status: "confirmed" }, { ...receipt, amount: 50000 }], "unpaid", 0, 0, 2000000)?.amount, 50000));
  test("explicit balance before deposit confirmation stays balance", () => assert.equal(receiptPaymentKind(0, "balance"), "balance"));
  test("existing full balance completion eligibility is preserved", () => assert.equal(balanceReceiptReady([{ ...receipt, paymentKind: "balance" }], "deposit_paid", 50000, 1000000), true));
  test("short balance is reviewable but not completion eligible", () => assert.equal(balanceReceiptReady([{ ...receipt, paymentKind: "balance" }], "deposit_paid", 0, 2000000), false));
});
