import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parseDepositSms } from "./deposit-parse";

// 2026-10-21 08:30 한국시간
const NOW = Date.parse("2026-10-20T23:30:00Z");

test("농협 250,000원 문자: 잔액이 아닌 입금액과 입금자, 한국시간 08:14를 읽음", () => {
  const p = parseDepositSms("[Web발신]\n농협 입금250,000원\n10/21 08:14 302-****-1642-11 김호영 잔액1,250,000원", NOW);
  assert.equal(p.amount, 250000);
  assert.equal(p.depositorName, "김호영");
  assert.equal(p.depositedAt, "2026-10-20T23:14:00.000Z");
  assert.equal(p.looksLikeDeposit, true);
});

test("농협 180,000원 문자도 입금액 180,000원", () => {
  const p = parseDepositSms("농협 입금180,000원 10/21 08:20 302-****-1642-11 김호영 잔액1,430,000원", NOW);
  assert.equal(p.amount, 180000);
  assert.equal(p.depositedAt, "2026-10-20T23:20:00.000Z");
});

test("날짜가 없는 문자에서 계좌번호 조각을 날짜로 읽지 않음", () => {
  assert.equal(parseDepositSms("농협 입금 250,000원 302-****-1642-11 김호영 잔액 3,000,000원", NOW).depositedAt, null);
});

test("실제 삼성 전달 JSON과 앱 접두어 대신 본문의 윤창익을 추출", () => {
  const body = "메시지 ⁨NH농협⁩ [Web발신] 농협 입금630,000원 10/23 11:26 302-****-1642-11 윤창익 잔액728,375원 10/23/2026 11:26:56 AM Samsung SM-S926N com.samsung.android.messaging 농협 입금 알림";
  for (const raw of [body, JSON.stringify({ sender: "메시지", body })]) {
    const parsed = parseDepositSms(raw, Date.parse("2026-10-23T03:00:00Z"));
    assert.equal(parsed.depositorName, "윤창익");
    assert.equal(parsed.amount, 630000);
    assert.equal(parsed.depositedAt, "2026-10-23T02:26:00.000Z");
  }
});

test("메시지 앱명만 있으면 입금자명으로 사용하지 않음", () => {
  assert.equal(parseDepositSms("메시지 농협 입금40,000원 잔액100,000원").depositorName, "");
});
