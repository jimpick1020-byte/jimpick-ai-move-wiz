import { test } from "node:test";
import assert from "node:assert/strict";
import { depositNoticeKey, shouldSendDepositNotice } from "./deposit-notice";
test("예약금 확인 성공 건만 안내 문자 대상", () => {
  assert.equal(shouldSendDepositNotice("deposit", true), true);
  assert.equal(shouldSendDepositNotice("balance", true), false);
  assert.equal(shouldSendDepositNotice("deposit", false), false);
});
test("같은 견적은 같은 중복 방지 키", () => {
  assert.equal(depositNoticeKey("est_1"), depositNoticeKey("est_1"));
  assert.notEqual(depositNoticeKey("est_1"), depositNoticeKey("est_2"));
});
