import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** 사장님이 직접 고른 「자주 담는 품목」 최대 개수 */
export const FAVORITE_LIMIT = 20;

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
