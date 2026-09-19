import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveEntitlement } from "@/lib/entitlement.functions";
import { itemSubgroup } from "@/lib/item-groups";
import { kindOf, guessKind } from "@/lib/item-kinds";

/** 한 업체가 하루에 만들 수 있는 3D 아이콘 개수 (비용 폭주 방지) */
export const ICON_DAILY_LIMIT = 20;

const BUCKET = "item-icons";

/** 품목명 정리 — 앞뒤 공백 제거, 공백 하나로, 길이 제한 */
export function cleanItemName(raw: string): string {
  return (raw || "").replace(/\s+/g, " ").trim().slice(0, 24);
}

/** 검색용 정규화 이름 (공백·기호 제거, 소문자) */
export function normItemName(raw: string): string {
  const compact = cleanItemName(raw).toLowerCase().replace(/[\s·・.,()[\]{}/\\_-]/g, "");
  const aliases: Record<string, string> = {
    로봇청소기: "로봇청소기",
    로보트청소기: "로봇청소기",
    로봇청소: "로봇청소기",
    식기세척기: "식기세척기",
    식기세척: "식기세척기",
    건조기: "건조기",
    의류건조기: "건조기",
    김치스텐드: "김치냉장고",
    김치스탠드: "김치냉장고",
  };
  return aliases[compact] ?? compact;
}

const BAD_DISPLAY_NAME = /^(ci_ai_|ai_|generated_|[0-9a-f]{8}-[0-9a-f-]{27,}$)|\.(png|jpe?g|webp|gif)$|\//i;

function recoveredDisplayName(row: {
  display_name?: string | null;
  requested_name?: string | null;
  original_name?: string | null;
  name?: string | null;
  prompt?: string | null;
}): string {
  const candidates = [row.display_name, row.requested_name, row.original_name, row.name];
  for (const value of candidates) {
    const clean = cleanItemName(value ?? "");
    if (clean && !BAD_DISPLAY_NAME.test(clean)) return clean;
  }
  const match = row.prompt?.match(/Korean household moving item:\s*"([^"]*[가-힣][^"]*)"/i);
  return cleanItemName(match?.[1] ?? "") || "이름 수정 필요";
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
  subgroup?: string;
  size?: "소형" | "중형" | "대형";
  /** 차량 계산에 쓰는 기본 부피(루베) */
  volume?: number;
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
  /** 품목 종류(= 품목 그룹). 없으면 이름으로 자동 분류합니다 */
  kind: z.string().min(1).max(20).optional(),
  /** 화면에서는 묻지 않습니다 — 종류별 기본 부피로 서버가 정합니다 */
  size: z.enum(["소형", "중형", "대형"]).optional(),
  /** 차량 계산용 기본 부피(루베) — 종류별 기본값 */
  volume: z.number().min(0).max(5).optional(),
  /** 사장님이 현장에서 찍은 사진 (data URL). 있으면 이 사진을 참고해 그립니다 */
  photo: z.string().min(32).max(9_000_000).optional(),
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** data URL → 업로드용 파일 (사진을 참고 이미지로 넘길 때 사용) */
function photoToBlob(dataUrl: string): { blob: Blob; filename: string } | null {
  const match = dataUrl.match(/^data:(image\/(png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[3]), (c) => c.charCodeAt(0));
    if (bytes.byteLength < 100) return null;
    const ext = match[1] === "image/png" ? "png" : match[1] === "image/webp" ? "webp" : "jpg";
    return { blob: new Blob([bytes], { type: match[1] }), filename: `photo.${ext}` };
  } catch {
    return null;
  }
}

async function requestImage(key: string, prompt: string, photo?: string): Promise<Response> {
  const file = photo ? photoToBlob(photo) : null;
  if (photo && !file) return new Response("사진을 불러오지 못했습니다.", { status: 400 });

  let last: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await wait(700 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
    let response: Response;
    if (file) {
      const form = new FormData();
      form.append("model", "openai/gpt-image-2.5-sunburst");
      form.append("prompt", prompt);
      form.append("size", "1024x1024");
      form.append("quality", "medium");
      form.append("n", "1");
      form.append("background", "transparent");
      form.append("output_format", "png");
      form.append("image", file.blob, file.filename);
      response = await fetch("https://ai.gateway.lovable.dev/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
    } else {
      response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-image-2.5-sunburst",
          prompt,
          size: "1024x1024",
          quality: "medium",
          n: 1,
          background: "transparent",
          output_format: "png",
        }),
      });
    }
    last = response;
    if (response.status !== 429 && response.status < 500) return response;
    if (attempt < 2) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) await wait(Math.min(retryAfter * 1000, 8000));
    }
  }
  return last ?? new Response("이미지 생성 서버에 연결하지 못했습니다.", { status: 503 });
}

