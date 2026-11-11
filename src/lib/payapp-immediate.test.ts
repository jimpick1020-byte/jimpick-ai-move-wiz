import { describe, it, expect } from "vitest";
import { NEW_TRIAL_DAYS, startImmediateTest, approveImmediateTest, rejectImmediateTest, nextMonth, notifyTest } from "./payapp-test";
import { firstChargeEligibility, PAYAPP_LIVE_ENABLED } from "./payapp-integration";

describe("immediate subscription remains a no-charge simulation", () => {
  const now = "2026-11-11T02:25:00.000Z";
  const end = "2026-11-19T02:25:00.000Z";
  const pending = () => startImmediateTest(null, now, end, true).state;
  it("keeps ten-day signup trial and requires explicit consent", () => {
    expect(NEW_TRIAL_DAYS).toBe(10);
    expect(() => startImmediateTest(null, now, end, false)).toThrow();
    expect(pending().trialEndsAt).toBe(end);
    expect(pending().simulatedTotal).toBe(0);
  });
  it("starts only after success, for exactly 30000, anchored to actual first payment", () => {
    const at = "2026-11-12T03:00:00.000Z";
    const s = approveImmediateTest(pending(), at, 30000).state;
    expect(s.firstPaidAt).toBe(at);
    expect(s.simulatedTotal).toBe(30000);
    expect(s.nextBillingAt).toBe("2026-12-12T03:00:00.000Z");
    expect(s.trialBillingCanceled).toBe(true);
    expect(s.actualCharged).toBe(0);
    expect(() => approveImmediateTest(pending(), at, 29999)).toThrow();
  });
  it("repeated start and success notifications create one first payment", () => {
    expect(startImmediateTest(pending(), now, end, true).duplicate).toBe(true);
    const s = approveImmediateTest(pending(), now, 30000).state;
    expect(approveImmediateTest(s, end, 30000)).toEqual({ state: s, duplicate: true });
    expect(startImmediateTest(s, end, end, true)).toEqual({ state: s, duplicate: true });
    expect(s.events).toEqual(["mock:immediate:first"]);
  });
  for (const result of ["failed", "canceled"] as const) it(`${result} preserves remaining trial without a payment`, () => {
    const s = rejectImmediateTest(pending(), result);
    expect(s.trialEndsAt).toBe(end);
    expect(s.firstPaidAt).toBeUndefined();
    expect(s.simulatedTotal).toBe(0);
    expect(s.actualCharged).toBe(0);
    expect(startImmediateTest(s, now, end, true).state.checkout).toBe("pending");
  });
  it("renewal follows first-payment schedule, duplicate renewal keeps date", () => {
    const s = approveImmediateTest(pending(), now, 30000).state;
    const r = notifyTest(s, `mock:${s.nextBillingAt}`, 30000).state;
    expect(r.nextBillingAt).toBe("2027-01-11T02:25:00.000Z");
    expect(notifyTest(r, `mock:${s.nextBillingAt}`, 30000).state).toEqual(r);
  });
  it("month ends clamp rather than skipping February", () => {
    expect(nextMonth("2027-01-31T02:25:00.000Z")).toBe("2027-02-28T02:25:00.000Z");
  });
  it("immediate consent never bypasses merchant verification or allows automatic trial charge", () => {
    const input = { now, trialEndsAt: end, consentedAt: now, amount: 30000, immediate: true };
    expect(firstChargeEligibility(input)).toBe("merchant_verification_required");
    expect(firstChargeEligibility({ ...input, consentedAt: null })).toBe("consent_required");
    expect(PAYAPP_LIVE_ENABLED).toBe(false);
  });
});