import { createFileRoute } from "@tanstack/react-router";
import { unavailableFeedback } from "@/lib/payapp-integration";

export const Route = createFileRoute("/api/public/payapp/feedback")({
  server: { handlers: {
    // Fail closed: official callback verification is not confirmed. No body logging,
    // no payment API calls, no DB writes, and no false success acknowledgement.
    POST: () => unavailableFeedback(),
    GET: () => unavailableFeedback(),
  } },
});