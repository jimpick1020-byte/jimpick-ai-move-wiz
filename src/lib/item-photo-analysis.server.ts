import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output } from "ai";
import { z } from "zod";
import type { PhotoItemCandidate } from "./item-photo-analysis.functions";

export async function analyzePhoto(photo: string): Promise<{ ok: boolean; candidates?: PhotoItemCandidate[]; error?: string }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { ok: false, error: "사진 분석 연결이 준비되지 않았습니다." };
  let runId: string | undefined;
  const provider = createOpenAI({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers); if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const response = await fetch(input, { ...init, headers });
      runId ??= response.headers.get("X-Lovable-AIG-Run-ID") || undefined;
      if (!response.ok) {
        const body = await response.clone().json().catch(() => null);
        const message = body?.error?.message ?? body?.message;
        if (message) throw new Error(message);
      }
      return response;
    },
  });
  try {
    const result = streamText({ model: provider.responses("openai/gpt-6-astra"),
      messages: [{ role: "user", content: [
        { type: "text", text: "사진에 실제로 보이는 이사 가구·가전·생활용품만 최대 8개 후보로 제안하세요. 각각 한글 품목 종류 이름과 눈에 보이는 주요 특징을 적으세요. 여러 물건이면 따로 반환하세요. 사진에서 읽히지 않는 브랜드나 모델명을 추측하지 마세요. 종류가 모호하면 uncertain=true, 추가 확인이 필요한 특징을 적으세요. 물건이 없으면 빈 목록. cat은 가구, 가전, 주방, 생활용품, 운동·레저 중 하나." },
        { type: "image", image: new URL(photo) },
      ] }],
      output: Output.object({ schema: z.object({ candidates: z.array(z.object({ name: z.string(), cat: z.enum(["가구", "가전", "주방", "생활용품", "운동·레저"]), features: z.string(), uncertain: z.boolean() })) }) }),
      providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
    });
    const output = await result.output;
    return { ok: true, candidates: output.candidates.slice(0, 8) };
  } catch (cause) {
    console.error("[item-photo-analysis]", { runId, message: cause instanceof Error ? cause.message : "failed" });
    return { ok: false, error: cause instanceof Error ? cause.message : "사진을 분석하지 못했습니다. 다시 촬영해 주세요." };
  }
}