import assert from "node:assert/strict";
import test from "node:test";
import { unreadReceiptCount } from "./app-badge";

const bank = (amount: number, status: string) => ({
  amount,
  status,
  source: "sms_paste",
  depositorName: "김호영",
  paymentMethod: "bank_transfer",
});

test("미확인 계좌이체 입금 기록만 배지 숫자에 셉니다", () => {
  const rows = [
    { paymentReceipts: [bank(80000, "pending_review"), bank(950000, "pending_review")] },
    { paymentReceipts: [bank(50000, "confirmed")] },
    { paymentReceipts: [] },
  ];
  assert.equal(unreadReceiptCount(rows), 2);
});

test("현금·카드 기록과 확인 완료 기록은 배지에서 제외합니다", () => {
  const rows = [
    {
      paymentReceipts: [
        { ...bank(10000, "pending_review"), paymentMethod: "cash" },
        { ...bank(10000, "pending_review"), paymentMethod: "card" },
        bank(10000, "confirmed"),
      ],
    },
  ];
  assert.equal(unreadReceiptCount(rows), 0);
});

test("기록이 없거나 0원이면 배지는 0입니다", () => {
  assert.equal(unreadReceiptCount([]), 0);
  assert.equal(unreadReceiptCount([{ paymentReceipts: [bank(0, "pending_review")] }]), 0);
  assert.equal(unreadReceiptCount([{}]), 0);
});
