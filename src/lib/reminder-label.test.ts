import { test, expect } from "bun:test";
import { REMINDER_STATUS_LABEL as L } from "./reminder.functions";
test("전날 안내 상태 문구는 실제 상태 기준", () => {
  expect(L.scheduled).toBe("안내문자가 예약되어 있어요");
  expect(L.delivered).toBe("안내문자를 보냈어요");
  expect(L.failed).toBe("안내문자를 보내지 못했어요");
  expect(L.processing).not.toBe("안내문자를 보냈어요");
});
