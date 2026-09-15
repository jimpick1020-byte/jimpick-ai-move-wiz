import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveEntitlement } from "@/lib/entitlement.functions";

/** 한 업체가 하루에 만들 수 있는 3D 아이콘 개수 (비용 폭주 방지) */
export const ICON_DAILY_LIMIT = 20;

const BUCKET = "item-icons";

/** 품목명 정리 — 앞뒤 공백 제거, 공백 하나로, 길이 제한 */
export function cleanItemName(raw: string): string {
  return (raw || "").replace(/\s+/g, " ").trim().slice(0, 24);
}

/** 검색용 정규화 이름 (공백·기호 제거, 소문자) */
export function normItemName(raw: string): string {
  return cleanItemName(raw).toLowerCase().replace(/[\s·・.,()[\]{}/\\-]/g, "");
}

/** 품목명으로 쓸 수 있는 글자만 허용합니다 (악성 입력·명령문 차단) */
const NAME_OK = /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ·()+\-']{1,24}$/;

/** 이미지 생성에 쓰면 안 되는 말 */
const BLOCKED = [
  "사람", "인물", "얼굴", "여자", "남자", "아이", "누드", "나체", "성인", "야한", "섹",
  "총", "칼로", "폭탄", "마약", "혈액", "시체", "브랜드", "로고", "상표",
  "prompt", "ignore", "system", "http", "www", "<", ">",
];

export interface IconResult {
  ok: boolean;
  error?: string;
  /** 이미 만들어 둔 아이콘을 다시 쓴 경우 */
  reused?: boolean;
  itemId?: string;
  name?: string;
  cat?: string;
  room?: string;
  /** 화면에서 쓰는 아이콘 주소 */
  iconUrl?: string;
  /** 오늘 남은 생성 횟수 */
  remaining?: number;
}

const inputSchema = z.object({
  name: z.string().min(1).max(40),
  cat: z.string().min(1).max(20),
  room: z.string().min(1).max(20),
});

/** 같은 업체가 이미 만든 아이콘이 있으면 찾아 줍니다 (중복 생성 방지) */
export const findItemIcon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: z.string().min(1).max(40) }).parse(input))
  .handler(async ({ data, context }): Promise<IconResult> => {
    const norm = normItemName(data.name);
    if (!norm) return { ok: false, error: "품목명을 입력해 주세요." };
    const { data: row, error } = await context.supabase
      .from("item_icons")
      .select("item_id, name, cat, room, image_url, status")
      .eq("user_id", context.userId)
      .eq("norm_name", norm)
      .eq("active", true)
      .eq("status", "ready")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!row?.image_url) return { ok: false };
    return {
      ok: true,
      reused: true,
      itemId: row.item_id,
      name: row.name,
      cat: row.cat,
      room: row.room ?? undefined,
      iconUrl: row.image_url,
    };
  });