/** 같은 업체가 이미 만든 아이콘이 있으면 찾아 줍니다 (중복 생성 방지) */
export const findItemIcon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: z.string().min(1).max(40) }).parse(input))
  .handler(async ({ data, context }): Promise<IconResult> => {
    const norm = normItemName(data.name);
    if (!norm) return { ok: false, error: "품목명을 입력해 주세요." };
    const { data: row, error } = await context.supabase
      .from("item_icons")
      .select("item_id, name, display_name, requested_name, original_name, prompt, cat, category_group, subcategory_group, size_label, room, image_url, status, default_volume")
      .eq("user_id", context.userId)
      .eq("normalized_name", norm)
      .eq("active", true)
      .eq("status", "ready")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!row?.image_url) return { ok: false };
    return {
      ok: true,
      reused: true,
      itemId: row.item_id,
      name: recoveredDisplayName(row),
      cat: row.category_group || row.cat,
      subgroup: row.subcategory_group ?? undefined,
      size: row.size_label as "소형" | "중형" | "대형",
      volume: Number(row.default_volume ?? 0) || undefined,
      room: row.room ?? undefined,
      iconUrl: row.image_url,
    };
  });

/**
 * 이 업체가 만들어 둔 3D 품목 전체 목록.
 * 새로고침·앱 업그레이드·다른 기기에서도 같은 품목이 그대로 보이게 합니다.
 */
