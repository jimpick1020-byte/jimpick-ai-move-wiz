
import { plannedDeposit as pd2 } from "./deposit-rule";
import { test as t2, expect as e2 } from "bun:test";
t2("빈/0 예약금은 자동 10%", () => {
  e2(pd2(1430000, null as unknown as number)).toBe(140000);
  e2(pd2(1430000, 0)).toBe(140000);
  e2(pd2(1430000, 200000)).toBe(200000);
});
