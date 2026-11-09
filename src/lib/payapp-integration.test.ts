import { describe, expect, it } from "vitest";
import { firstChargeEligibility, PAYAPP_LIVE_ENABLED, unavailableFeedback } from "./payapp-integration";

describe("PayApp first payment safety", () => {
  const input = { now: "2026-11-19T00:00:00Z", trialEndsAt: "2026-11-19T00:00:00Z", consentedAt: "2026-11-19T00:00:00Z", amount: 30000 };
  it("never charges during the ten-day trial", () => {
    expect(firstChargeEligibility({ ...input, now: "2026-11-18T23:59:59Z" })).toBe("trial");
  });
  it("requires explicit consent after trial, not signup consent", () => {
    expect(firstChargeEligibility({ ...input, consentedAt: null })).toBe("consent_required");
    expect(firstChargeEligibility({ ...input, consentedAt: "2026-11-09T00:00:00Z" })).toBe("consent_required");
  });
  it("rejects a monthly amount other than 30000", () => {
    expect(firstChargeEligibility({ ...input, amount: 30001 })).toBe("wrong_amount");
  });
  it("even eligible consent cannot enable live billing", () => {
    expect(PAYAPP_LIVE_ENABLED).toBe(false);
    expect(firstChargeEligibility(input)).toBe("merchant_verification_required");
  });
  it("does not acknowledge unverified payment notifications", async () => {
    const response = unavailableFeedback();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toBe("SUCCESS");
  });
});