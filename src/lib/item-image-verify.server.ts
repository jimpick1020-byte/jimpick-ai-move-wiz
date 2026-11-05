import { itemImageHints } from "./item-image-prompt";
import { createParser } from "eventsource-parser";

export type ImageCheck = { ok: true; seen: string } | { ok: false; seen?: string; error: string };

/** 생성된 그림이 품목 이름과 같은 물건인지 저장 전에 확인합니다(맞지 않으면 저장 금지). */
export async function verifyItemImage(name: string, dataUrl: string): Promise<ImageCheck> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { ok: false, error: "그림 확인 연결이 준비되지 않아 저장하지 않았습니다." };
  const { en, not } = itemImageHints(name);
  const text = `Expected Korean household item: "${name}"${en.length ? ` (${en.join("; ")})` : ""}.${not.length ? ` It must not be: ${not.join("; ")}.` : ""} Does the image clearly show this kind of object? Answer false if it shows a different kind of object. Describe briefly what you see in English.`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text }, { type: "input_image", image_url: dataUrl }] }],
        text: { format: { type: "json_schema", name: "item_check", strict: true, schema: {
          type: "object", additionalProperties: false, required: ["seen", "matches"],
          properties: { seen: { type: "string" }, matches: { type: "boolean" } } } } },
      }),
    });
    if (!res.ok) { const detail = await res.json().catch(() => null); return { ok: false, error: detail?.error?.message ?? detail?.message ?? `그림 확인 실패 (${res.status})` }; }
    if (!res.body) return { ok: false, error: "그림 확인 응답이 없습니다." };
    let out = "", failure = "", completed = false;
    const parser = createParser({ onEvent(event) {
      if (event.data === "[DONE]") return;
      let payload; try { payload = JSON.parse(event.data); } catch { return; }
      if (payload.type === "response.output_text.delta") out += payload.delta || "";
      if (payload.type === "response.completed") completed = true;
      if (payload.type === "error" || payload.type === "response.failed") failure = payload.error?.message ?? payload.response?.error?.message ?? "그림 확인이 중단되었습니다.";
      if (payload.type === "response.refusal.delta") failure = payload.delta || "그림 확인 요청이 거절되었습니다.";
    } });
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; parser.feed(chunk.value); }
    if (failure || !completed) return { ok: false, error: failure || "그림 확인이 완료되지 않아 저장하지 않았습니다." };
    if (!out) return { ok: false, error: "그림을 확인하지 못해 저장하지 않았습니다. 다시 생성해 주세요." };
    const parsed = JSON.parse(out) as { seen: string; matches: boolean };
    return parsed.matches ? { ok: true, seen: parsed.seen }
      : { ok: false, seen: parsed.seen, error: `그림이 「${name}」과(와) 맞지 않아 저장하지 않았습니다. 다시 생성해 주세요.` };
  } catch {
    return { ok: false, error: "그림을 확인하지 못해 저장하지 않았습니다. 다시 시도해 주세요." };
  }
}
