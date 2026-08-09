import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

/*
 * AI 부동산 블로그 자동 작성 — 서버 함수
 *
 * 두 가지 서버 함수를 제공합니다.
 *  1) analyzePropertyPhotos : 매물 사진을 비전 AI로 분석해 공간/장점을 추출
 *  2) generateRealEstateBlog : 입력 정보 + 사진 분석으로 블로그 글(제목/본문/장점/해시태그) 생성
 *
 * AI API KEY 는 서버 환경변수(LOVABLE_API_KEY)로만 사용하며 프론트엔드에 노출하지 않습니다.
 */

const VISION_MODEL = "google/gemini-3.6-flash";
const TEXT_MODEL = "google/gemini-3.6-flash";

/* ────────────────────────────────────────────────────────────
 * 1. 사진 분석
 * ──────────────────────────────────────────────────────────── */

const PhotoAnalysisSchema = z.object({
  photos: z.array(
    z.object({
      index: z.number(),
      room: z.string().nullable(), // 거실/주방/안방/작은방/욕실/현관/베란다/외부전망/단지전경/기타
      confidence: z.number(),
      strengths: z.array(z.string()),
    }),
  ),
  overallStrengths: z.array(z.string()),
});

export interface PhotoAnalysis {
  index: number;
  room: string | null;
  confidence: number;
  strengths: string[];
}

export interface PropertyPhotoAnalysisResult {
  photos: PhotoAnalysis[];
  overallStrengths: string[];
  error?: string;
}

const VISION_SYSTEM = `당신은 한국 부동산 매물 사진을 분석하는 전문 AI 비전 분석가입니다.
부동산 실장이 현장에서 촬영한 아파트 사진들을 보고, 각 사진이 어떤 공간인지와 사진에서 드러나는 장점을 찾아냅니다.

규칙:
1. 각 사진의 room 은 다음 중 하나 또는 null 입니다: 거실, 주방, 안방, 작은방, 욕실, 현관, 베란다, 외부전망, 단지전경, 기타.
2. confidence 는 0~1 실수. 공간이 또렷하게 보이고 확실할 때만 0.9 이상.
3. strengths 에는 그 사진에서 "실제로 눈에 보이는" 장점만 짧은 표현으로 적습니다.
   예: "채광이 좋음", "거실이 넓음", "화이트 인테리어", "주방 수납공간 좋음", "조망 좋음",
       "깔끔하게 관리됨", "신축 느낌", "구조가 반듯함", "붙박이장", "시스템에어컨", "넓은 베란다".
4. 확실하지 않은 내용을 사실처럼 만들어내지 않습니다. 보이지 않으면 적지 않습니다.
5. overallStrengths 에는 전체 사진을 종합했을 때의 핵심 장점 3~7개를 중복 없이 정리합니다.
6. 출력은 반드시 {"photos":[{"index","room","confidence","strengths"}],"overallStrengths":[]} 형태의 JSON 객체 하나입니다.`;

export const analyzePropertyPhotos = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        images: z.array(z.string().min(20)).min(1).max(10),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<PropertyPhotoAnalysisResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { photos: [], overallStrengths: [], error: "AI 키가 설정되지 않았습니다." };

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway(VISION_MODEL);

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: PhotoAnalysisSchema }),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: VISION_SYSTEM },
              {
                type: "text",
                text: `아래 ${data.images.length}장의 매물 사진을 순서대로 분석해 주세요. 각 사진의 index 는 0부터 시작합니다.`,
              },
              ...data.images.map((img) => ({ type: "image" as const, image: img })),
            ],
          },
        ],
      });

      const photos: PhotoAnalysis[] = (output.photos ?? []).map((p) => ({
        index: Math.max(0, Math.round(p.index ?? 0)),
        room: p.room ?? null,
        confidence: Math.max(0, Math.min(1, p.confidence ?? 0)),
        strengths: (p.strengths ?? []).map((s) => String(s)).filter(Boolean).slice(0, 8),
      }));

      const overall = [...new Set((output.overallStrengths ?? []).map((s) => String(s)).filter(Boolean))].slice(
        0,
        8,
      );

      return { photos, overallStrengths: overall };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "사진 분석에 실패했습니다.";
      if (msg.includes("429")) return { photos: [], overallStrengths: [], error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." };
      if (msg.includes("402")) return { photos: [], overallStrengths: [], error: "AI 사용 크레딧이 부족합니다." };
      return { photos: [], overallStrengths: [], error: msg };
    }
  });

