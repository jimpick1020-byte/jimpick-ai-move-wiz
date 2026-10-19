import { test } from "node:test";
import { strict as assert } from "node:assert";
import { homeReservationStageOf } from "./home-reservation-stage";

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