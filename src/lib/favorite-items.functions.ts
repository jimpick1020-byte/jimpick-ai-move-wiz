import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** 사장님이 직접 고른 「자주 담는 품목」 최대 개수 */
export const FAVORITE_LIMIT = 30;

const schema = z.object({
  itemIds: z.array(z.string().min(1).max(80)).max(FAVORITE_LIMIT),
});

/** 저장된 자주 담는 품목 목록을 읽습니다 (계정별) */
export const getFavoriteItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; error?: string; itemIds: string[] }> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("favorite_item_ids")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, itemIds: [] };
    return { ok: true, itemIds: (data?.favorite_item_ids ?? []) as string[] };
  });

/** 자주 담는 품목 목록을 저장합니다 (순서 그대로, 중복 제거) */
export const saveFavoriteItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const unique = [...new Set(data.itemIds)].slice(0, FAVORITE_LIMIT);
    const { error } = await context.supabase
      .from("profiles")
      .upsert({ id: context.userId, favorite_item_ids: unique }, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

/** 품목 이름 수정 — 업체 계정별, 품목 ID는 그대로 두고 이름만 바꿉니다. */
export const ITEM_NAME_MAX = 40;
export function cleanItemName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export const getItemNameOverrides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; error?: string; names: Record<string, string> }> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("item_name_overrides")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, names: {} };
    const raw = (data?.item_name_overrides ?? {}) as Record<string, unknown>;
    const names: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && v.trim()) names[k] = v;
    return { ok: true, names };
  });

const renameSchema = z.object({
  itemId: z.string().min(1).max(80),
  name: z.string().max(200),
});

export const saveItemNameOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => renameSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string; name?: string }> => {
    const name = cleanItemName(data.name);
    if (!name) return { ok: false, error: "품목 이름을 입력해 주세요" };
    if (name.length > ITEM_NAME_MAX) return { ok: false, error: `품목 이름은 ${ITEM_NAME_MAX}자 이내로 입력해 주세요` };
    const { data: row, error: readError } = await context.supabase
      .from("profiles").select("item_name_overrides").eq("id", context.userId).maybeSingle();
    if (readError) return { ok: false, error: readError.message };
    const next = { ...((row?.item_name_overrides ?? {}) as Record<string, string>), [data.itemId]: name };
    const { error } = await context.supabase.from("profiles").update({ item_name_overrides: next }).eq("id", context.userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, name };
  });
