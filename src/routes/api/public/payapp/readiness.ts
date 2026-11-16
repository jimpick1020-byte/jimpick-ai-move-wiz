import { createFileRoute } from "@tanstack/react-router";
import { payappReadiness } from "@/lib/payapp-live";

export const Route = createFileRoute("/api/public/payapp/readiness")({
  server: { handlers: {
    GET: () => new Response(null, {
      status: payappReadiness(process.env).ready ? 204 : 503,
      headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" },
    }),
    HEAD: () => new Response(null, {
      status: payappReadiness(process.env).ready ? 204 : 503,
      headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" },
    }),
  } },
});