import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cleanItemName, normItemName, type IconResult } from "./item-icon.functions";
import { itemSubgroup } from "./item-groups";

const schema = z.object({
  name: z.string().trim().min(2).max(24), cat: z.enum(["가구", "가전", "주방", "생활용품", "운동·레저"]),
  room: z.string().min(1).max(20), volume: z.number().min(0).max(5),
  photo: z.string().max(4_000_000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/),
});

/** Reuses company-owned item_icons; photos are stored without AI generation. */
export const createManualItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }): Promise<IconResult> => {
    const name = cleanItemName(data.name);
    const norm = normItemName(name);
    const old = await context.supabase.from("item_icons").select("id, item_id, display_name, category_group, default_volume, subcategory_group, status, storage_path")
      .eq("user_id", context.userId).eq("normalized_name", norm).eq("active", true).maybeSingle();
    if (old.error) return { ok: false, error: "기존 품목을 확인하지 못했습니다." };
    if (old.data) {
      if (old.data.status !== "ready" || !old.data.storage_path) return { ok: false, error: "같은 이름의 품목을 저장 중입니다. 잠시 후 다시 확인해 주세요." };
      return { ok: true, reused: true, itemId: old.data.item_id, name: old.data.display_name, cat: old.data.category_group,
        subgroup: old.data.subcategory_group || undefined, volume: Number(old.data.default_volume), iconUrl: `/api/public/item-icon/${old.data.id}.png` };
    }
    const id = crypto.randomUUID();
    const itemId = `ci_ai_${id.replace(/-/g, "").slice(0, 16)}`;
    const isPng = data.photo.startsWith("data:image/png");
    const bytes = Uint8Array.from(atob(data.photo.split(",")[1]), (ch) => ch.charCodeAt(0));
    if (bytes.length < 100 || (isPng ? bytes[0] !== 137 || bytes[1] !== 80 : bytes[0] !== 255 || bytes[1] !== 216)) return { ok: false, error: "사진 파일을 확인해 주세요." };
    const subgroup = itemSubgroup(name, data.cat);
    const inserted = await context.supabase.from("item_icons").insert({
      id, user_id: context.userId, created_by: context.userId, item_id: itemId, name, norm_name: norm,
      normalized_name: norm, display_name: name, requested_name: name, original_name: name,
      cat: data.cat, category_group: data.cat, subcategory_group: subgroup, room: data.room,
      default_volume: data.volume, status: "pending", active: true, source: "company", is_generated: false,
      from_photo: true, metadata: { manual: true },
    }).select("id").single();
    if (inserted.error) return { ok: false, error: inserted.error.code === "23505" ? "같은 품목을 저장 중입니다. 잠시 후 다시 확인해 주세요." : "품목을 저장하지 못했습니다." };
    const path = `${context.userId}/${id}.${isPng ? "png" : "jpg"}`;
    // Storage upload is narrowly privileged after an owner-scoped insert succeeds.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const upload = await supabaseAdmin.storage.from("item-icons").upload(path, bytes, { contentType: isPng ? "image/png" : "image/jpeg", upsert: false });
    const iconUrl = `/api/public/item-icon/${id}.png`;
    const done = upload.error ? null : await context.supabase.from("item_icons").update({ status: "ready", image_path: path, storage_path: path, image_url: iconUrl })
      .eq("id", id).eq("user_id", context.userId).select("id").single();
    if (upload.error || !done || done.error) {
      await context.supabase.from("item_icons").update({ status: "failed", active: false }).eq("id", id).eq("user_id", context.userId);
      return { ok: false, error: "이미지 저장에 실패했습니다. 품목은 선택되지 않았습니다." };
    }
    return { ok: true, itemId, name, cat: data.cat, subgroup, volume: data.volume, iconUrl };
  });