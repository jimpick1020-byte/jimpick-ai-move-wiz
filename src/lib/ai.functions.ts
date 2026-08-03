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
  ["plant", "화분"], ["box", "이삿짐 박스"], ["clothbox", "옷박스"], ["bigbox", "대박스"],
  ["midbox", "중박스"], ["basket", "바구니"], ["bag", "잡화 가방"], ["vinyl", "비닐 포장"],
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
  roomConfidence: z.number().nullable(),
  packingEstimate: z
    .object({
      clothesBox: z.number(),
      largeBox: z.number(),
      mediumBox: z.number(),
      basket: z.number(),
      vinyl: z.number(),
    })
    .nullable(),
});

export interface PackingEstimate {
  clothesBox: number;
  largeBox: number;
  mediumBox: number;
  basket: number;
  vinyl: number;
}

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
6. roomGuess에는 안방/작은방/입구방/거실/부엌/베란다/기타 공간 중 하나 또는 null,
   roomConfidence에는 공간 인식 확신도(0~1 실수)를 넣습니다.
7. 수납공간 환산 규칙 — 옷장/붙박이장/주방 상·하부장/팬트리 내부가 보이면 가구 자체 대신
   내용물을 포장 박스 수량으로 환산합니다.
   - 옷·이불이 걸리거나 쌓여 있으면 clothbox(옷박스): 옷장 한 칸(폭 약 60cm) 가득 = 옷박스 2개,
     선반에 접어둔 옷 한 단 = 옷박스 1개.
   - 이불·베개·큰 잡화는 bigbox(대박스): 이불 2~3채 = 대박스 1개.
   - 책·소형 잡화·서랍 내용물은 midbox(중박스): 서랍 2칸 = 중박스 1개.
   - 주방 상·하부장, 팬트리 내용물(그릇·냄비·식료품)은 basket(바구니) 중심으로 환산합니다.
     상·하부장 한 칸 = 바구니 1개, 팬트리 한 단 = 바구니 1개.
   환산 품목의 note에는 근거를 적습니다(예: "붙박이장 3칸 환산").
10. packingEstimate에는 포장 단위 예상 수량(clothesBox, largeBox, mediumBox, basket, vinyl)을 정수로 넣습니다.
    이불·매트리스·소파처럼 비닐로 감싸는 품목 수는 vinyl로 셉니다.
9. 출력은 반드시 {"items":[{"id","name","qty","confidence","note"}],"roomGuess","roomConfidence","packingEstimate"} 형태의 JSON 객체 하나입니다.
   배열만 반환하거나 quantity 등 다른 키를 쓰지 마세요.
