import { calcDeposit, calcBalance, plannedDeposit } from "./deposit-rule";
import { test, expect } from "vitest";
import { newEstimate } from "./jimpick";
import { editedSheet } from "./sheet-edit";
test.each([[2002000, 200000], [1104000, 110000], [1105000, 111000]])("총액 %i의 천 원 반올림 예약금은 %i", (total, deposit) => {
  expect(calcDeposit(total)).toBe(deposit);
});
test("기존 미결제 예정액도 재계산하고 총액 변경을 반영한다", () => {
  expect(plannedDeposit(2002000, 100000)).toBe(200000);
  expect(plannedDeposit(1105000, 200000)).toBe(111000);
});
test("최소 예약금 없이 예정 잔금만 차감한다", () => {
  expect(calcDeposit(10000)).toBe(1000);
  expect(calcBalance(2002000)).toBe(1802000);
  expect(calcBalance(1105001)).toBe(994001);
});
test("보관비·추가 비용·할인이 반영된 최종 총액에서 계산한다", () => {
  const sheet = editedSheet(newEstimate(), { transportOverride: 1500000, moveType: "보관이사", storageStart: "2026-12-01", storageEnd: "2026-12-11", storageDaily: 50000, extraCharges: [{ id: "extra", label: "추가 비용", amount: 50000 }], discount: 48000 });
  expect(sheet.total).toBe(2002000);
  expect(sheet.deposit).toBe(200000);
});
