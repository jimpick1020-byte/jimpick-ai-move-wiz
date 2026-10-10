import { test } from "node:test";
import { strict as assert } from "node:assert";
import { groupWorkerContacts, workerGender, maskedWorkerPhone, selectedWorkerContacts, workerSmsHref, type WorkerContact } from "./worker-contact";
const contacts = [
  { id: "a", name: "동명이인", role: "현장팀장", phone: "01012345678", photo: "" },
  { id: "b", name: "동명이인", role: "주방작업자", phone: "01023456789", photo: "" },
];
test("작업자 선택은 이름이 아닌 고유 ID 기준", () => {
  assert.deepEqual(selectedWorkerContacts(contacts, ["b"]).map((c) => c.id), ["b"]);
});
test("작업자 전화번호 중간 네 자리를 가림", () => {
  assert.equal(maskedWorkerPhone("010-1234-5678"), "010-****-5678");
});
test("문자 앱에 선택 작업자 전체 전화번호를 전달", () => {
  assert.equal(workerSmsHref(contacts, "작업지시서", false), "sms:01012345678,01023456789?body=" + encodeURIComponent("작업지시서"));
});
test("잘못된 수신번호는 문자 앱 실행 차단", () => {
  assert.throws(() => workerSmsHref([{...contacts[0], phone: ""}], "내용", false));
});
test("기존 성별 없는 작업자는 역할과 사진에 관계없이 미지정", () => {
  assert.equal(workerGender(contacts[1]), "unspecified");
  assert.equal(workerGender({ gender: "unknown" }), "unspecified");
});
test("남자 5명 여자 1명은 저장된 성별로만 집계", () => {
  const rows: WorkerContact[] = Array.from({ length: 5 }, (_, i) => ({ ...contacts[0], id: String(i), gender: "male" }));
  rows.push({ ...contacts[1], gender: "female" }, { ...contacts[0], id: "legacy" });
  const groups = groupWorkerContacts(rows);
  assert.equal(groups.male.length, 5);
  assert.equal(groups.female.length, 1);
  assert.equal(groups.unspecified.length, 1);
});
test("성별 수정 시 기존 정보와 ID를 보존하고 올바른 그룹으로 이동", () => {
  const original: WorkerContact = { ...contacts[0], gender: "male" };
  const edited: WorkerContact = { ...original, gender: "female" };
  const groups = groupWorkerContacts([edited]);
  assert.equal(groups.male.length, 0);
  assert.deepEqual(groups.female, [{ ...original, gender: "female" }]);
  assert.equal(groups.unspecified.length, 0);
});