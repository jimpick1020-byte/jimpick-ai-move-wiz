import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
const expect = (v: string) => ({ toBe: (x: string) => assert.equal(v, x), toContain: (x: string) => assert.ok(v.includes(x), x) });
import { requestStatusLabel, visitSmsText, VISIT_TIMES } from "./intake";

const base = { status: "submitted", expires_at: "2099-01-01" };
describe("고객 요청 상태", () => {
  test("방문 일정을 저장하면 방문 일정 확정", () => expect(requestStatusLabel({ ...base, visit_status: "scheduled", visit_date: "2026-10-20" })).toBe("방문 일정 확정"));
  test("고객이 확인하면 고객 일정 확인", () => expect(requestStatusLabel({ ...base, visit_status: "scheduled", visit_date: "2026-10-20", visit_customer_confirmed_at: "x" })).toBe("고객 일정 확인"));
  test("보내지 않은 요청은 문자 미발송", () => expect(requestStatusLabel({ status: "created", expires_at: "2099-01-01" })).toBe("문자 미발송"));
  test("취소", () => expect(requestStatusLabel({ ...base, status: "cancelled" })).toBe("취소"));
});
test("방문 안내 문자 문구", () => {
  const t = visitSmsText({ customerName: "김호영", date: "2026-10-20", time: "오후 2시", address: "서울 강남구 1", contact: "010-1111-2222", link: null });
  expect(t).toContain("[짐픽 방문견적 안내]");
  expect(t).toContain("10월 20일 오후 2시에 방문견적을 위해 찾아가겠습니다.");
  expect(t).toContain("방문 주소: 서울 강남구 1");
  expect(t).toContain("일정 변경 문의: 010-1111-2222");
});

test("방문 시간은 오전과 오후 한 시간 구간", () => {
  assert.equal(VISIT_TIMES[0], "오전 9~10시");
  assert.ok(VISIT_TIMES.includes("오후 1~2시"));
  assert.ok(VISIT_TIMES.includes("오후 2~3시"));
  assert.ok(VISIT_TIMES.includes("오후 3~4시"));
  assert.equal(VISIT_TIMES.length, 11);
});
test("메모는 문자에 한 번만 포함하고 빈 메모는 생략", () => {
  const v = { customerName: "시험", date: "2026-10-15", time: "오후 1~2시", address: "서울 1", contact: "010-0000-0000", link: "https://example.test/visit/token" };
  const body = visitSmsText({ ...v, memo: "주차 확인" });
  assert.equal(body.split("방문 메모: 주차 확인").length - 1, 1);
  assert.equal(body.split(v.link).length - 1, 1);
  assert.equal(visitSmsText({ ...v, memo: " " }).includes("방문 메모"), false);
});
