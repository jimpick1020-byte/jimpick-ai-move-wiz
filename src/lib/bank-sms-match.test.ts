import { test } from "node:test";
import { strict as assert } from "node:assert";
import { bankSmsDedupeKey, matchBankSms, type MatchCandidate } from "./bank-sms-match";

const kim = (over: Partial<MatchCandidate> = {}): MatchCandidate => ({ estimateId: "est_a", customerName: "김호영", total: 200000, depositPaid: 0, balancePaid: 0, paymentStatus: "unpaid", ...over });
const sms = (amount: number, depositorName = "김호영") => ({ amount, depositorName, looksLikeDeposit: true });

test("예약금 전 20,000원 입금은 예약금으로 연결", () => {
  const m = matchBankSms(sms(20000), [kim()]);
  assert.equal(m.status, "matched");
  assert.equal(m.status === "matched" && m.kind, "deposit");
});

test("예약금 확인 후 같은 이름 180,000원 입금은 잔금으로 연결 (예약금 기록이 막지 않음)", () => {
  const m = matchBankSms(sms(180000), [kim({ depositPaid: 20000, paymentStatus: "deposit_paid" })]);
  assert.equal(m.status, "matched");
  assert.equal(m.status === "matched" && m.kind, "balance");
  assert.equal(m.status === "matched" && m.estimateId, "est_a");
});

test("같은 이름·금액 견적이 둘이면 확정하지 않고 확인 필요", () => {
  const m = matchBankSms(sms(180000), [kim({ depositPaid: 20000 }), kim({ estimateId: "est_b", depositPaid: 20000 })]);
  assert.equal(m.status, "review");
  assert.deepEqual(m.candidates, ["est_a", "est_b"]);
});

test("결제완료 견적은 잔금 매칭 대상이 아님", () => {
  assert.equal(matchBankSms(sms(180000), [kim({ depositPaid: 20000, balancePaid: 180000, paymentStatus: "completed" })]).status, "unmatched");
});

test("금액이 다르면 확인 필요", () => {
  assert.equal(matchBankSms(sms(150000), [kim({ depositPaid: 20000 })]).status, "review");
});

test("입금 문자가 아니면 제외", () => {
  assert.equal(matchBankSms({ amount: 5000, depositorName: "", looksLikeDeposit: false }, [kim()]).status, "ignored");
});

test("중복 키는 이벤트 ID 또는 원문 기준이며 이름·견적으로 만들지 않음", () => {
  assert.equal(bankSmsDedupeKey({ eventId: "abc", rawText: "x" }, "h1"), "evt:abc");
  assert.equal(bankSmsDedupeKey({ rawText: "x" }, "h1"), "txt:h1");
});
