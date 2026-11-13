import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payapp/return")({
  server: { handlers: {
    // Ignore provider query claims: arrival is never proof of payment.
    GET: () => new Response(null, { status: 303, headers: {
      Location: "/billing/payapp/return", "Cache-Control": "no-store",
    } }),
    POST: () => new Response(null, { status: 303, headers: {
      Location: "/billing/payapp/return", "Cache-Control": "no-store",
    } }),
  } },
});