/* ────────────────────────────────────────────────────────────
 * 2. 블로그 글 생성
 * ──────────────────────────────────────────────────────────── */

const BlogSchema = z.object({
  titles: z.array(z.string()).min(1),
  intro: z.string(),
  sections: z.array(z.object({ room: z.string(), text: z.string() })),
  recommendations: z.array(z.string()),
  closing: z.string(),
  hashtags: z.array(z.string()),
});

export interface GeneratedBlog {
  titles: string[];
  intro: string;
  sections: { room: string; text: string }[];
  recommendations: string[];
  closing: string;
  hashtags: string[];
  error?: string;
}

export interface BlogGenInput {
  transactionType: string; // 매매/전세/월세/단기/임대
  info: Record<string, string>; // 매물 정보 (아파트명, 주소 등)
  features: string[]; // 선택한 추가 특징
  photoStrengths: string[]; // 사진 분석에서 나온 장점
  photoRooms: string[]; // 사진에서 파악된 공간들
  style: string; // 글 스타일
  length: string; // 짧게/보통/상세하게
}

const STYLE_GUIDE: Record<string, string> = {
  전문적인소장님: "20년 경력의 부동산 소장이 신뢰감 있게 설명하는 전문적인 어조. 근거 있는 표현, 절제된 문장.",
  친절한실장님: "친절하고 다정한 실장님이 손님에게 직접 안내하듯 따뜻하고 자연스러운 어조. 존댓말, 부드러운 표현.",
  고급아파트홍보: "고급 아파트를 품격 있게 소개하는 프리미엄 홍보 어조. 세련되고 감각적인 표현.",
  깔끔한정보형: "군더더기 없이 핵심 정보를 깔끔하게 전달하는 정보 중심 어조. 간결한 문장.",
  감성적인홍보형: "집에서의 생활을 상상하게 만드는 감성적이고 따뜻한 홍보 어조. 장면이 그려지는 묘사.",
};

const LENGTH_GUIDE: Record<string, string> = {
  짧게: "전체 본문은 짧고 핵심만. 공간 설명은 2~3곳만 간단히.",
  보통: "적당한 분량. 주요 공간 3~5곳을 자연스럽게 설명.",
  상세하게: "풍부하고 상세하게. 공간별 설명을 충분히, 생활 편의까지 폭넓게.",
};

