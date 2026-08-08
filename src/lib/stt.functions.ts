import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * 녹음된 음성(WAV base64)을 고정확도 AI 음성인식으로 글자로 바꿉니다.
 * 브라우저 기본 음성인식보다 한국어 인식률이 훨씬 높습니다.
 */
export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        /** data URL 또는 순수 base64 (WAV) */
        audio: z.string().min(1000),
        /** 인식 힌트 (자주 나오는 품목 이름 등) */
        hint: z.string().max(800).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ text: string; error?: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { text: "", error: "AI 키가 설정되지 않았습니다." };

    const base64 = data.audio.includes(",") ? data.audio.split(",")[1] : data.audio;
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      const bin = atob(base64);
      bytes = new Uint8Array(new ArrayBuffer(bin.length));
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return { text: "", error: "녹음 파일을 읽을 수 없습니다." };
    }
    if (bytes.byteLength < 2048) return { text: "", error: "녹음이 너무 짧습니다." };

    const form = new FormData();
    form.append("model", "openai/gpt-4o-transcribe");
    form.append("file", new Blob([bytes], { type: "audio/wav" }), "recording.wav");
    form.append("language", "ko");
    if (data.hint) form.append("prompt", data.hint);

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 429) return { text: "", error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." };
        if (res.status === 402) return { text: "", error: "AI 사용 크레딧이 부족합니다." };
        return { text: "", error: `음성인식 실패 (${res.status}) ${body.slice(0, 200)}` };
      }
      const json = (await res.json()) as { text?: string };
      return { text: (json.text ?? "").trim() };
    } catch (e) {
      return { text: "", error: e instanceof Error ? e.message : "음성인식에 실패했습니다." };
    }
  });