/** 검색 결과에 없는 품목의 3D 아이콘을 실제로 생성합니다 (서버에서만 AI 호출) */
export const generateItemIcon = createServerFn({ method: "POST" })
  .middleware([requireActiveEntitlement])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<IconResult> => {
    const name = cleanItemName(data.name);
    const norm = normItemName(name);
    if (!name || !norm) return { ok: false, error: "품목명을 입력해 주세요." };
    if (name.length < 2) return { ok: false, error: "품목명을 2글자 이상 입력해 주세요." };
    if (!NAME_OK.test(name))
      return { ok: false, error: "품목명에 쓸 수 없는 문자가 있습니다. 한글·영문·숫자만 사용해 주세요." };
    const low = name.toLowerCase();
    if (BLOCKED.some((w) => low.includes(w)))
      return { ok: false, error: "이 품목명으로는 아이콘을 만들 수 없습니다. 이삿짐 품목 이름으로 바꿔 주세요." };

    // ① 이미 만들어 둔 아이콘이 있으면 그대로 씁니다
    const existing = await context.supabase
      .from("item_icons")
      .select("item_id, name, cat, room, image_url")
      .eq("user_id", context.userId)
      .eq("norm_name", norm)
      .eq("active", true)
      .eq("status", "ready")
      .maybeSingle();
    if (existing.data?.image_url) {
      return {
        ok: true,
        reused: true,
        itemId: existing.data.item_id,
        name: existing.data.name,
        cat: existing.data.cat,
        room: data.room,
        iconUrl: existing.data.image_url,
      };
    }

    // ② 하루 생성 횟수 제한
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const counted = await context.supabase
      .from("item_icons")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", since);
    const used = counted.count ?? 0;
    if (used >= ICON_DAILY_LIMIT)
      return {
        ok: false,
        error: `아이콘 생성은 하루 ${ICON_DAILY_LIMIT}개까지 가능합니다. 내일 다시 시도해 주세요.`,
        remaining: 0,
      };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "이미지 생성 키가 설정되지 않았습니다." };

    const prompt = [
      `A single 3D rendered app icon of one Korean household moving item: "${name}".`,
      "Style: soft glossy 3D render, white and light-grey body with small blue (#2A6FD6) accents,",
      "isometric three-quarter view, centered, one object only, plain pure white background,",
      "clean silhouette that stays readable at 40px, soft shadow.",
      "No text, no letters, no logo, no watermark, no border, no frame, no people, no extra objects.",
    ].join(" ");

    // ③ 생성 기록을 먼저 남깁니다 (실패해도 원인이 남습니다)
    const itemId = `ci_ai_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const inserted = await context.supabase
      .from("item_icons")
      .insert({
        user_id: context.userId,
        created_by: context.userId,
        item_id: itemId,
        name,
        norm_name: norm,
        cat: data.cat,
        room: data.room,
        status: "pending",
        prompt,
        active: true,
      })
      .select("id")
      .single();
    if (inserted.error) {
      if (inserted.error.code === "23505" || inserted.error.message.includes("duplicate"))
        return { ok: false, error: "이미 같은 품목명의 아이콘을 만들고 있습니다. 잠시 후 다시 확인해 주세요." };
      return { ok: false, error: inserted.error.message };
    }
    const rowId = inserted.data.id as string;

    const fail = async (message: string): Promise<IconResult> => {
      await context.supabase
        .from("item_icons")
        .update({ status: "failed", active: false })
        .eq("id", rowId);
      return { ok: false, error: message, remaining: Math.max(0, ICON_DAILY_LIMIT - used - 1) };
    };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-image-2",
          prompt,
          size: "1024x1024",
          quality: "medium",
          n: 1,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 429) return fail("요청이 많습니다. 잠시 후 다시 시도해 주세요.");
        if (res.status === 402) return fail("AI 사용 크레딧이 부족합니다.");
        if (res.status === 403) return fail("AI 사용이 차단되어 있습니다. 관리자에게 문의해 주세요.");
        return fail(`이미지 생성 실패 (${res.status}) ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        data?: { b64_json?: string }[];
        error?: { message?: string };
      };
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) return fail(json.error?.message || "이미지를 받지 못했습니다. 다시 시도해 주세요.");

      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const path = `${context.userId}/${rowId}.png`;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const up = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "image/png", upsert: true });
      if (up.error) return fail(`이미지 저장 실패: ${up.error.message}`);

      const iconUrl = `/api/public/item-icon/${rowId}.png`;
      const done = await context.supabase
        .from("item_icons")
        .update({ status: "ready", image_path: path, image_url: iconUrl })
        .eq("id", rowId);
      if (done.error) return fail(`아이콘 등록 실패: ${done.error.message}`);

      return {
        ok: true,
        itemId,
        name,
        cat: data.cat,
        room: data.room,
        iconUrl,
        remaining: Math.max(0, ICON_DAILY_LIMIT - used - 1),
      };
    } catch (e) {
      return fail(e instanceof Error ? e.message : "이미지 생성 중 오류가 발생했습니다.");
    }
  });
