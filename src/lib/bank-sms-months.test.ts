import { test } from "node:test";
import { strict as assert } from "node:assert";
import { groupBankSmsMonths, bankSmsMonthIsOpen } from "./bank-sms-months";

test("한국시간 월 경계로 묶는다", () => {
  const groups = groupBankSmsMonths([{ receivedAt: "2026-09-30T15:00:00Z" }, { receivedAt: "2026-09-30T14:59:59Z" }]);
  assert.deepEqual(groups.map((g) => [g.key, g.rows.length]), [["2026-10", 1], ["2026-09", 1]]);
});
test("다른 연도의 같은 달을 분리하고 최신 월부터 표시한다", () => {
  const groups = groupBankSmsMonths([{ receivedAt: "2025-10-19T00:00:00Z" }, { receivedAt: "2026-10-19T00:00:00Z" }]);
  assert.deepEqual(groups.map((g) => g.key), ["2026-10", "2025-10"]);
});
test("월 안 문자도 최신순이며 원래 자료를 변경하지 않는다", () => {
  const rows = [{ id: "old", receivedAt: "2026-10-01T00:00:00Z" }, { id: "new", receivedAt: "2026-10-19T00:00:00Z" }];
  assert.deepEqual(groupBankSmsMonths(rows)[0]?.rows.map((r) => r.id), ["new", "old"]);
  assert.equal(rows[0]?.id, "old");
});
test("처음에는 최신 월만 펼치고 월별 선택을 유지한다", () => {
  assert.equal(bankSmsMonthIsOpen("2026-10", "2026-10", {}), true);
  assert.equal(bankSmsMonthIsOpen("2026-09", "2026-10", {}), false);
  assert.equal(bankSmsMonthIsOpen("2026-10", "2026-10", { "2026-10": false }), false);
  assert.equal(bankSmsMonthIsOpen("2026-09", "2026-10", { "2026-09": true }), true);
});
test("수신 문자가 없으면 빈 그룹", () => assert.deepEqual(groupBankSmsMonths([]), []));