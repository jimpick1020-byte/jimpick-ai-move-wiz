import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * 서버에 저장된 「보낸 견적」 전체 — 견적 내역·견적 현황이 휴대폰 저장 목록만 보고
 * 달력(서버)과 숫자가 어긋나지 않도록, 이 기기에 없는 견적을 받아와 합칩니다.
 * 삭제·자동 정리된 견적은 돌려주지 않으며, 로그인한 업체 본인 것만 읽습니다.
 */
export const listActiveEstimates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; payloads: string[] }> => {
    const { data: terms, error } = await context.supabase
      .from("estimate_terms")
      .select("estimate_id, total, sheet_version")
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .limit(2000);
    if (error) return { ok: false, payloads: [] };
    const completed = await context.supabase.from("intake_requests").select("estimate_id,source_estimate_id")
      .eq("company_id", context.userId).not("estimate_completed_at", "is", null);
    if (completed.error) return { ok: false, payloads: [] };
    const ids = [...new Set([...(terms ?? []).map(r => String(r.estimate_id)), ...(completed.data ?? []).flatMap(r => [r.estimate_id, r.source_estimate_id].filter((id): id is string => !!id))].filter(Boolean))];
    if (!ids.length) return { ok: true, payloads: [] };
    const payloads: string[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data: rows, error: e2 } = await context.supabase
        .from("estimate_drafts")
        .select("estimate_id, payload")
        .eq("user_id", context.userId)
        .in("estimate_id", ids.slice(i, i + 200))
        .is("deleted_at", null)
        .is("archived_at", null);
      if (e2) return { ok: false, payloads: [] };
      for (const r of rows ?? []) {
        const p = r.payload as { id?: string } | null;
        if (p && typeof p === "object" && p.id === r.estimate_id) {
          const latest = (terms ?? []).filter(t => t.estimate_id === r.estimate_id).sort((a,b) => b.sheet_version - a.sheet_version)[0];
          payloads.push(JSON.stringify(latest ? { ...p, total: latest.total } : p));
        }
      }
    }
    return { ok: true, payloads };
  });
