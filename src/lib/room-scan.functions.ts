import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SCAN_BUCKET = "room-scans";
const ICON_BUCKET = "item-icons";

export interface ScanDetection {
  name: string;
  qty: number;
  /** 0~1, 모델이 주지 않으면 null */
  confidence: number | null;
  /** 사진 기준 0~1000 정규화 좌표 */
  box: { x: number; y: number; w: number; h: number } | null;
}

const LARGE_RE = /냉장고|김치|세탁기|건조기|tv|티비|텔레비|모니터|에어컨|스타일러|침대|매트리스|장롱|옷장|붙박이|소파|쇼파|식탁|책상|책장|진열장|장식장|서랍장|화장대|거실장|수납장|안마의자|세라젬|피아노|캣타워|워시타워|냉동고|와인셀러/i;
const SMALL_RE = /컵|그릇|냄비|식기|책$|^책|옷$|신발|가방|화분|액자|장난감|장식|박스|상자|벽|바닥|창문|^문$|사람|강아지|고양이|반려/;

const MODEL_ID = "openai/gpt-6-astra";
/** 분석 규칙이 바뀌면 올려서 예전 결과를 재사용하지 않게 합니다 */
const RULES_VERSION = "scan-v3";

/** 품목명 동의어 → 최종 그룹명. 방 이름과 무관하게 이름만으로 정합니다. */
const GROUP_RULES: Array<[RegExp, string]> = [
  [/(\d+\s*단\s*)?서랍장|수납장|체스트/, "서랍장"],
  [/거실장|tv\s*장|티비\s*장|tv\s*선반|tv\s*스탠드/i, "거실장"],
  [/쇼파|소파/, "소파"],
  [/티비|텔레비|^tv$/i, "TV"],
  [/장농|장롱/, "장롱"],
];
export function groupItemName(name: string): string {
  const n = name.replace(/\s+/g, " ").trim();
  for (const [re, g] of GROUP_RULES) if (re.test(n)) return g;
  return n;
}

const outputSchema = z.object({
  photo_ok: z.boolean(),
  photo_problem: z.string().nullable(),
  items: z.array(
    z.object({
      name: z.string(),
      qty: z.number(),
      confidence: z.number().nullable(),
      box: z
        .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
        .nullable(),
    }),
  ),
});

/**
 * 촬영 기록 한 건을 서버 AI로 분석합니다.
 * 결과(품목명·수량·신뢰도·위치·방 이름)는 room_scans 에 저장되어 새로고침 후에도 남습니다.
 * 실패해도 사진과 기록은 지우지 않고 failed 로 남겨 다시 시도할 수 있게 합니다.
 */
