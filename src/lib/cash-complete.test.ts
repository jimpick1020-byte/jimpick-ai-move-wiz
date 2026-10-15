import { describe, expect, it } from "vitest";
import { cashBalanceDue } from "./payment.functions";

describe("cashBalanceDue (현금 결제완료 잔금)", () => {
  it("총액에서 확인된 예약금을 뺀 금액을 잔금으로 기록한다", () => {
    expect(cashBalanceDue(1_020_000, 20_000)).toBe(1_000_000);
  });
  it("예약금이 없으면 총액 전체가 잔금이다", () => {
    expect(cashBalanceDue(500_000, 0)).toBe(500_000);
  });
  it("예약금이 총액보다 크면 0원이다", () => {
    expect(cashBalanceDue(300_000, 400_000)).toBe(0);
  });
  it("총액이 없으면 0원이다", () => {
    expect(cashBalanceDue(0, 10_000)).toBe(0);
  });
});
