/** 웹 표준 푸시 발송 — 앱이 꺼져 있어도 휴대폰 알림으로 받습니다. */
import { buildPushPayload } from "@block65/webcrypto-web-push";

export async function dispatchOwnerNotifications(onlyId?: string): Promise<{ sent: number; failed: number; skipped: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const publicKey = String(process.env["VAPID_PUBLIC_KEY"] ?? "").trim();
  const privateKey = String(process.env["VAPID_PRIVATE_KEY"] ?? "").trim();
  if (!publicKey || !privateKey) throw new Error("VAPID keys are not configured");
  const vapid = { subject: "mailto:support@jimpick-ai-move-wiz.lovable.app", publicKey, privateKey };

  let query = supabaseAdmin.from("owner_notifications")
    .select("id, company_id, kind, ref_id, title, body, url")
    .is("pushed_at", null)
    .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString())
    .order("created_at", { ascending: true })
    .limit(30);
  if (onlyId) query = query.eq("id", onlyId);
  const { data: notes, error } = await query;
  if (error) throw new Error(error.message);

  let sent = 0, failed = 0, skipped = 0;
  for (const note of notes ?? []) {
    const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", note.company_id);
    const { count: unread } = await supabaseAdmin.from("owner_notifications").select("id", { count: "exact", head: true })
      .eq("company_id", note.company_id).is("read_at", null);
    if (!subs?.length) {
      skipped += 1;
      await supabaseAdmin.from("owner_notifications").update({ pushed_at: new Date().toISOString(), push_error: "no_subscription" }).eq("id", note.id);
      continue;
    }
    const errors: string[] = [];
    let delivered = 0;
    for (const sub of subs) {
      try {
        const payload = await buildPushPayload(
          { data: JSON.stringify({ id: note.id, title: note.title, body: note.body, url: note.url, unread: unread ?? 0, tag: `${note.kind}:${note.ref_id}` }), options: { ttl: 86400, urgency: "high" } },
          { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          vapid,
        );
        const res = await fetch(sub.endpoint, payload);
        if (res.status === 404 || res.status === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
          errors.push(`gone ${res.status}`);
        } else if (!res.ok) {
          errors.push(`${res.status} ${(await res.text()).slice(0, 120)}`);
        } else delivered += 1;
      } catch (cause) {
        errors.push(cause instanceof Error ? cause.message.slice(0, 120) : "send failed");
      }
    }
    if (delivered > 0) sent += 1; else failed += 1;
    await supabaseAdmin.from("owner_notifications").update({
      pushed_at: new Date().toISOString(),
      push_error: delivered > 0 ? (errors.length ? errors.join("; ") : null) : errors.join("; ") || "failed",
    }).eq("id", note.id);
  }
  return { sent, failed, skipped };
}
