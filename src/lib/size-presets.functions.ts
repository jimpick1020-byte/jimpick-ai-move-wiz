/**
 * 사장님이 고친 「평수별 기본품목」 설정을 업체별로 저장·조회합니다.
 * 저장은 지금 로그인한 업체(user_id)에만 적용되고 다른 업체 설정에는 영향이 없습니다.
 * 이미 저장·확정된 고객 견적서의 품목·금액은 이 설정을 바꿔도 그대로입니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SizePresets } from "@/lib/size-presets";

interface PresetPayload {
  presets: SizePresets;
}

function sanitize(input: unknown): SizePresets {
  const out: SizePresets = {};
  if (!input || typeof input !== "object") return out;
  for (const [size, rooms] of Object.entries(input as Record<string, unknown>)) {
    if (!Array.isArray(rooms)) continue;
    out[size] = rooms
      .map((r) => {
        const room = typeof (r as { room?: unknown })?.room === "string" ? (r as { room: string }).room : "";
        const rawItems = (r as { items?: unknown })?.items;
        const items = Array.isArray(rawItems)
          ? rawItems
              .map((i) => ({
                name: typeof (i as { name?: unknown })?.name === "string" ? (i as { name: string }).name.trim() : "",
                qty: Math.max(1, Math.min(99, Number((i as { qty?: unknown })?.qty) || 1)),
              }))
              .filter((i) => i.name.length > 0)
          : [];
        return { room, items };
      })
      .filter((r) => r.room.length > 0);
  }
  return out;
}

export const getSizePresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("company_size_presets")
      .select("payload")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message, presets: {} as SizePresets };
    const payload = (data?.payload ?? {}) as Partial<PresetPayload>;
    return { ok: true as const, presets: sanitize(payload.presets) };
  });

export const saveSizePresets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { presets: SizePresets }) => input)
  .handler(async ({ data, context }) => {
    const presets = sanitize(data.presets);
    const { error } = await context.supabase
      .from("company_size_presets")
      .upsert({ user_id: context.userId, payload: { presets } }, { onConflict: "user_id" });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, presets };
  });

/** 기본 설정으로 복원 — 저장해 둔 업체 설정만 지웁니다 (고객 견적서는 그대로) */
export const resetSizePresets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("company_size_presets")
      .delete()
      .eq("user_id", context.userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
