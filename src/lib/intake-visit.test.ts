import { describe, expect, test } from "bun:test";
import { requestStatusLabel, visitSmsText } from "./intake";

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
