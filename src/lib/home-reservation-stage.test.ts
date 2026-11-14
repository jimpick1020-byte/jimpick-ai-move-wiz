import { test } from "node:test";
import { strict as assert } from "node:assert";
import { homeReservationStageOf, homeReviewStages, latestTermsByEstimate } from "./home-reservation-stage";

const balance = { amount: 200000, paymentKind: "balance", paymentMethod: "bank_transfer", status: "pending_review", source: "customer_claim", depositorName: "김호영" };
test("동의 후 미입금 고객은 예약 요청 대신 입금 대기", () => {
  assert.equal(homeReservationStageOf({ acceptedAt: "2026-10-19", paymentStatus: "unpaid" }), "deposit_waiting");
  assert.equal(homeReservationStageOf({ paymentStatus: "unpaid" }), "estimate_notice");
});
test("예약금 110000원 확인 뒤 잔금 200000원 신고는 잔금 대기", () => {
  assert.equal(homeReservationStageOf({ depositPaid: 110000, paymentStatus: "deposit_paid", paymentReceipts: [balance] }), "balance_waiting");
  assert.equal(homeReservationStageOf({ depositPaid: 110000, paymentStatus: "deposit_paid", paymentReceipts: [] }), "reservation_confirmed");
});
test("현금 카드와 확인된 잔금은 잔금 대기에서 제외", () => {
  for (const receipt of [{ ...balance, paymentMethod: "cash" }, { ...balance, paymentMethod: "card" }, { ...balance, status: "confirmed" }, { ...balance, amount: 0 }]) {
    assert.equal(homeReservationStageOf({ depositPaid: 110000, paymentStatus: "deposit_paid", paymentReceipts: [receipt] }), "reservation_confirmed");
  }
});
test("전액 결제는 잔금 대기에서 제거하여 완료로 분류", () => {
  assert.equal(homeReservationStageOf({ paymentStatus: "completed", paymentReceipts: [balance] }), "payment_completed");
});
test("은행 문자로 연결된 잔금 180,000원 확인 대기는 잔금 대기", () => {
  const sms = { ...balance, amount: 180000, source: "sms_paste" };
  assert.equal(homeReservationStageOf({ depositPaid: 20000, paymentStatus: "deposit_paid", paymentReceipts: [{ ...balance, paymentKind: "deposit", amount: 20000, status: "confirmed" }, sms] }), "balance_waiting");
});
test("은행 문자로 연결된 예약금 확인 대기는 입금 대기", () => {
  const sms = { ...balance, amount: 20000, paymentKind: "deposit", source: "sms_paste" };
  assert.equal(homeReservationStageOf({ paymentStatus: "unpaid", paymentReceipts: [sms] }), "deposit_waiting");
});
test("completed contract retains its stage but extra balance stays in the review queue", () => {
  assert.equal(homeReservationStageOf({ paymentStatus: "completed", paymentReceipts: [balance] }), "payment_completed");
  assert.deepEqual(homeReviewStages({ paymentStatus: "completed", paymentReceipts: [balance] }), ["balance_waiting"]);
});
test("both receipt kinds count in their own queue; short balance still needs review", () => {
  assert.deepEqual(homeReviewStages({ paymentReceipts: [balance, { ...balance, paymentKind: "deposit", amount: 100000 }] }), ["deposit_waiting", "balance_waiting"]);
});
test("confirmed/rejected and mere unpaid balances never count", () => {
  for (const status of ["confirmed", "rejected"]) assert.deepEqual(homeReviewStages({ paymentStatus: "partial", paymentReceipts: [{ ...balance, status }] }), []);
  assert.deepEqual(homeReviewStages({ paymentStatus: "deposit_paid", depositPaid: 100000 }), []);
});
test("cancelled and refunded contracts are excluded without modifying receipts", () => {
  for (const input of [{ contractCancelled: true }, { paymentStatus: "canceled" }, { paymentStatus: "refunded" }]) assert.deepEqual(homeReviewStages({ ...input, paymentReceipts: [balance] }), []);
});
test("one of multiple balances confirmed keeps review; last confirmed clears; new receipt restores", () => {
  const a = { ...balance, id: "a", status: "confirmed" };
  const b = { ...balance, id: "b" };
  assert.deepEqual(homeReviewStages({ paymentStatus: "partial", paymentReceipts: [a, b] }), ["balance_waiting"]);
  assert.deepEqual(homeReviewStages({ paymentStatus: "partial", paymentReceipts: [a, { ...b, status: "confirmed" }] }), []);
  assert.deepEqual(homeReviewStages({ paymentStatus: "partial", paymentReceipts: [a, { ...b, status: "confirmed" }, { ...balance, id: "c" }] }), ["balance_waiting"]);
});
test("latest version and unique estimate IDs drive both month and home queues", () => {
  const latest = { estimateId: "e", sheetVersion: 2, paymentReceipts: [balance] };
  const rows = latestTermsByEstimate([latest, { ...latest, paymentReceipts: [] }, { ...latest, sheetVersion: 1, paymentReceipts: [] }]);
  assert.deepEqual(rows, [latest]);
  assert.equal(rows.filter(r => homeReviewStages(r).includes("balance_waiting")).length, 1);
});