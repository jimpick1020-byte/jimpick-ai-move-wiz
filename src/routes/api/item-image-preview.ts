import { createFileRoute } from "@tanstack/react-router";

const failure = (message: string, status: number) => new Response(message, { status, headers: { "Cache-Control": "no-store" } });
export const Route = createFileRoute("/api/item-image-preview")({
  server: { handlers: { POST: async ({ request }) => {
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return failure("로그인이 필요합니다.", 401);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: auth, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !auth.user) return failure("로그인을 다시 확인해 주세요.", 401);
    const { loadEntitlement } = await import("@/lib/entitlement.functions");
    const ent = await loadEntitlement(supabaseAdmin, auth.user.id);
    if (!ent.allowed) return failure(ent.message || "이용 권한이 없습니다.", 403);
    let body: { name?: unknown; stream?: boolean };
    try { body = await request.json(); } catch { return failure("요청을 확인해 주세요.", 400); }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 24) return failure("품목 이름을 먼저 입력해 주세요.", 400);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return failure("이미지 생성 연결이 준비되지 않았습니다.", 503);
    try {
      const { generateImage } = await import("@/lib/item-image-gateway.server");
      const upstream = await generateImage({ baseURL: "https://ai.gateway.lovable.dev", apiKey: key, model: "openai/gpt-image-2.5-sunburst", format: "openai" },
        `Create a single isolated household item icon depicting: ${name}. Soft glossy 3D illustration, isometric view, centered entire object, no cropping, no text, no logos, on a clean white background, consistent moving inventory card style.`, body.stream !== false, request.signal);
      if (!upstream.ok) return failure(upstream.status === 429 ? "이미지 생성 요청이 많습니다. 잠시 후 다시 시도해 주세요." : "이미지 생성에 실패했습니다. 다시 시도해 주세요.", upstream.status === 429 ? 429 : 502);
      // Preview only: never insert item rows or upload an unapproved image.
      return new Response(upstream.body, { headers: { "Content-Type": upstream.headers.get("Content-Type") || "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
    } catch { return failure("이미지 생성에 실패했습니다. 다시 시도해 주세요.", 502); }
  } } },
});