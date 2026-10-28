/** 사장님 계정별 알림 — 읽음 처리는 결제 확정과 완전히 분리되어 있습니다. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface OwnerNotice { id: string; kind: string; refId: string; title: string; body: string; url: string; createdAt: string; readAt: string | null }

export const listOwnerNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ unread: number; items: OwnerNotice[] }> => {
    const { supabase, userId } = context;
    const [{ count, error: countError }, { data, error }] = await Promise.all([
      supabase.from("owner_notifications").select("id", { count: "exact", head: true }).eq("company_id", userId).is("read_at", null),
      supabase.from("owner_notifications").select("id, kind, ref_id, title, body, url, created_at, read_at").eq("company_id", userId).order("created_at", { ascending: false }).limit(40),
    ]);
    if (countError || error) throw new Error("알림을 불러오지 못했습니다.");
    return {
      unread: count ?? 0,
      items: (data ?? []).map((r) => ({ id: r.id, kind: r.kind, refId: r.ref_id, title: r.title, body: r.body, url: r.url, createdAt: r.created_at, readAt: r.read_at })),
    };
  });

/** 확인한 알림 한 건만 읽음 처리합니다 (입금 확정·결제 상태는 바꾸지 않습니다) */
export const markOwnerNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; unread: number }> => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("owner_notifications").update({ read_at: new Date().toISOString() })
      .eq("id", data.id).eq("company_id", userId).is("read_at", null);
    if (error) return { ok: false, unread: -1 };
    const { count } = await supabase.from("owner_notifications").select("id", { count: "exact", head: true }).eq("company_id", userId).is("read_at", null);
    return { ok: true, unread: count ?? 0 };
  });

/** 이 휴대폰의 푸시 구독을 로그인한 사장님 계정에 저장합니다 */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    endpoint: z.string().url().max(2000).refine((u) => u.startsWith("https://")),
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(8).max(100),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert({
      endpoint: data.endpoint, p256dh: data.p256dh, auth: data.auth, user_id: context.userId,
      user_agent: (getRequest()?.headers.get("user-agent") ?? "").slice(0, 300), updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) { console.error("[savePushSubscription]", error.message); return { ok: false }; }
    return { ok: true };
  });
