import { test, expect } from "bun:test";
import { maskedWorkerPhone, selectedWorkerContacts, workerSmsHref } from "./worker-contact";
const contacts = [
  { id: "a", name: "동명이인", role: "현장팀장", phone: "01012345678", photo: "" },
  { id: "b", name: "동명이인", role: "주방작업자", phone: "01023456789", photo: "" },
];
test("작업자 선택은 이름이 아닌 고유 ID 기준", () => {
  expect(selectedWorkerContacts(contacts, ["b"]).map((c) => c.id)).toEqual(["b"]);
});
test("작업자 전화번호 중간 네 자리를 가림", () => {
  expect(maskedWorkerPhone("010-1234-5678")).toBe("010-****-5678");
});
test("문자 앱에 선택 작업자 전체 전화번호를 전달", () => {
  expect(workerSmsHref(contacts, "작업지시서", false)).toBe("sms:01012345678,01023456789?body=" + encodeURIComponent("작업지시서"));
});
test("잘못된 수신번호는 문자 앱 실행 차단", () => {
  expect(() => workerSmsHref([{...contacts[0], phone: ""}], "내용", false)).toThrow();
});