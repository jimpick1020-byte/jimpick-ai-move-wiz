import { test } from "node:test";
import { strict as assert } from "node:assert";
import { homeReservationStageOf, homeReviewStages, latestTermsByEstimate } from "./home-reservation-stage";
import { paymentReview, PAYMENT_REVIEW_BORDER, type PaymentEvidence } from "./payment-review";
import { paymentSummaryParts } from "./payment-method";
import { isWaitingHistoryTarget } from "./history-focus";

const deposit: PaymentEvidence = { id: "deposit", amount: 500000, paymentKind: "deposit", paymentMethod: "bank_transfer", status: "pending_review", source: "customer_claim", depositorName: "가상" };
const excluded = { ...deposit, id: "excluded", amount: 100000, status: "rejected" };
function display(receipts: PaymentEvidence[], total = 2160000, paymentStatus = "unpaid") {
  const depositPaid = receipts.filter(r => r.status === "confirmed" && r.paymentKind === "deposit").reduce((s, r) => s + r.amount, 0);
  const balancePaid = receipts.filter(r => r.status === "confirmed" && r.paymentKind === "balance").reduce((s, r) => s + r.amount, 0);
  const input = { paymentReceipts: receipts, paymentStatus, depositPaid, balancePaid, acceptedAt: "2026-11-19", depositClaimPending: true };
  const rows = latestTermsByEstimate([{ ...input, estimateId: "synthetic", sheetVersion: 2 }, { ...input, estimateId: "synthetic", sheetVersion: 1 }]);
  const queues = homeReviewStages(input);
  const review = paymentReview(receipts, paymentStatus, depositPaid, balancePaid, total);
  return { queues, counts: ["deposit_waiting", "balance_waiting"].map(q => rows.filter(r => homeReviewStages(r).includes(q as "deposit_waiting" | "balance_waiting")).length), review, border: review ? PAYMENT_REVIEW_BORDER[review.kind] : null, stage: homeReservationStageOf(input), money: paymentSummaryParts(total, depositPaid, balancePaid, 500000) };
}
test("예약 요청만: 홈/월/목록 대기 0, 테두리 없음, 예정 500000/1660000 유지", () => {
  const d = display([]);
  assert.deepEqual(d.counts, [0, 0]); assert.deepEqual(d.queues, []); assert.equal(d.border, null);
  assert.equal(d.stage, "estimate_notice"); assert.equal(isWaitingHistoryTarget("synthetic", "synthetic", d.stage), false);
  assert.deepEqual(d.money, { total: 2160000, deposit: 500000, balance: 1660000, planned: true });
});
test("제외 100000원은 입금액도 대기 건수도 되살리지 않는다", () => {
  const d = display([excluded]);
  assert.deepEqual(d.counts, [0, 0]); assert.equal(d.review, null); assert.equal(d.stage, "estimate_notice");
  assert.deepEqual(d.money, { total: 2160000, deposit: 500000, balance: 1660000, planned: true });
});
test("예약금 신고: 여러 신고/버전도 견적 1건, 주황, 받은 금액 아님", () => {
  const d = display([deposit, { ...deposit, id: "deposit2" }]);
  assert.deepEqual(d.counts, [1, 0]); assert.equal(d.border, PAYMENT_REVIEW_BORDER.deposit); assert.equal(d.stage, "deposit_waiting"); assert.equal(d.money.planned, true);
});
test("예약금 확인 완료: 대기 해제, 실제 500000원과 잔금1660000", () => {
  const d = display([{ ...deposit, status: "confirmed" }], 2160000, "deposit_paid");
  assert.deepEqual(d.counts, [0, 0]); assert.equal(d.border, null); assert.equal(d.stage, "reservation_confirmed");
  assert.deepEqual(d.money, { total: 2160000, deposit: 500000, balance: 1660000, planned: false });
});
test("잔금 신고는 파랑/잔금1건, 예약금 대기 아님", () => {
  const d = display([{ ...deposit, status: "confirmed" }, { ...deposit, id: "balance", paymentKind: "balance", amount: 1660000 }], 2160000, "deposit_paid");
  assert.deepEqual(d.counts, [0, 1]); assert.equal(d.border, PAYMENT_REVIEW_BORDER.balance); assert.equal(d.money.balance, 1660000);
});
test("잔금 부분 확인은 미확인 신고만 유지, 전액 확인 후 0", () => {
  const paid = { ...deposit, status: "confirmed" };
  const part = { ...deposit, id: "part", paymentKind: "balance", amount: 300000, status: "confirmed" };
  const rest = { ...deposit, id: "rest", paymentKind: "balance", amount: 1360000 };
  const d = display([paid, part, rest], 2160000, "partial");
  assert.deepEqual(d.counts, [0, 1]); assert.equal(d.money.balance, 1360000); assert.equal(d.review?.amount, 1360000);
  const done = display([paid, part, { ...rest, status: "confirmed" }], 2160000, "completed");
  assert.deepEqual(done.counts, [0, 0]); assert.equal(done.border, null); assert.equal(done.stage, "payment_completed"); assert.equal(done.money.balance, 0);
});
test("제외+유효 신고 공존: 제외는 빠지고 남은 신고 유지", () => {
  const d = display([excluded, deposit]);
  assert.deepEqual(d.counts, [1, 0]); assert.equal(d.review?.amount, 500000);
  assert.equal(display([excluded, { ...deposit, status: "rejected" }]).border, null);
});
test("금액 수정/재조회/재로그인/반복 자료에서도 제외 보존 및 확인금액 유지", () => {
  const records = [excluded, { ...deposit, status: "confirmed" }];
  for (let i = 0; i < 3; i++) {
    const d = display(JSON.parse(JSON.stringify(records)), 2260000, "deposit_paid");
    assert.deepEqual(d.counts, [0, 0]); assert.equal(d.money.deposit, 500000); assert.equal(d.money.balance, 1760000);
  }
  assert.equal(display([deposit, deposit]).review?.amount, 500000);
  assert.equal(records[0].status, "rejected");
});
test("거절/제외/취소/완료 기록과 취소 계약은 모든 대기 표시에서 제외", () => {
  for (const status of ["rejected", "excluded", "canceled", "cancelled", "confirmed"]) assert.deepEqual(display([{ ...deposit, status }]).counts, [0, 0]);
  assert.deepEqual(homeReviewStages({ paymentReceipts: [deposit], contractCancelled: true }), []);
  assert.equal(paymentReview([deposit], "unpaid", 0, 0, 2160000, true), null);
});
test("양쪽 유효 신고는 각각 1건, 잔금 테두리 우선", () => {
  const d = display([deposit, { ...deposit, id: "balance", paymentKind: "balance" }]);
  assert.deepEqual(d.counts, [1, 1]); assert.equal(d.border, PAYMENT_REVIEW_BORDER.balance);
});