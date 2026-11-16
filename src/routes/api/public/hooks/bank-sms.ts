/** Retired forwarding endpoint. Do not parse bodies, inspect tokens or touch history. */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/bank-sms")({
  server: {
    handlers: {
      POST: async () => new Response(null, { status: 410, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
