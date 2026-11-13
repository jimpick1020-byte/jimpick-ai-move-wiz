import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payapp/feedback")({
  server: { handlers: {
    POST: async ({ request }) => {
      const { handlePayappFeedback } = await import("@/lib/payapp-live.server");
      return handlePayappFeedback(request);
    },
    GET: () => new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } }),
  } },
});