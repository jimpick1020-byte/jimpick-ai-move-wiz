import { describe, it, expect } from "vitest";
import { NEW_TRIAL_DAYS, registerTest, notifyTest, cancelTest } from "./payapp-test";

describe("no-charge subscription", () => {
  const at = "2026-11-09T01:31:00.000Z";
  const end = "2026-11-19T01:31:00.000Z";
  it("new signup has ten days, registration does not charge", () => {
    expect(NEW_TRIAL_DAYS).toBe(10);
    const s = registerTest(at, end);
    expect(Date.parse(s.nextBillingAt) - Date.parse(at)).toBe(10 * 86400000);
    expect(s.actualCharged).toBe(0);
    expect(s.simulatedTotal).toBe(0);
  });
  it("monthly renewal simulates exactly 30000", () => {
    const s = notifyTest(registerTest(at, end), "first", 30000).state;
    expect(s.simulatedTotal).toBe(30000);
    expect(s.actualCharged).toBe(0);
    expect(s.nextBillingAt).toBe("2026-12-19T01:31:00.000Z");
  });
  it("duplicate notification does not charge twice or move date", () => {
    const s = notifyTest(registerTest(at, end), "first", 30000).state;
    const r = notifyTest(s, "first", 30000);
    expect(r.duplicate).toBe(true);
    expect(r.state).toEqual(s);
  });
  it("cancel blocks subsequent renewal", () => {
    const s = cancelTest(notifyTest(registerTest(at, end), "first", 30000).state);
    expect(s.status).toBe("canceled");
    expect(() => notifyTest(s, "second", 30000)).toThrow();
    expect(s.actualCharged).toBe(0);
  });
  it("wrong amount rejected", () => {
    expect(() => notifyTest(registerTest(at, end), "first", 1)).toThrow();
  });
});