/**
 * 계약(견적) 삭제 — 달력 일정과 견적 내역을 한 번에 함께 삭제합니다.
 *
 * 실제 데이터를 지우지 않고 삭제 표시(deleted_at / deleted_by / deletion_source /
 * deletion_reason)만 남기는 소프트 삭제입니다. 확정 견적서 스냅샷·발송 기록은
 * 분쟁 대비 보관용으로 남고, 일반 화면(달력·견적 내역·고객 링크)에서는 사라집니다.
 *
 * 권한은 데이터베이스 함수 soft_delete_estimate 안에서 확인합니다.
 *  - 로그인 사용자 본인(해당 업체 사장님) 또는 전체 관리자만 삭제할 수 있습니다.
 *  - 다른 업체의 견적은 삭제되지 않습니다(forbidden).
 *  - 이미 삭제된 건은 다시 처리하지 않습니다(already).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface DeleteEstimateResult {
  ok: boolean;
  /** 이미 삭제되어 있던 계약 */
  already?: boolean;
  error?: string;
}

/** 삭제 확인창 문구 (달력·견적 내역 공통) */
export const DELETE_CONFIRM_TEXT =
  "이 계약과 연결된 달력 일정 및 견적 내역이 함께 삭제됩니다. 삭제하시겠습니까?";

export const deleteEstimateEverywhere = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        estimateId: z.string().min(1).max(120),
        /** 어느 화면에서 삭제했는지 (기록용) */
        source: z.enum(["calendar", "history", "admin"]),
        reason: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<DeleteEstimateResult> => {
    const { data: res, error } = await context.supabase.rpc("soft_delete_estimate", {
      _estimate_id: data.estimateId,
      _source: data.source,
      _reason: data.reason ?? null,
    } as never);
    if (error) {
      console.error("[deleteEstimateEverywhere]", error.message);
      return { ok: false, error: "삭제하지 못했습니다. 잠시 후 다시 시도해 주세요." };
    }
    const out = (res ?? {}) as { ok?: boolean; reason?: string; already?: boolean };
    if (!out.ok) {
      const msg =
        out.reason === "forbidden"
          ? "이 계약을 삭제할 권한이 없습니다. (다른 업체의 계약)"
          : out.reason === "not_found"
            ? "서버에 저장된 계약을 찾지 못했습니다."
            : out.reason === "no_auth"
              ? "로그인이 만료되었습니다. 다시 로그인해 주세요."
              : "삭제하지 못했습니다.";
      return { ok: false, error: msg };
    }
    return { ok: true, already: !!out.already };
  });

/**
 * 삭제된 견적번호 목록 — 다른 휴대전화에서도 삭제 상태가 그대로 보이도록,
 * 이 기기에 남아 있는 견적 목록에서 걸러내는 데 씁니다. 본인 것만 돌려줍니다.
 */
export const listDeletedEstimateIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; ids: string[] }> => {
    const [terms, drafts] = await Promise.all([
      context.supabase
        .from("estimate_terms")
        .select("estimate_id")
        .eq("user_id", context.userId)
        .not("deleted_at", "is", null)
        .limit(2000),
      context.supabase
        .from("estimate_drafts")
        .select("estimate_id")
        .eq("user_id", context.userId)
        .not("deleted_at", "is", null)
        .limit(2000),
    ]);
    if (terms.error) console.error("[listDeletedEstimateIds]", terms.error.message);
    const ids = new Set<string>();
    for (const r of (terms.data ?? []) as { estimate_id?: string }[])
      if (r.estimate_id) ids.add(String(r.estimate_id));
    for (const r of (drafts.data ?? []) as { estimate_id?: string }[])
      if (r.estimate_id) ids.add(String(r.estimate_id));
    return { ok: !terms.error, ids: [...ids] };
  });
