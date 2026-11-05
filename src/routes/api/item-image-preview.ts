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
    let body: { name?: unknown; stream?: boolean; photo?: string; features?: string };
    try { body = await request.json(); } catch { return failure("요청을 확인해 주세요.", 400); }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80) return failure("품목 이름은 80자 이내로 입력해 주세요.", 400);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return failure("이미지 생성 연결이 준비되지 않았습니다.", 503);
    try {
      const { generateImage, editImage } = await import("@/lib/item-image-gateway.server");
      const { buildItemImagePrompt } = await import("@/lib/item-image-prompt");
      const config = { baseURL: "https://ai.gateway.lovable.dev", apiKey: key, model: "openai/gpt-image-2.5-sunburst", format: "openai" as const };
      let upstream: Response;
      if (body.photo) {
        const match = body.photo.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
        if (!match || body.photo.length > 4_000_000) return failure("사진 파일을 확인해 주세요.", 400);
        const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
        const form = new FormData();
        form.set("image", new Blob([bytes], { type: match[1] }), match[1] === "image/png" ? "photo.png" : "photo.jpg");
        form.set("prompt", `${buildItemImagePrompt(name)} The reference photo supplies the selected object's real shape and material. Depict only the selected item named ${JSON.stringify(name)}. Visible features: ${(body.features || "").slice(0, 600)}. Preserve visible features, invent no brand or model; exclude other objects.`);
        form.set("stream", String(body.stream !== false)); form.set("size", "1024x1024"); form.set("quality", "medium");
        upstream = await editImage(config, form);
      } else upstream = await generateImage(config, buildItemImagePrompt(name), body.stream !== false);
      if (!upstream.ok) {
        const detail = await upstream.json().catch(() => null);
        console.error("[item-image-preview]", { phase: "generate", status: upstream.status });
        return failure(detail?.error?.message ?? detail?.message ?? `이미지 생성 실패 (${upstream.status})`, upstream.status);
      }
      // Preview only: never insert item rows or upload an unapproved image.
      return new Response(upstream.body, { headers: { "Content-Type": upstream.headers.get("Content-Type") || "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
    } catch (cause) { console.error("[item-image-preview]", cause instanceof Error ? cause.message : "failed"); return failure("이미지 생성 연결에 실패했습니다. 다시 시도해 주세요.", 502); }
  } } },
});