export const analyzeRoomScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        scanId: z.string().uuid(),
        knownNames: z.array(z.string().max(30)).max(600),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const sb = context.supabase;
    const { data: row, error } = await sb
      .from("room_scans")
      .select("id, room, photo_path, attempts, status")
      .eq("id", data.scanId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !row) return { ok: false, error: "촬영 기록을 찾지 못했습니다." };

    const fail = async (message: string) => {
      await sb
        .from("room_scans")
        .update({ status: "failed", error_message: message })
        .eq("id", row.id);
      return { ok: false, error: message };
    };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return fail("AI 분석 설정(키)이 없어 분석하지 못했습니다.");

    await sb
      .from("room_scans")
      .update({ status: "analyzing", error_message: null, attempts: (row.attempts ?? 0) + 1 })
      .eq("id", row.id);

    const file = await sb.storage.from(SCAN_BUCKET).download(row.photo_path);
    if (file.error || !file.data) return fail("저장된 사진을 읽지 못했습니다. 다시 시도해 주세요.");
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");

    // 같은 업체의 같은 사진(바이트 동일)·같은 모델·같은 규칙이면 예전 결과를 그대로 씁니다
    const prev = await sb
      .from("room_scans")
      .select("id, result")
      .eq("user_id", context.userId)
      .eq("status", "done")
      .eq("result->>sha256", sha256)
      .eq("result->>model", MODEL_ID)
      .eq("result->>rules", RULES_VERSION)
      .neq("id", row.id)
      .limit(1)
      .maybeSingle();
    if (prev.data?.result) {
      const r = prev.data.result as Record<string, unknown>;
      const { error: e2 } = await sb
        .from("room_scans")
        .update({
          status: "done",
          error_message: null,
          result: JSON.parse(JSON.stringify({ ...r, room: row.room, reused_from: prev.data.id })),
          analyzed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (e2) return fail(`분석 결과 저장 실패: ${e2.message}`);
      return { ok: true };
    }

    const prompt = `당신은 한국 이사 견적용 사진 분석가입니다. 
방 이름은 참고하지 말고, 사진에 보이는 물건의 모양만 보고 판단하세요. (예: 서랍이 여러 단 있는 가구는 방과 관계없이 "서랍장", TV를 올려두는 낮고 긴 가구만 "거실장")
사진에 실제로 보이는 "대형 가전"과 "대형 가구"만 찾아 JSON으로 답하세요.
대상: 냉장고, 김치냉장고, 세탁기, 건조기, TV, 대형 모니터, 에어컨, 스타일러, 침대, 돌침대, 흙침대, 매트리스, 장롱, 옷장, 붙박이장, 소파, 식탁, 대형 책상, 책장, 진열장, 서랍장, 화장대, TV장, 거실장, 안마의자, 세라젬, 피아노, 캣타워, 대형 수납장.
제외(절대 넣지 말 것): 컵·그릇·냄비·식기, 책·옷·신발·가방, 화분·액자·장난감, 소형 생활용품·장식품, 박스와 박스 안 물건, 벽·바닥·창문·문, 사람·반려동물.
확실하지 않으면 넣지 말고, 대형 품목이 없으면 items를 빈 배열로 답하세요. 보이지 않는 물건을 지어내지 마세요.
규칙:
- name은 한국어 품목명. 아래 기존 품목명 중 맞는 것이 있으면 반드시 그 이름을 그대로 씁니다.
- 기존 목록에 없는 물건이면 짧은 한국어 이름(2~10자)을 새로 붙입니다.
- qty는 사진에서 셀 수 있는 개수. 같은 물건을 두 번 세지 않습니다.
- confidence는 0~1 사이 본인의 실제 확신도. 확실히 보이면 0.9 이상, 일부만 보이거나 헷갈리면 낮게 줍니다. 추측으로 높게 주지 말고 모르면 null.
- box는 해당 물건 영역 [x,y,w,h] (사진 가로·세로를 각각 1000으로 본 정수). 모르면 null.
- 벽, 바닥, 문, 창문, 조명 스위치, 붙박이 설비, 사람은 제외합니다.
- 사진이 너무 어둡거나 흔들려서 판단이 어렵다면 photo_ok=false, photo_problem에 이유를 한국어로 적습니다.
기존 품목명: ${data.knownNames.join(", ")}`;

    try {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const { streamText, Output } = await import("ai");
      const lovable = createOpenAI({
        baseURL: "https://ai.gateway.lovable.dev/v1",
        apiKey: key,
        headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      });
      const result = streamText({
        model: lovable.responses(MODEL_ID),
        output: Output.object({ schema: outputSchema }),
        maxRetries: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image", image: bytes, mediaType: "image/jpeg" },
            ],
          },
        ],
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const out = await result.output;
      const items: ScanDetection[] = (out?.items ?? [])
        .map((it) => ({
          name: groupItemName(String(it.name || "")).slice(0, 24),
          qty: Math.max(1, Math.min(30, Math.round(Number(it.qty) || 1))),
          // 모델이 신뢰도를 주지 않으면 null 로 두고 화면에서 "확인 필요"로 처리합니다
          confidence: typeof it.confidence === "number" && Number.isFinite(it.confidence) ? Math.max(0, Math.min(1, it.confidence)) : null,
          box:
            it.box &&
            [it.box.x, it.box.y, it.box.w, it.box.h].every((n) => Number.isFinite(n)) &&
            it.box.w > 0 &&
            it.box.h > 0
              ? {
                  x: Math.max(0, Math.min(1000, Math.round(it.box.x))),
                  y: Math.max(0, Math.min(1000, Math.round(it.box.y))),
                  w: Math.max(1, Math.min(1000, Math.round(it.box.w))),
                  h: Math.max(1, Math.min(1000, Math.round(it.box.h))),
                }
              : null,
        }))
        .filter((it) => it.name.length >= 1)
        // 사진 면적 3% 미만과 소형 물품은 버립니다 (신뢰도 구분은 화면에서 실제 값으로 합니다)
        .filter((it) => !it.box || it.box.w * it.box.h >= 30_000)
        .filter((it) => !SMALL_RE.test(it.name) || LARGE_RE.test(it.name))
        .filter((it) => LARGE_RE.test(it.name))
        // 같은 이름으로 여러 번 잡힌 물체는 한 번만 남기고 개수는 가장 큰 값만 씁니다
        .reduce<ScanDetection[]>((acc, it) => {
          const key = it.name.replace(/\s/g, "");
          const same = acc.find((a) => a.name.replace(/\s/g, "") === key);
          if (!same) acc.push(it);
          else {
            same.qty = Math.max(same.qty, it.qty);
            same.confidence = same.confidence == null || it.confidence == null ? (same.confidence ?? it.confidence) : Math.max(same.confidence, it.confidence);
          }
          return acc;
        }, []);
      const needRetake = out?.photo_ok === false;
      const { error: saveErr } = await sb
        .from("room_scans")
        .update({
          status: needRetake ? "retake" : "done",
          error_message: needRetake ? out?.photo_problem || "사진을 다시 찍어 주세요." : null,
          result: JSON.parse(JSON.stringify({ room: row.room, items, model: MODEL_ID, rules: RULES_VERSION, sha256 })),
          analyzed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (saveErr) return fail(`분석 결과 저장 실패: ${saveErr.message}`);
      return { ok: true };
    } catch (e) {
      console.error("[analyzeRoomScan]", e);
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("402")) return fail("AI 사용 크레딧이 부족해 분석하지 못했습니다.");
      if (msg.includes("429")) return fail("요청이 많아 분석하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      if (msg.includes("403")) return fail("AI 사용 권한이 없어 분석하지 못했습니다.");
      return fail("분석 중 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  });

/**
 * 목록에 없는 품목을 촬영 사진에서 잘라낸 실제 이미지로 업체 품목에 등록합니다.
 * (가짜 3D 그림을 만들지 않습니다)
 */
export const saveCroppedItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(2).max(24),
        cat: z.string().min(1).max(20),
        room: z.string().min(1).max(30),
        image: z.string().startsWith("data:image/jpeg;base64,").max(900_000),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: boolean; error?: string; itemId?: string; name?: string; iconUrl?: string; reused?: boolean }> => {
      const { cleanItemName, normItemName } = await import("@/lib/item-icon.functions");
      const name = cleanItemName(data.name);
      const norm = normItemName(name);
      if (!/^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ·()+\-']{2,24}$/.test(name))
        return { ok: false, error: "품목명은 한글·영문·숫자 2~24자로 입력해 주세요." };
      const sb = context.supabase;
      const existing = await sb
        .from("item_icons")
        .select("id, item_id, display_name")
        .eq("user_id", context.userId)
        .eq("normalized_name", norm)
        .eq("active", true)
        .eq("status", "ready")
        .maybeSingle();
      if (existing.data?.id)
        return {
          ok: true,
          reused: true,
          itemId: existing.data.item_id as string,
          name: (existing.data.display_name as string) || name,
          iconUrl: `/api/public/item-icon/${existing.data.id}.png`,
        };
      const itemId = `ci_ph_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const ins = await sb
        .from("item_icons")
        .insert({
          user_id: context.userId,
          created_by: context.userId,
          item_id: itemId,
          name,
          norm_name: norm,
          cat: data.cat,
          display_name: name,
          normalized_name: norm,
          category_group: data.cat,
          size_label: "중형",
          room: data.room,
          status: "pending",
          original_name: name,
          requested_name: name,
          is_generated: false,
          sort_order: -Math.floor(Date.now() / 1000),
          source: "company",
          default_volume: 0.5,
          from_photo: true,
          metadata: { display_name: name, room: data.room, origin: "photo_crop" },
          active: true,
        })
        .select("id")
        .single();
      if (ins.error) return { ok: false, error: ins.error.message };
      const rowId = ins.data.id as string;
      const b64 = data.image.slice("data:image/jpeg;base64,".length);
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const path = `${context.userId}/${rowId}.jpg`;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const up = await supabaseAdmin.storage
        .from(ICON_BUCKET)
        .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
      if (up.error) {
        await sb.from("item_icons").update({ status: "failed", active: false }).eq("id", rowId);
        return { ok: false, error: `이미지 저장 실패: ${up.error.message}` };
      }
      const iconUrl = `/api/public/item-icon/${rowId}.png`;
      const done = await sb
        .from("item_icons")
        .update({ status: "ready", image_path: path, storage_path: path, image_url: iconUrl })
        .eq("id", rowId);
      if (done.error) return { ok: false, error: done.error.message };
      return { ok: true, itemId, name, iconUrl };
    },
  );
