/**
 * 직원용 공유 링크 서버 기능.
 *
 *  - createStaffShare : 사장님이 공유할 때, 무작위 토큰을 만들고 해시만 저장합니다.
 *  - markStaffShareShared : 카카오톡 공유창을 실제로 열었다는 사실을 남깁니다.
 *  - openStaffShare   : 직원이 링크를 열 때 (로그인 없이) 업무용 내용을 읽습니다.
 *  - revokeStaffShare : 공유 취소·직원 변경 시 토큰을 폐기합니다.
 *  - listStaffShares  : 내 견적의 공유 이력.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { StaffSheetSnapshot } from "./staff-share";

export interface StaffShareRow {
  id: string;
  estimateId: string;
  staffName: string | null;
  shareMethod: string;
  expiresAt: string;
  revokedAt: string | null;
  sharedAt: string | null;
  openedAt: string | null;
  lastOpenedAt: string | null;
  openCount: number;
}

/** 사장님 — 직원용 보안 링크를 만듭니다 (토큰 원문은 이 응답에서 한 번만 돌려줍니다) */
export const createStaffShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        estimateId: z.string().min(1).max(80),
        staffName: z.string().max(80).optional(),
        moveDate: z.string().max(40).optional(),
        shareMethod: z.string().max(30).default("kakao"),
        /** 직원 화면에 그릴 업무용 내용 (금액 없음) */
        snapshot: z.string().min(2).max(300_000),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: boolean; token?: string; expiresAt?: string; error?: string }> => {
      const { makeStaffToken, hashStaffToken, defaultExpiry } = await import("./staff-share.server");
      const token = makeStaffToken();
      const hash = await hashStaffToken(token);
      const expiresAt = defaultExpiry(data.moveDate ?? null).toISOString();

      // 같은 견적의 이전 링크는 폐기합니다 (직원 변경·재공유 시 예전 링크 차단)
      await context.supabase
        .from("estimate_staff_shares")
        .update({ revoked_at: new Date().toISOString() })
        .eq("company_id", context.userId)
        .eq("estimate_id", data.estimateId)
        .is("revoked_at", null);

      const { error } = await context.supabase.from("estimate_staff_shares").insert({
        estimate_id: data.estimateId,
        company_id: context.userId,
        created_by: context.userId,
        secure_token_hash: hash,
        expires_at: expiresAt,
        share_method: data.shareMethod,
        staff_name: data.staffName ?? null,
        staff_snapshot: data.snapshot,
      });
      if (error) {
        console.error("[createStaffShare]", error.message);
        return { ok: false, error: "직원용 링크를 만들지 못했습니다." };
      }
      return { ok: true, token, expiresAt };
    },
  );

/** 사장님 — 카카오톡 공유창을 실제로 열었다는 사실만 남깁니다 (전달 완료가 아닙니다) */
export const markStaffShareShared = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        estimateId: z.string().min(1).max(80),
        shareMethod: z.string().max(30).default("kakao"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { error } = await context.supabase
      .from("estimate_staff_shares")
      .update({ shared_at: new Date().toISOString(), share_method: data.shareMethod })
      .eq("company_id", context.userId)
      .eq("estimate_id", data.estimateId)
      .is("revoked_at", null);
    if (error) console.error("[markStaffShareShared]", error.message);
    return { ok: !error };
  });

/** 사장님 — 공유 취소 (링크 폐기) */
export const revokeStaffShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ estimateId: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { error } = await context.supabase
      .from("estimate_staff_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("company_id", context.userId)
      .eq("estimate_id", data.estimateId)
      .is("revoked_at", null);
    if (error) console.error("[revokeStaffShare]", error.message);
    return { ok: !error };
  });

/** 사장님 — 내 견적의 직원 공유 이력 */
export const listStaffShares = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ estimateId: z.string().max(80).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; rows: StaffShareRow[] }> => {
    let q = context.supabase
      .from("estimate_staff_shares")
      .select(
        "id, estimate_id, staff_name, share_method, expires_at, revoked_at, shared_at, opened_at, last_opened_at, open_count",
      )
      .eq("company_id", context.userId);
    if (data?.estimateId) q = q.eq("estimate_id", data.estimateId);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(100);
    if (error || !rows) {
      if (error) console.error("[listStaffShares]", error.message);
      return { ok: false, rows: [] };
    }
    return {
      ok: true,
      rows: rows.map((r) => ({
        id: r.id,
        estimateId: r.estimate_id,
        staffName: r.staff_name,
        shareMethod: r.share_method,
        expiresAt: r.expires_at,
        revokedAt: r.revoked_at,
        sharedAt: r.shared_at,
        openedAt: r.opened_at,
        lastOpenedAt: r.last_opened_at,
        openCount: r.open_count,
      })),
    };
  });

export interface StaffShareView {
  ok: boolean;
  error?: string;
  expiresAt?: string;
  snapshot?: StaffSheetSnapshot;
}

/** 직원 — 보안 링크로 업무용 내용을 읽습니다 (로그인 필요 없음) */
export const openStaffShare = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(16).max(200) }).parse(d))
  .handler(async ({ data }): Promise<StaffShareView> => {
    const { hashStaffToken } = await import("./staff-share.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = await hashStaffToken(data.token);

    const { data: row, error } = await supabaseAdmin
      .from("estimate_staff_shares")
      .select("id, expires_at, revoked_at, opened_at, open_count, staff_snapshot")
      .eq("secure_token_hash", hash)
      .maybeSingle();
    if (error) {
      console.error("[openStaffShare]", error.message);
      return { ok: false, error: "정보를 불러오지 못했습니다." };
    }
    // 토큰이 틀리면 어떤 고객정보도 돌려주지 않습니다
    if (!row) return { ok: false, error: "잘못된 주소입니다. 담당자에게 다시 요청해 주세요." };
    if (row.revoked_at) return { ok: false, error: "공유가 취소된 링크입니다." };
    if (new Date(row.expires_at).getTime() < Date.now())
      return { ok: false, error: "유효기간이 지난 링크입니다." };

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("estimate_staff_shares")
      .update({
        opened_at: row.opened_at ?? now,
        last_opened_at: now,
        open_count: (row.open_count ?? 0) + 1,
      })
      .eq("id", row.id);

    let snapshot: StaffSheetSnapshot | undefined;
    try {
      snapshot = JSON.parse(row.staff_snapshot ?? "null") as StaffSheetSnapshot;
    } catch {
      snapshot = undefined;
    }
    if (!snapshot) return { ok: false, error: "이사정보를 읽을 수 없습니다." };
    return { ok: true, expiresAt: row.expires_at, snapshot };
  });