export const listItemIcons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      ok: boolean;
      error?: string;
       items: { itemId: string; name: string; cat: string; subgroup?: string; size?: "소형" | "중형" | "대형"; volume?: number; room?: string; iconUrl: string }[];
    }> => {
      const { data, error } = await context.supabase
        .from("item_icons")
        .select("item_id, name, display_name, requested_name, original_name, prompt, cat, category_group, subcategory_group, size_label, room, image_url, created_at, default_volume")
        .eq("user_id", context.userId)
        .eq("active", true)
        .eq("status", "ready")
        .order("created_at", { ascending: true });
      if (error) return { ok: false, error: error.message, items: [] };
      return {
        ok: true,
        items: (data ?? [])
          .filter((r) => !!r.image_url)
          .map((r) => ({
            itemId: r.item_id as string,
            name: recoveredDisplayName(r),
            cat: (r.category_group || r.cat) as string,
            subgroup: (r.subcategory_group as string | null) ?? undefined,
            size: r.size_label as "소형" | "중형" | "대형",
            volume: Number(r.default_volume ?? 0) || undefined,
            room: (r.room as string | null) ?? undefined,
            iconUrl: r.image_url as string,
          })),
      };
    },
  );

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
    //    (「이미지 다시 만들기」인 경우에는 같은 품목 행에 새 그림을 다시 만들어 넣습니다)
    const existing = await context.supabase
      .from("item_icons")
      .select("id, item_id, name, display_name, requested_name, original_name, prompt, cat, category_group, subcategory_group, size_label, room, image_url")
      .eq("user_id", context.userId)
      .eq("normalized_name", norm)
      .eq("active", true)
      .eq("status", "ready")
      .maybeSingle();
    if (existing.data?.image_url && !data.force) {
      return {
        ok: true,
        reused: true,
        itemId: existing.data.item_id,
        name: recoveredDisplayName(existing.data),
        cat: existing.data.category_group || existing.data.cat,
        subgroup: existing.data.subcategory_group ?? undefined,
        size: existing.data.size_label as "소형" | "중형" | "대형",
        room: data.room,
        iconUrl: existing.data.image_url,
      };
    }
    /** 다시 만들 기존 품목 행 (있으면 같은 품목 id·수량을 그대로 유지합니다) */
    const regenRow = data.force && existing.data?.id ? existing.data : null;


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
      data.photo
        ? "Redraw the object shown in the reference photo as this icon, keeping its real shape, proportion and colour."
        : "",
      "Style: soft glossy 3D render, white and light-grey body with small blue (#2A6FD6) accents,",
      "isometric three-quarter view, centered, one object only, plain pure white background,",
      "clean silhouette that stays readable at 40px, soft shadow.",
      "No text, no letters, no logo, no watermark, no border, no frame, no people, no extra objects.",
    ]
      .filter(Boolean)
      .join(" ");
    const kind = kindOf(data.kind ?? guessKind(name));
    const subgroup = data.kind ? kind.label : itemSubgroup(name, data.cat);
    const volume = data.volume ?? kind.volume;
    const size = data.size ?? (volume >= 1 ? "대형" : volume >= 0.5 ? "중형" : "소형");

    // ③ 생성 기록을 먼저 남깁니다 (실패해도 원인이 남습니다)
    //    다시 만들기는 새 행을 만들지 않고 기존 품목 행의 그림만 바꿉니다
    let rowId: string;
    let itemId: string;
    if (regenRow) {
      rowId = regenRow.id as string;
      itemId = regenRow.item_id as string;
      const marked = await context.supabase
        .from("item_icons")
        .update({
          prompt,
          generation_prompt: prompt,
          subcategory_group: subgroup,
          size_label: size,
          default_volume: volume,
          from_photo: !!data.photo,
          metadata: { display_name: name, room: data.room, size, kind: kind.label, volume },
        })
        .eq("id", rowId)
        .eq("user_id", context.userId);
      if (marked.error) return { ok: false, error: marked.error.message };
    } else {
      itemId = `ci_ai_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const inserted = await context.supabase
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
          subcategory_group: subgroup,
          size_label: size,
          room: data.room,
          status: "pending",
          prompt,
          original_name: name,
          requested_name: name,
          generation_prompt: prompt,
          generation_id: itemId,
          is_generated: true,
          sort_order: -Math.floor(Date.now() / 1000),
          source: "company",
          default_volume: volume,
          from_photo: !!data.photo,
          metadata: { display_name: name, room: data.room, size, kind: kind.label, volume },
          active: true,
        })
        .select("id")
        .single();
      if (inserted.error) {
        if (inserted.error.code === "23505" || inserted.error.message.includes("duplicate"))
          return { ok: false, error: "이미 같은 품목명의 아이콘을 만들고 있습니다. 잠시 후 다시 확인해 주세요." };
        return { ok: false, error: inserted.error.message };
      }
      rowId = inserted.data.id as string;
    }


    const fail = async (message: string): Promise<IconResult> => {
      await context.supabase
        .from("item_icons")
        .update({ status: "failed", active: false })
        .eq("id", rowId);
      return { ok: false, error: message, remaining: Math.max(0, ICON_DAILY_LIMIT - used - 1) };
    };

    try {
      const res = await requestImage(key, prompt, data.photo);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 429) return fail("요청이 많습니다. 잠시 후 다시 시도해 주세요.");
        if (res.status === 401) return fail("이미지 생성 설정을 확인해 주세요.");
        if (res.status === 402 || res.status === 403)
          return fail(text.slice(0, 200) || "AI 사용 권한 또는 크레딧을 확인해 주세요.");
        return fail(text.slice(0, 200) || `이미지 생성 실패 (${res.status})`);
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
        .update({ status: "ready", image_path: path, storage_path: path, image_url: iconUrl })
        .eq("id", rowId);
      if (done.error) return fail(`아이콘 등록 실패: ${done.error.message}`);

      return {
        ok: true,
        itemId,
        name,
        cat: kind.cat,
        subgroup,
        size,
        volume,
        room: data.room,
        iconUrl,
        remaining: Math.max(0, ICON_DAILY_LIMIT - used - 1),
      };
    } catch (e) {
      return fail(e instanceof Error ? e.message : "이미지 생성 중 오류가 발생했습니다.");
    }
  });

const updateSchema = z.object({
  itemId: z.string().min(1).max(80),
  name: z.string().min(1).max(40),
  cat: z.string().min(1).max(20).optional(),
  /** 자리이동(품목 그룹 변경) — 새로고침 후에도 유지됩니다 */
  subgroup: z.string().min(1).max(20).optional(),
});

/** 생성 품목의 표시 이름을 업체 소유 행에 영구 저장합니다. */
export const updateItemIcon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }): Promise<IconResult> => {
    const name = cleanItemName(data.name);
    const norm = normItemName(name);
    if (!name || !norm) return { ok: false, error: "품목명을 입력해 주세요." };
    if (!NAME_OK.test(name)) return { ok: false, error: "품목명에 쓸 수 없는 문자가 있습니다." };
    const cat = data.cat || "기타";
    const { data: row, error } = await context.supabase
      .from("item_icons")
      .update({
        name,
        norm_name: norm,
        display_name: name,
        normalized_name: norm,
        category_group: cat,
        cat,
        subcategory_group: data.subgroup || itemSubgroup(name, cat),
        requested_name: name,
      })
      .eq("user_id", context.userId)
      .eq("item_id", data.itemId)
      .eq("active", true)
      .select("item_id, image_url")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "같은 이름의 품목이 이미 있습니다." };
      return { ok: false, error: error.message };
    }
    if (!row?.image_url) return { ok: false, error: "수정할 생성 품목을 찾지 못했습니다." };
    return {
      ok: true,
      itemId: row.item_id,
      name,
      cat,
      subgroup: data.subgroup || itemSubgroup(name, cat),
      iconUrl: row.image_url,
    };
  });

/** 생성 품목을 지우지 않고 비활성화하여 지난 견적 기록을 보존합니다. */
export const deactivateItemIcon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ itemId: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await context.supabase
      .from("item_icons")
      .update({ active: false })
      .eq("user_id", context.userId)
      .eq("item_id", data.itemId);
    return error ? { ok: false, error: error.message } : { ok: true };
  });
