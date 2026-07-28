import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

/** AI가 선택할 수 있는 품목 ID (jimpick ITEM_CATALOG와 동일) */
const CATALOG = [
  ["bed", "침대"], ["wardrobe", "장롱"], ["sofa", "소파"], ["fridge", "냉장고"],
  ["washer", "세탁기"], ["tv", "TV"], ["table", "식탁"], ["chair", "의자"],
  ["desk", "책상"], ["shelf", "책장"], ["aircon", "에어컨"], ["microwave", "전자레인지"],
  ["waterpurifier", "정수기"], ["kimchi", "김치냉장고"], ["vanity", "화장대"], ["drawer", "서랍장"],
  ["dryer", "건조기"], ["airpurifier", "공기청정기"], ["riceCooker", "밥솥"], ["gasrange", "가스레인지"],
  ["dishrack", "식기건조대"], ["vacuum", "청소기"], ["drying", "빨래건조대"], ["toolbox", "공구함"],
  ["plant", "화분"], ["box", "이삿짐 박스"], ["bag", "잡화 가방"],
] as const;

const ResultSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      qty: z.number(),
      confidence: z.number(),
      note: z.string().nullable(),
    }),
  ),
  roomGuess: z.string().nullable(),
});

export interface DetectedItem {
  id: string;
  name: string;
  qty: number;
  confidence: number;
  note: string | null;
}

const SYSTEM = `당신은 한국 이사 견적 전문 AI 비전 분석가입니다.
사진(또는 동영상에서 추출된 여러 장면)을 보고 이사 대상 가구·가전을 식별합니다.

규칙:
1. 반드시 아래 품목 목록의 id만 사용합니다.
${CATALOG.map(([id, name]) => `- ${id}: ${name}`).join("\n")}
2. 여러 장면에서 같은 물건이 반복되면 중복으로 세지 말고 최대 수량 기준 1개로 합칩니다.
3. confidence는 0~1 실수. 물건 전체가 또렷하게 보이고 종류가 확실할 때만 0.9 이상을 부여합니다.
   일부만 보이거나 가려졌거나 유사 품목과 혼동될 수 있으면 0.9 미만으로 낮춥니다.
4. 벽지·바닥·조명·창문·사람 등 이사 대상이 아닌 것은 제외합니다.
5. note에는 크기/색상 등 견적에 도움이 되는 한 줄 메모(예: "4도어 양문형")를 넣고, 없으면 null.
6. roomGuess에는 안방/작은방/입구방/거실/부엌/베란다 중 하나 또는 null.`;

export const recognizeItems = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        images: z.array(z.string().min(20)).min(1).max(8),
        source: z.enum(["photo", "video"]).default("photo"),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ items: DetectedItem[]; roomGuess: string | null; error?: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { items: [], roomGuess: null, error: "AI 키가 설정되지 않았습니다." };

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3.1-pro-preview");

    const valid = new Map(CATALOG.map(([id, name]) => [id, name] as const));

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: ResultSchema }),
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  data.source === "video"
                    ? `동영상에서 추출한 ${data.images.length}개 장면입니다. 방 전체의 이사 품목을 정리해 주세요.`
                    : "이 사진 속 이사 품목을 정확히 인식해 주세요.",
              },
              ...data.images.map((img) => ({ type: "image" as const, image: img })),
            ],
          },
        ],
      });

      const merged = new Map<string, DetectedItem>();
      for (const it of output.items) {
        const name = valid.get(it.id as never);
        if (!name) continue;
        const qty = Math.max(1, Math.min(20, Math.round(it.qty || 1)));
        const conf = Math.max(0, Math.min(1, it.confidence ?? 0));
        const prev = merged.get(it.id);
        if (!prev || conf > prev.confidence) {
          merged.set(it.id, { id: it.id, name, qty: Math.max(qty, prev?.qty ?? 0), confidence: conf, note: it.note ?? null });
        } else {
          prev.qty = Math.max(prev.qty, qty);
        }
      }

      return {
        items: [...merged.values()].sort((a, b) => b.confidence - a.confidence),
        roomGuess: output.roomGuess ?? null,
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        return { items: [], roomGuess: null, error: "AI 분석 결과를 해석하지 못했습니다. 다시 시도해 주세요." };
      }
      const msg = error instanceof Error ? error.message : "AI 분석에 실패했습니다.";
      if (msg.includes("429")) return { items: [], roomGuess: null, error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." };
      if (msg.includes("402")) return { items: [], roomGuess: null, error: "AI 사용 크레딧이 부족합니다." };
      return { items: [], roomGuess: null, error: msg };
    }
  });
