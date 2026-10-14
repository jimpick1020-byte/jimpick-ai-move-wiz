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
test("방문 안내에는 방문 보안 링크 한 개만 포함", () => {
  const link = "https://example.test/visit/request?preview=v2";
  const body = visitSmsText({ link });
  assert.equal(body.match(/https:\/\/\S+/g)?.length, 1);
  assert.equal(body.split(link).length - 1, 1);
});

test("방문 시간은 오전과 오후 한 시간 구간", () => {
  assert.equal(VISIT_TIMES[0], "오전 9~10시");
  assert.ok(VISIT_TIMES.includes("오후 1~2시"));
  assert.ok(VISIT_TIMES.includes("오후 2~3시"));
  assert.ok(VISIT_TIMES.includes("오후 3~4시"));
  assert.equal(VISIT_TIMES.length, 11);
});
test("고객 상세 필드가 전달되어도 방문 문자에는 유출하지 않음", () => {
  const v = { customerName: "시험고객", date: "2026-10-15", time: "오후 1~2시", address: "서울 시험주소 1", contact: "010-0000-0000", memo: "주차 확인", link: "https://example.test/visit/token" };
  const body = visitSmsText(v);
  for (const value of [v.customerName, v.date, v.time, v.address, v.contact, v.memo]) assert.equal(body.includes(value), false);
});
