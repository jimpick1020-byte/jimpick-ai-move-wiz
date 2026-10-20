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

test("이름이 맞는 견적이 하나면 잔금보다 많이 입금돼도 연결하고 차액을 안내", () => {
  const m = matchBankSms(sms(1200000), [kim({ total: 850000, depositPaid: 80000, paymentStatus: "deposit_paid" })]);
  assert.equal(m.status, "matched");
  if (m.status === "matched") {
    assert.equal(m.kind, "balance");
    assert.equal(m.estimateId, "est_a");
    assert.equal(m.expectedAmount, 770000);
    assert.match(m.note, /예정 잔금 770,000원/);
    assert.match(m.note, /실제 입금 1,200,000원/);
    assert.match(m.note, /차액 \+430,000원/);
  }
});

test("이름이 맞는 견적이 하나면 잔금보다 적게 입금돼도 연결하고 차액을 안내", () => {
  const m = matchBankSms(sms(500000), [kim({ total: 850000, depositPaid: 80000, paymentStatus: "deposit_paid" })]);
  assert.equal(m.status, "matched");
  if (m.status === "matched") {
    assert.equal(m.kind, "balance");
    assert.equal(m.expectedAmount, 770000);
    assert.match(m.note, /차액 -270,000원/);
  }
});

test("같은 이름의 진행 중 견적이 여러 개면 금액과 관계없이 확인 필요", () => {
  const m = matchBankSms(sms(1200000), [
    kim({ total: 850000, depositPaid: 80000, paymentStatus: "deposit_paid" }),
    kim({ estimateId: "est_b", total: 500000, depositPaid: 50000, paymentStatus: "deposit_paid" }),
  ]);
  assert.equal(m.status, "review");
  assert.deepEqual(m.candidates, ["est_a", "est_b"]);
});

test("예약금 20,000원 확인 견적에 250,000원 입금: 같은 이름 과거 완료 견적이 있어도 진행 중 견적 잔금으로 연결", () => {
  const past = kim({ estimateId: "est_old", depositPaid: 20000, balancePaid: 180000, paymentStatus: "completed" });
  const live = kim({ estimateId: "est_live", depositPaid: 20000, paymentStatus: "deposit_paid" });
  const m = matchBankSms(sms(250000), [past, live]);
  assert.equal(m.status, "matched");
  if (m.status === "matched") {
    assert.equal(m.estimateId, "est_live");
    assert.equal(m.kind, "balance");
    assert.equal(m.expectedAmount, 180000);
    assert.match(m.note, /차액 \+70,000원/);
  }
  const exact = matchBankSms(sms(180000), [past, live]);
  assert.equal(exact.status === "matched" && exact.estimateId, "est_live");
});

test("입금 문자가 아니면 제외", () => {
  assert.equal(matchBankSms({ amount: 5000, depositorName: "", looksLikeDeposit: false }, [kim()]).status, "ignored");
});

test("중복 키는 이벤트 ID 또는 원문 기준이며 이름·견적으로 만들지 않음", () => {
  assert.equal(bankSmsDedupeKey({ eventId: "abc", rawText: "x" }, "h1"), "evt:abc");
  assert.equal(bankSmsDedupeKey({ rawText: "x" }, "h1"), "txt:h1");
});

test("자동 전달 주소는 미리보기에서 만들어도 운영 주소", async () => {
  const { bankSmsForwardUrl } = await import("./bank-sms-match");
  assert.equal(bankSmsForwardUrl("ab12"), "https://jimpick-ai-move-wiz.lovable.app/api/public/hooks/bank-sms?k=ab12");
});

test("전달 본문: text/plain으로 온 JSON도 문자 원문을 꺼내고, 치환 안 된 {{body}}는 빈 값", async () => {
  const { extractForwardedText } = await import("./bank-sms-match");
  const r = extractForwardedText('{"sender":"15882100","body":"농협 입금250,000원 김호영"}');
  assert.equal(r.text, "농협 입금250,000원 김호영");
  assert.equal(r.sender, "15882100");
  assert.equal(extractForwardedText('{"sender":"{{sender}}","body":"{{body}}"}').text, "");
  assert.equal(extractForwardedText("농협 입금180,000원").text, "농협 입금180,000원");
});
