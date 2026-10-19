import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { paymentReview, pendingReceipt, balanceReceiptReady, receiptPaymentKind, type PaymentEvidence } from "./payment-review";
const receipt: PaymentEvidence = { amount: 950000, status: "pending_review", source: "sms_paste", depositorName: "시험 입금자", paymentKind: "deposit", paymentMethod: "bank_transfer" };
describe("owner receipt review", () => {
  test("80000 deposit and 950000 balance both stay pending with their own depositor", () => {
    const deposit = { ...receipt, amount: 80000, depositorName: "예약금 입금자", paymentKind: "deposit" };
    const balance = { ...receipt, amount: 950000, depositorName: "잔금 입금자", paymentKind: "balance" };
    const review = paymentReview([deposit, balance], "deposit_paid", 80000, 0, 1030000);
    assert.equal(review?.amount, 1030000);
    assert.deepEqual(review?.receipts.map((r) => [r.paymentKind, r.depositorName, r.amount]), [["deposit", "예약금 입금자", 80000], ["balance", "잔금 입금자", 950000]]);
    assert.equal(paymentReview([{ ...deposit, status: "confirmed" }, balance], "deposit_paid", 80000, 0, 1030000)?.amount, 950000);
  });
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
  test("950000 cash never creates automatic bank border", () => assert.equal(paymentReview([{ ...receipt, paymentKind: "balance", paymentMethod: "cash" }], "deposit_paid", 80000, 0, 1030000), null));
  test("950000 card never creates automatic bank border", () => assert.equal(paymentReview([{ ...receipt, paymentKind: "balance", paymentMethod: "card" }], "deposit_paid", 80000, 0, 1030000), null));
  test("950000 bank balance after 80000 deposit requires review without completing", () => {
    const bank = { ...receipt, paymentKind: "balance" };
    assert.equal(paymentReview([bank], "deposit_paid", 80000, 0, 1030000)?.amount, 950000);
    assert.equal(bank.status, "pending_review");
  });
  test("legacy bank alert remains reviewable without rewriting method", () => assert.equal(pendingReceipt({ ...receipt, paymentMethod: null }), true));
  test("customer 130000 deposit claim shows orange border", () => assert.equal(pendingReceipt({ ...receipt, amount: 130000, paymentMethod: null, source: "customer_claim" }), true));
  test("unknown unclassified source is not assumed bank transfer", () => assert.equal(pendingReceipt({ ...receipt, paymentMethod: null, source: "unknown" }), false));
  test("existing full balance completion eligibility is preserved", () => assert.equal(balanceReceiptReady([{ ...receipt, paymentKind: "balance" }], "deposit_paid", 50000, 1000000), true));
  test("short balance is reviewable but not completion eligible", () => assert.equal(balanceReceiptReady([{ ...receipt, paymentKind: "balance" }], "deposit_paid", 0, 2000000), false));
});

describe("deposit orange / balance blue border", () => {
  const receipt = { id: "r1", amount: 80000, status: "pending_review", source: "sms_paste", depositorName: "김호영", paymentKind: "deposit", paymentMethod: "bank_transfer" };
  test("pending deposit receipt gives deposit kind", () => assert.equal(paymentReview([receipt], "unpaid", 0, 0, 1030000)?.kind, "deposit"));
  test("pending balance receipt gives balance kind", () => assert.equal(paymentReview([{ ...receipt, amount: 950000, paymentKind: "balance" }], "deposit_paid", 80000, 0, 1030000)?.kind, "balance"));
  test("deposit border is thick bright orange", () => assert.equal(PAYMENT_REVIEW_BORDER.deposit, "border-4 border-[#FF8A00]"));
  test("balance border is thick bright blue", () => assert.equal(PAYMENT_REVIEW_BORDER.balance, "border-4 border-[#3B82F6]"));
  test("balance auto-calculates after 80000 deposit on 1030000 total", () => assert.equal(remainingPayment(1030000, 80000, 0), 950000));
});
