import { test } from "node:test";
import { strict as assert } from "node:assert";
import { formatTel, formatDraftPhones } from "./format-input";
import { normalizePhone } from "./sms";
test("기존 숫자 전화번호와 입력 번호를 하이픈 형식으로 표시", () => {
  assert.equal(formatTel("01075662542"), "010-7566-2542");
  assert.equal(formatTel("010-7566-2542"), "010-7566-2542");
  assert.equal(formatTel("0107566"), "010-756-6");
  assert.equal(formatTel("0212345678"), "02-1234-5678");
});
test("견적 저장 번호 형식만 변환하고 기존 고객과 품목 보존", () => {
  const draft = { phone: "01075662542", staffPhone: "01012345678", customerName: "김호영", items: { id: 2 } };
  const saved = formatDraftPhones(draft);
  assert.equal(saved.phone, "010-7566-2542");
  assert.equal(saved.staffPhone, "010-1234-5678");
  assert.equal(saved.customerName, "김호영");
  assert.deepEqual(saved.items, draft.items);
});
test("문자 전송에만 하이픈 제거", () => {
  assert.equal(normalizePhone("010-7566-2542"), "01075662542");
});