export const generateRealEstateBlog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        transactionType: z.string().min(1),
        info: z.record(z.string(), z.string()),
        features: z.array(z.string()).default([]),
        photoStrengths: z.array(z.string()).default([]),
        photoRooms: z.array(z.string()).default([]),
        style: z.string().default("친절한실장님"),
        length: z.string().default("보통"),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<GeneratedBlog> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key)
      return emptyBlog("AI 키가 설정되지 않았습니다.");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway(TEXT_MODEL);

    const infoLines = Object.entries(data.info)
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");

    const styleGuide = STYLE_GUIDE[data.style] ?? STYLE_GUIDE["친절한실장님"];
    const lengthGuide = LENGTH_GUIDE[data.length] ?? LENGTH_GUIDE["보통"];

    const prompt = `당신은 네이버 블로그에 올릴 부동산 매물 홍보글을 쓰는 전문 카피라이터입니다.
부동산 실장이 직접 현장을 방문해 설명하는 느낌으로, 사람이 읽었을 때 "이 집 한번 직접 보고 싶다"는 마음이 들 정도로 자연스럽고 전문적으로 작성합니다.

[글 스타일]
${styleGuide}

[분량]
${lengthGuide}

[거래 유형]
${data.transactionType}

[매물 정보]
${infoLines || "(입력된 정보 없음)"}

[사용자가 고른 특징]
${data.features.length ? data.features.join(", ") : "(없음)"}

[AI 사진 분석 — 실제 사진에서 확인된 장점]
${data.photoStrengths.length ? data.photoStrengths.join(", ") : "(없음)"}

[사진에서 파악된 공간]
${data.photoRooms.length ? data.photoRooms.join(", ") : "(없음)"}

[작성 규칙]
1. titles: 매력적인 블로그 제목 3개. 지역명/아파트명/거래유형/핵심특징을 조합하고, 앞에 어울리는 이모지를 하나 붙여도 좋습니다.
2. intro: 고객의 관심을 끄는 자연스러운 소개 문단(2~4문장). 현장 첫인상 위주로.
3. sections: 사진에서 파악된 공간(거실/주방/안방 등)을 중심으로 공간별 설명. room 은 공간명, text 는 2~4문장 설명. 사진에서 확인된 장점을 근거로 작성합니다. 공간 정보가 없으면 매물 정보로 자연스럽게 구성합니다.
4. recommendations: "이런 분께 추천합니다" 형태의 항목 3~7개. 각 항목은 짧은 한 줄.
5. closing: 방문/문의를 자연스럽게 유도하는 마무리 문단. 담당자명과 연락처가 있으면 자연스럽게 녹입니다.
6. hashtags: 지역명+아파트명+거래유형+특징을 조합한 해시태그 10~20개. 각 항목은 # 로 시작하고 공백 없이.
7. 매우 중요 — 확인되지 않은 내용이나 과장된 허위광고 표현은 절대 쓰지 않습니다. 입력 정보와 사진 분석에서 확인된 사실만 사용합니다.
8. 모든 문장은 한국어 존댓말로 자연스럽게 작성합니다.

출력은 반드시 {"titles":[],"intro":"","sections":[{"room","text"}],"recommendations":[],"closing":"","hashtags":[]} 형태의 JSON 객체 하나입니다.`;

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: BlogSchema }),
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      });
      return normalizeBlog(output);
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        const text = error.text ?? "";
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start >= 0 && end > start) {
          try {
            const parsed = JSON.parse(text.slice(start, end + 1));
            return normalizeBlog(parsed);
          } catch {
            /* 복구 실패 */
          }
        }
        return emptyBlog("AI 작성 결과를 해석하지 못했습니다. 다시 시도해 주세요.");
      }
      const msg = error instanceof Error ? error.message : "AI 작성에 실패했습니다.";
      if (msg.includes("429")) return emptyBlog("요청이 많습니다. 잠시 후 다시 시도해 주세요.");
      if (msg.includes("402")) return emptyBlog("AI 사용 크레딧이 부족합니다.");
      return emptyBlog(msg);
    }
  });

function normalizeBlog(raw: unknown): GeneratedBlog {
  const r = raw as Partial<z.infer<typeof BlogSchema>>;
  const hashtags = [...new Set((r.hashtags ?? []).map((h) => String(h).trim()).filter(Boolean))].map((h) =>
    h.startsWith("#") ? h.replace(/\s+/g, "") : `#${h.replace(/\s+/g, "")}`,
  );
  return {
    titles: (r.titles ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 3),
    intro: String(r.intro ?? "").trim(),
    sections: (r.sections ?? [])
      .map((s) => ({ room: String(s?.room ?? "").trim(), text: String(s?.text ?? "").trim() }))
      .filter((s) => s.room || s.text),
    recommendations: (r.recommendations ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 7),
    closing: String(r.closing ?? "").trim(),
    hashtags: hashtags.slice(0, 20),
  };
}

function emptyBlog(error: string): GeneratedBlog {
  return { titles: [], intro: "", sections: [], recommendations: [], closing: "", hashtags: [], error };
}
