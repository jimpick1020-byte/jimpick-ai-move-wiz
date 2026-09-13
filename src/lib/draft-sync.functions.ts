/**
 * 작성 중인 견적의 자동 임시저장.
 *
 *  - saveEstimateDraft : 편집본만 estimate_drafts 표에 따로 저장합니다.
 *                        확정·발송된 견적서(estimate_terms)나 고객 정보는 건드리지 않습니다.
 *  - loadEstimateDraft : 새로고침·다시 로그인했을 때 마지막 편집본을 돌려줍니다.
 *
 * 저장 요청이 겹쳐도 오래된 값이 최신 값을 덮어쓰지 않도록
 * 저장 순번(revision)이 더 큰 요청만 반영합니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface DraftSyncResult {
  ok: boolean;
  error?: string;
  /** 서버에 저장된 최신 순번 */
  revision?: number;
  /** 더 최신 값이 이미 있어서 이번 값은 반영하지 않음 */
  stale?: boolean;
}

export const saveEstimateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        estimateId: z.string().min(1).max(80),
        /** 편집본 전체(JSON 글) */
        payload: z.string().min(2).max(400_000),
        revision: z.number().int().min(1).max(1_000_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<DraftSyncResult> => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.payload);
    } catch {
      return { ok: false, error: "임시저장 내용을 읽지 못했습니다." };
    }

    const { data: existing } = await context.supabase
      .from("estimate_drafts")
      .select("id, revision")
      .eq("user_id", context.userId)
      .eq("estimate_id", data.estimateId)
      .maybeSingle();

    if (existing && Number(existing.revision ?? 0) >= data.revision) {
      return { ok: true, stale: true, revision: Number(existing.revision ?? 0) };
    }

    if (existing) {
      const { error } = await context.supabase
        .from("estimate_drafts")
        .update({ payload: parsed as never, revision: data.revision })
        .eq("id", existing.id)
        .lt("revision", data.revision);
      if (error) {
        console.error("[saveEstimateDraft]", error.message);
        return { ok: false, error: "임시저장에 실패했습니다." };
      }
      return { ok: true, revision: data.revision };
    }

    const { error } = await context.supabase.from("estimate_drafts").insert({
      user_id: context.userId,
      estimate_id: data.estimateId,
      payload: parsed as never,
      revision: data.revision,
    });
    if (error) {
      console.error("[saveEstimateDraft]", error.message);
      return { ok: false, error: "임시저장에 실패했습니다." };
    }
    return { ok: true, revision: data.revision };
  });

export interface LoadedDraft {
  ok: boolean;
  found: boolean;
  estimateId?: string;
  /** 편집본 전체(JSON 글) */
  payload?: string;
  revision?: number;
  updatedAt?: string;
}

export const loadEstimateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ estimateId: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<LoadedDraft> => {
    const { data: row, error } = await context.supabase
      .from("estimate_drafts")
      .select("estimate_id, payload, revision, updated_at")
      .eq("user_id", context.userId)
      .eq("estimate_id", data.estimateId)
      .maybeSingle();
    if (error) {
      console.error("[loadEstimateDraft]", error.message);
      return { ok: false, found: false };
    }
    if (!row) return { ok: true, found: false };
    return {
      ok: true,
      found: true,
      estimateId: String(row.estimate_id),
      payload: JSON.stringify(row.payload ?? {}),
      revision: Number(row.revision ?? 0),
      updatedAt: row.updated_at,
    };
  });
