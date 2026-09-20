/**
 * 사진 품목 인식 (실제 AI) — 물체별 외곽 마스크까지 받아옵니다.
 *
 *  - Gemini 비전 모델에게 물체마다 위치(box)와 외곽 마스크(mask PNG)를 요청합니다.
 *  - 마스크를 주지 못한 물체는 위치만 씁니다 (가짜 결과를 만들지 않습니다).
 *  - 벽·바닥·창문·천장 같은 배경은 제외합니다.
 *  - AI 키는 서버에서만 읽습니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireActiveEntitlement } from "@/lib/entitlement.functions";
import { assertExperimentalFeature } from "@/lib/experimental-features.functions";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export interface SegmentedObject {
  /** 이 사진 안에서의 물체 번호 (중복 합치기에 씁니다) */
  trackingId: string;
  /** 한글 품목명 (영문 모델 이름을 그대로 쓰지 않습니다) */
  label: string;
  /** 모델이 쓴 원래 명칭 (기록·연결용) */
  rawLabel: string;
  confidence: number;
  /** 0~1 로 정규화된 화면 좌표 */
  box: { x0: number; y0: number; x1: number; y1: number };
  /** box 영역을 덮는 흑백 마스크 PNG (data URL). 없으면 위치만 씁니다 */
  mask?: string;
}

const RawSchema = z.object({
  label_ko: z.string().min(1).max(30),
  label_en: z.string().max(40).optional().nullable(),
  confidence: z.number().optional().nullable(),
  box_2d: z.array(z.number()).length(4),
  mask: z.string().optional().nullable(),
});

const PROMPT = `You analyse a photo of a Korean home for a moving-company estimate.

Find every piece of FURNITURE, HOME APPLIANCE, plant pot and pet furniture that a moving crew
would have to carry. For EACH object instance (count two identical plants as two objects) return:
- "label_ko": the Korean item name (예: 소파(2인), TV장·거실장, 캣타워, 화분, 냉장고, 세탁기, 식탁, 침대)
- "label_en": the English name
- "confidence": 0..1 how sure you are of the item type
- "box_2d": [ymin, xmin, ymax, xmax] normalised to 0-1000
- "mask": a base64 PNG segmentation mask (probability/binary mask) covering exactly that box region,
  as a data URL string, following the real outline of the object.

Rules:
- Never return walls, floor, ceiling, windows, curtains-on-wall, doors, lights on the ceiling, people, or empty space.
- Do not merge separate objects into one box. A TV and the TV stand under it are two objects.
- Output ONLY a JSON array, no prose, no code fences:
  [{"label_ko":"소파(2인)","label_en":"two seater sofa","confidence":0.92,"box_2d":[520,10,780,390],"mask":"data:image/png;base64,..."}]`;

function extractArray(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 마스크 문자열을 data URL 로 정리합니다 (순수 base64 만 오는 경우 대비) */
function normalizeMask(raw?: string | null): string | undefined {
  const v = (raw ?? "").trim();
  if (!v || v.length < 80) return undefined;
  if (v.startsWith("data:image/")) return v;
  if (/^[A-Za-z0-9+/=\s]+$/.test(v)) return `data:image/png;base64,${v.replace(/\s+/g, "")}`;
  return undefined;
}

export const segmentPhotoItems = createServerFn({ method: "POST" })
  .middleware([requireActiveEntitlement])
  .inputValidator((d: unknown) =>
    z
      .object({
        /** 분석용 사진 (data URL) */
        image: z.string().min(64).max(9_000_000),
        /** 촬영 후 정밀 분석이면 true — 놓친 작은 가구·가전까지 다시 찾습니다 */
        fine: z.boolean().optional(),
        /** 1차에서 이미 찾은 품목 이름 (정밀 분석에서 빠진 물건만 찾게 합니다) */
        known: z.array(z.string().max(30)).max(40).optional(),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ objects: SegmentedObject[]; error?: string }> => {
      await assertExperimentalFeature(context.userId, "ai_photo_scan");
      const key = process.env["LOVABLE_API_KEY"];
      if (!key) return { objects: [], error: "AI 키가 설정되지 않았습니다." };

      const gateway = createLovableAiGatewayProvider(key);
      const extra = data.fine
        ? `\nThis is the high-resolution second pass. Look again carefully for objects that are partly hidden,
small appliances on the floor, and items at the edges of the photo.${
            data.known?.length ? ` Already found: ${data.known.join(", ")}. Include them again only if clearly visible.` : ""
          }`
        : "";

      try {
        const { text } = await generateText({
          model: gateway(data.fine ? "google/gemini-3.8-flash" : "google/gemini-3.6-flash"),
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: PROMPT + extra },
                { type: "image", image: data.image },
              ],
            },
          ],
        });

        const objects: SegmentedObject[] = [];
        for (const [index, row] of extractArray(text).entries()) {
          const parsed = RawSchema.safeParse(row);
          if (!parsed.success) continue;
          const [ymin, xmin, ymax, xmax] = parsed.data.box_2d;
          const y0 = Math.min(ymin, ymax) / 1000;
          const y1 = Math.max(ymin, ymax) / 1000;
          const x0 = Math.min(xmin, xmax) / 1000;
          const x1 = Math.max(xmin, xmax) / 1000;
          if (!(x1 > x0 && y1 > y0)) continue;
          // 화면 대부분을 덮는 상자는 배경(벽·바닥)일 가능성이 큽니다
          if ((x1 - x0) * (y1 - y0) > 0.92) continue;
          objects.push({
            trackingId: `${data.fine ? "f" : "c"}${index}`,
            label: parsed.data.label_ko.trim(),
            rawLabel: (parsed.data.label_en ?? parsed.data.label_ko).trim(),
            confidence: Math.max(0, Math.min(1, parsed.data.confidence ?? 0.6)),
            box: {
              x0: Math.max(0, Math.min(1, x0)),
              y0: Math.max(0, Math.min(1, y0)),
              x1: Math.max(0, Math.min(1, x1)),
              y1: Math.max(0, Math.min(1, y1)),
            },
            mask: normalizeMask(parsed.data.mask),
          });
        }
        if (objects.length === 0)
          return { objects: [], error: "사진에서 가구·가전을 찾지 못했습니다. 더 밝고 가까이서 다시 찍어주세요." };
        return { objects };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("429")) return { objects: [], error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." };
        if (msg.includes("402")) return { objects: [], error: "AI 사용 크레딧이 부족합니다." };
        return { objects: [], error: "사진을 분석하지 못했습니다. 다시 시도해 주세요." };
      }
    },
  );
