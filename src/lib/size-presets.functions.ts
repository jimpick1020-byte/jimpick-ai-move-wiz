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

/** 최고관리자인지 서버에서 확인합니다 */
async function assertSuperAdmin(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("is_super_admin", { _user_id: userId });
  if (data !== true) throw new Error("Forbidden: 서비스 관리자만 바꿀 수 있습니다");
}

/**
 * 평수별 기본품목을 읽습니다.
 * 서비스 관리자가 정한 공통 목록을 쓰고, 예전에 업체가 직접 저장해 둔 목록이 있으면 그 목록을 그대로 씁니다.
 */
export const getSizePresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("company_size_presets")
      .select("user_id, payload");
    if (error) return { ok: false as const, error: error.message, presets: {} as SizePresets };
    const rows = data ?? [];
    const mine = rows.find((r) => r.user_id === context.userId);
    let row = mine;
    if (!row) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: admins } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      const adminIds = new Set((admins ?? []).map((a) => a.user_id));
      row = rows.find((r) => adminIds.has(r.user_id));
    }
    const payload = (row?.payload ?? {}) as Partial<PresetPayload>;
    return { ok: true as const, presets: sanitize(payload.presets) };
  });

/** 공통 기본품목 저장 — 서비스 관리자만 */
export const saveSizePresets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { presets: SizePresets }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const presets = sanitize(data.presets);
    const { error } = await context.supabase
      .from("company_size_presets")
      .upsert(
        {
          user_id: context.userId,
          payload: JSON.parse(JSON.stringify({ presets })),
        },
        { onConflict: "user_id" },
      );
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, presets };
  });

/** 기본 설정으로 복원 — 서비스 관리자만 (고객 견적서는 그대로) */
export const resetSizePresets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await context.supabase
      .from("company_size_presets")
      .delete()
      .eq("user_id", context.userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
