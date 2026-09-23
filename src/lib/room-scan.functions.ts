import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SCAN_BUCKET = "room-scans";
const ICON_BUCKET = "item-icons";

export interface ScanDetection {
  name: string;
  qty: number;
  /** 0~1 */
  confidence: number;
  /** 사진 기준 0~1000 정규화 좌표 */
  box: { x: number; y: number; w: number; h: number } | null;
}

const outputSchema = z.object({
  photo_ok: z.boolean(),
  photo_problem: z.string().nullable(),
  items: z.array(
    z.object({
      name: z.string(),
      qty: z.number(),
      confidence: z.number(),
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

    const prompt = `당신은 한국 이사 견적용 사진 분석가입니다. 이 사진은 "${row.room}" 공간입니다.
사진에 실제로 보이는 이삿짐(가구·가전·생활용품·박스)만 찾아 JSON으로 답하세요.
규칙:
- name은 한국어 품목명. 아래 기존 품목명 중 맞는 것이 있으면 반드시 그 이름을 그대로 씁니다.
- 기존 목록에 없는 물건이면 짧은 한국어 이름(2~10자)을 새로 붙입니다.
- qty는 사진에서 셀 수 있는 개수. 같은 물건을 두 번 세지 않습니다.
- confidence는 0~1. 확실히 보이면 0.9 이상, 일부만 보이거나 헷갈리면 낮게 줍니다. 추측으로 높게 주지 마세요.
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
        model: lovable.responses("openai/gpt-6-astra"),
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
          name: String(it.name || "").replace(/\s+/g, " ").trim().slice(0, 24),
          qty: Math.max(1, Math.min(30, Math.round(Number(it.qty) || 1))),
          confidence: Math.max(0, Math.min(1, Number(it.confidence) || 0)),
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
        .filter((it) => it.name.length >= 1);
      const needRetake = out?.photo_ok === false;
      const { error: saveErr } = await sb
        .from("room_scans")
        .update({
          status: needRetake ? "retake" : "done",
          error_message: needRetake ? out?.photo_problem || "사진을 다시 찍어 주세요." : null,
          result: JSON.parse(JSON.stringify({ room: row.room, items, model: "openai/gpt-6-astra" })),
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