8. 환산 품목의 confidence는 내부가 또렷하게 보일 때 0.9 이상, 일부만 보이면 그 이하로 낮춥니다.`;


export const recognizeItems = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        images: z.array(z.string().min(20)).min(1).max(8),
        source: z.enum(["photo", "video"]).default("photo"),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      items: DetectedItem[];
      roomGuess: string | null;
      roomConfidence: number | null;
      packingEstimate: PackingEstimate | null;
      error?: string;
    }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key)
      return { items: [], roomGuess: null, roomConfidence: null, packingEstimate: null, error: "AI 키가 설정되지 않았습니다." };

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3.6-flash");

    const valid = new Map(CATALOG.map(([id, name]) => [id, name] as const));

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: ResultSchema }),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: SYSTEM },

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

      const normalize = (raw: z.infer<typeof ResultSchema>) => {
        const merged = new Map<string, DetectedItem>();
        for (const it of raw.items ?? []) {
          const name = valid.get(it.id as never);
          if (!name) continue;
          const qty = Math.max(1, Math.min(20, Math.round(it.qty || 1)));
          const conf = Math.max(0, Math.min(1, it.confidence ?? 0));
          const prev = merged.get(it.id);
          if (!prev || conf > prev.confidence) {
            merged.set(it.id, {
              id: it.id,
              name,
              qty: Math.max(qty, prev?.qty ?? 0),
              confidence: conf,
              note: it.note ?? null,
            });
          } else {
            prev.qty = Math.max(prev.qty, qty);
          }
        }
        return {
          items: [...merged.values()].sort((a, b) => b.confidence - a.confidence),
          roomGuess: raw.roomGuess ?? null,
          roomConfidence: raw.roomConfidence ?? null,
          packingEstimate: raw.packingEstimate ?? null,
        };
      };

      return normalize(output);
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        // 모델이 코드블록/여분 텍스트를 붙인 경우 직접 JSON을 추출해 복구합니다.
        const text = error.text ?? "";
        const objStart = text.indexOf("{");
        const arrStart = text.indexOf("[");
        const useArray = arrStart >= 0 && (objStart < 0 || arrStart < objStart);
        const start = useArray ? arrStart : objStart;
        const end = useArray ? text.lastIndexOf("]") : text.lastIndexOf("}");
        if (start >= 0 && end > start) {
          try {
            const parsed = JSON.parse(text.slice(start, end + 1));
            const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
            const merged = new Map<string, DetectedItem>();
            let room: string | null =
              typeof parsed?.roomGuess === "string" ? parsed.roomGuess : null;
            for (const it of items) {
              const name = valid.get(String(it?.id) as never);
              if (!name) continue;
              if (!room && typeof it?.roomGuess === "string") room = it.roomGuess;
              const qty = Math.max(1, Math.min(20, Math.round(Number(it.qty ?? it.quantity) || 1)));
              const conf = Math.max(0, Math.min(1, Number(it.confidence) || 0));
              const prev = merged.get(it.id);
              if (!prev || conf > prev.confidence) {
                merged.set(it.id, {
                  id: it.id,
                  name,
                  qty: Math.max(qty, prev?.qty ?? 0),
                  confidence: conf,
                  note: typeof it.note === "string" ? it.note : null,
                });
              } else {
                prev.qty = Math.max(prev.qty, qty);
              }
            }
            if (merged.size > 0) {
              return {
                items: [...merged.values()].sort((a, b) => b.confidence - a.confidence),
                roomGuess: room,
                roomConfidence:
                  typeof parsed?.roomConfidence === "number" ? parsed.roomConfidence : null,
                packingEstimate: null,
              };
            }
          } catch {
            /* 복구 실패 시 아래 오류 메시지로 진행 */
          }
        }
        return { items: [], roomGuess: null, roomConfidence: null, packingEstimate: null, error: "AI 분석 결과를 해석하지 못했습니다. 다시 시도해 주세요." };

      }
      const msg = error instanceof Error ? error.message : "AI 분석에 실패했습니다.";
      const base = { items: [] as DetectedItem[], roomGuess: null, roomConfidence: null, packingEstimate: null };
      if (msg.includes("429")) return { ...base, error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." };
      if (msg.includes("402")) return { ...base, error: "AI 사용 크레딧이 부족합니다." };
      return { ...base, error: msg };
    }
  },
);


export interface VoiceItem {
  id: string;
  name: string;
  qty: number;
}

/** 음성 문장을 AI가 해석해 방과 품목을 뽑아냅니다 ("추가" 같은 명령어가 없어도 동작) */
export const parseVoiceOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        text: z.string().min(1).max(500),
        rooms: z.array(z.string()).max(30).default([]),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{ room: string | null; items: VoiceItem[]; error?: string }> => {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) return { room: null, items: [], error: "AI 키가 설정되지 않았습니다." };

      const schema = z.object({
        room: z.string().nullable(),
        items: z.array(z.object({ id: z.string(), qty: z.number() })),
      });
      const valid = new Map(CATALOG.map(([id, name]) => [id, name] as const));
      const gateway = createLovableAiGatewayProvider(key);

      const prompt = `당신은 한국 이사 견적 앱의 음성 비서입니다.
사장님이 말한 문장에서 "어느 방"에 "어떤 품목 몇 개"를 담으려는지 해석합니다.

규칙:
1. items의 id는 반드시 아래 목록에서만 고릅니다.
${CATALOG.map(([id, name]) => `- ${id}: ${name}`).join("\n")}
2. "추가", "넣어줘" 같은 명령어가 없어도 품목이 언급되면 담으려는 뜻으로 해석합니다.
3. 수량이 없으면 1로 봅니다. "하나/두개/세개" 같은 한국어 수량도 숫자로 바꿉니다.
4. room에는 다음 방 이름 중 하나를 넣고, 언급이 없으면 null 입니다: ${data.rooms.join(", ") || "없음"}.
5. 목록에 없는 물건은 무시합니다.

문장: "${data.text}"`;

      try {
        const { output } = await generateText({
          model: gateway("google/gemini-3.6-flash"),
          output: Output.object({ schema }),
          messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        });
        const items: VoiceItem[] = [];
        for (const it of output.items ?? []) {
          const name = valid.get(it.id as never);
          if (!name) continue;
          items.push({ id: it.id, name, qty: Math.max(1, Math.min(20, Math.round(it.qty || 1))) });
        }
        const room =
          output.room && data.rooms.includes(output.room) ? output.room : null;
        return { room, items };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "AI 해석에 실패했습니다.";
        return { room: null, items: [], error: msg };
      }
    },
  );
