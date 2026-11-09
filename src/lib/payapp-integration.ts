import { publicUrl } from "./app-url";

// No merchant API may be called while the official trial and verification contract is unknown.
export const PAYAPP_LIVE_ENABLED = false;
export const PAYAPP_FEEDBACK_PATH = "/api/public/payapp/feedback";
export const PAYAPP_RETURN_PATH = "/api/public/payapp/return";
export const PAYAPP_URLS = {
  feedbackurl: publicUrl(PAYAPP_FEEDBACK_PATH),
  returnurl: publicUrl(PAYAPP_RETURN_PATH),
};

export function firstChargeEligibility(input: {
  now: string; trialEndsAt: string; consentedAt: string | null; amount: number;
}) {
  const now = Date.parse(input.now);
  const end = Date.parse(input.trialEndsAt);
  const consent = input.consentedAt ? Date.parse(input.consentedAt) : NaN;
  if (!Number.isFinite(now) || !Number.isFinite(end) || now < end) return "trial";
  if (!Number.isFinite(consent) || consent < end || consent > now) return "consent_required";
  if (input.amount !== 30000) return "wrong_amount";
  return "merchant_verification_required";
}

// Never acknowledge an unverified provider event or write entitlements in mock-only mode.
export function unavailableFeedback() {
  return new Response("Payment callback processing is not enabled", {
    status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3600" },
  });
}