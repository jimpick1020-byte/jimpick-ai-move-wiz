/**
 * 이사화물 표준약관 발송·동의 기록.
 *
 *  - publishEstimateTerms : 업체가 문자를 보낼 때, 어떤 약관을 어떤 견적에 보냈는지 남깁니다.
 *  - getTermsLink         : 고객이 링크를 열 때, 보안 토큰으로 약관 정보와 동의 여부를 읽습니다.
 *  - acceptTerms          : 고객이 확인란을 선택하고 예약을 확정할 때, 동의 기록을 남깁니다.
 *
 * 동의 기록에는 그때의 약관 원문(스냅샷)을 함께 저장해서,
 * 약관이 나중에 바뀌어도 고객이 동의한 내용이 그대로 남습니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface TermsLinkInfo {
  ok: boolean;
  error?: string;
  customerName?: string;
  moveDate?: string | null;
  total?: number;
  contactPhone?: string | null;
  termsName?: string;
  termsVersion?: string;
  termsEffectiveAt?: string | null;
  sheetNo?: string | null;
  sheetVersion?: number;
  sentAt?: string | null;
  /** 이미 동의했으면 그 일시 */
  acceptedAt?: string | null;
  acceptMethod?: string | null;
}

/** 업체가 견적서·약관 문자를 보낼 때 기록합니다 */
export const publishEstimateTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        estimateId: z.string().min(1).max(80),
        sheetNo: z.string().max(80).optional(),
        sheetVersion: z.number().int().min(1).max(999).default(1),
        customerName: z.string().max(80).default(""),
        moveDate: z.string().max(40).optional(),
        total: z.number().int().min(0).max(1_000_000_000).default(0),
        contactPhone: z.string().max(40).optional(),
        termsName: z.string().min(1).max(120),
        termsVersion: z.string().min(1).max(40),
        termsEffectiveAt: z.string().max(20).optional(),
        accessToken: z.string().min(8).max(80),
        sentAt: z.number().optional(),
        sentMsgId: z.string().max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await context.supabase.from("estimate_terms").upsert(
      {
        user_id: context.userId,
        estimate_id: data.estimateId,
        sheet_no: data.sheetNo ?? null,
        sheet_version: data.sheetVersion,
        customer_name: data.customerName,
        move_date: data.moveDate ?? null,
        total: data.total,
        contact_phone: data.contactPhone ?? null,
        terms_name: data.termsName,
        terms_version: data.termsVersion,
        terms_effective_at: data.termsEffectiveAt ?? null,
        access_token: data.accessToken,
        sent_at: new Date(data.sentAt ?? Date.now()).toISOString(),
        sent_msg_id: data.sentMsgId ?? null,
      },
      { onConflict: "user_id,estimate_id,sheet_version" },
    );
    if (error) {
      console.error("[publishEstimateTerms]", error.message);
      return { ok: false, error: "약관 발송 기록을 저장하지 못했습니다." };
    }
    return { ok: true };
  });

/** 고객용 — 보안 토큰으로 약관 정보와 동의 여부를 읽습니다 */
export const getTermsLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string().min(8).max(80) }).parse(d),
  )
  .handler(async ({ data }): Promise<TermsLinkInfo> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("estimate_terms")
      .select(
        "id, customer_name, move_date, total, contact_phone, terms_name, terms_version, terms_effective_at, sheet_no, sheet_version, sent_at",
      )
      .eq("access_token", data.token)
      .maybeSingle();
    if (error) {
      console.error("[getTermsLink]", error.message);
      return { ok: false, error: "약관 정보를 불러오지 못했습니다." };
    }
    if (!row) return { ok: false, error: "링크가 만료되었거나 잘못된 주소입니다." };

    const { data: acc } = await supabaseAdmin
      .from("terms_acceptances")
      .select("accepted_at, accept_method")
      .eq("estimate_terms_id", row.id)
      .maybeSingle();

    return {
      ok: true,
      customerName: row.customer_name,
      moveDate: row.move_date,
      total: row.total,
      contactPhone: row.contact_phone,
      termsName: row.terms_name,
      termsVersion: row.terms_version,
      termsEffectiveAt: row.terms_effective_at,
      sheetNo: row.sheet_no,
      sheetVersion: row.sheet_version,
      sentAt: row.sent_at,
      acceptedAt: acc?.accepted_at ?? null,
      acceptMethod: acc?.accept_method ?? null,
    };
  });

/** 고객용 — 약관 동의와 예약 확정을 기록합니다 */
export const acceptTerms = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(8).max(80),
        termsSnapshot: z.string().min(10).max(200_000),
        /** 동의한 그 순간의 견적서 (나중에 견적서를 고쳐도 이건 그대로 남습니다) */
        estimateSnapshot: z.string().max(200_000).optional(),
        acceptMethod: z.string().max(60).default("web_checkbox"),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; acceptedAt?: string; error?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("estimate_terms")
      .select(
        "id, user_id, estimate_id, sheet_version, terms_name, terms_version, terms_effective_at, sent_at, sent_msg_id",
      )
      .eq("access_token", data.token)
      .maybeSingle();
    if (error || !row) {
      return { ok: false, error: "링크가 만료되었거나 잘못된 주소입니다." };
    }

    const { data: already } = await supabaseAdmin
      .from("terms_acceptances")
      .select("accepted_at")
      .eq("estimate_terms_id", row.id)
      .maybeSingle();
    if (already) return { ok: true, acceptedAt: already.accepted_at };

    const acceptedAt = new Date().toISOString();
    // 고객이 어떤 기기로 눌렀는지 남깁니다 (접속 정보). 없으면 빈 값으로 둡니다.
    let userAgent = "";
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      userAgent = (getRequest()?.headers.get("user-agent") ?? "").slice(0, 300);
    } catch {
      /* 헤더를 못 읽어도 동의 기록은 남깁니다 */
    }
    /** 어떤 상황에서도 꼭 남겨야 하는 값 */
    const base = {
      estimate_terms_id: row.id,
      user_id: row.user_id,
      estimate_id: row.estimate_id,
      sheet_version: row.sheet_version,
      terms_name: row.terms_name,
      terms_version: row.terms_version,
      terms_effective_at: row.terms_effective_at,
      terms_snapshot: data.termsSnapshot,
      accepted: true,
      accepted_at: acceptedAt,
      accept_method: data.acceptMethod,
      token_hint: data.token.slice(-6),
      sent_at: row.sent_at,
      sent_msg_id: row.sent_msg_id,
    };
    /** 새로 늘린 칸 (견적서 스냅샷·접속 정보·예약 상태) */
    const extra = {
      estimate_snapshot: data.estimateSnapshot ?? null,
      user_agent: userAgent || null,
      reservation_status: "confirmed",
    };

    let insErr = (await supabaseAdmin.from("terms_acceptances").insert({ ...base, ...extra })).error;
    // 데이터베이스에 새 칸이 아직 안 만들어졌으면(마이그레이션 전) 기본 값만이라도 남깁니다.
    // 고객이 동의했는데 기록이 통째로 사라지는 일은 없어야 합니다.
    if (insErr && /column|schema cache/i.test(insErr.message)) {
      console.error("[acceptTerms] 새 칸 없음 — 기본 값만 저장합니다:", insErr.message);
      insErr = (await supabaseAdmin.from("terms_acceptances").insert(base)).error;
    }
    if (insErr) {
      console.error("[acceptTerms]", insErr.message);
      return { ok: false, error: "동의 기록을 저장하지 못했습니다." };
    }
    await supabaseAdmin.from("estimate_terms").update({ viewed_at: acceptedAt }).eq("id", row.id);
    return { ok: true, acceptedAt };
  });

export interface TermsStatusRow {
  estimateId: string;
  /** 보낸 견적서 차수 */
  sheetVersion: number;
  /** 보낸 약관 버전 */
  termsVersion: string;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  acceptMethod: string | null;
  /** 고객이 실제로 동의한 견적서 차수 (동의 전에는 null) */
  acceptedSheetVersion: number | null;
  /** 고객이 실제로 동의한 약관 버전 (동의 전에는 null) */
  acceptedTermsVersion: string | null;
  /** 예약 확정 상태 (동의 전에는 null) */
  reservationStatus: string | null;
}

/**
 * 관리자·업체용 — 내 견적들의 약관 발송·동의 상태.
 *
 * 읽기만 합니다. 업체가 고객 대신 동의를 만들 수는 없습니다
 * (terms_acceptances 에는 업체용 쓰기 정책 자체가 없습니다).
 */
export const getTermsStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ estimateId: z.string().max(80).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; rows: TermsStatusRow[] }> => {
    let q = context.supabase
      .from("estimate_terms")
      .select("id, estimate_id, sheet_version, terms_version, sent_at, viewed_at")
      .eq("user_id", context.userId);
    if (data?.estimateId) q = q.eq("estimate_id", data.estimateId);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(300);
    if (error || !rows) {
      if (error) console.error("[getTermsStatuses]", error.message);
      return { ok: false, rows: [] };
    }
    const { data: accs } = await context.supabase
      .from("terms_acceptances")
      .select(
        "estimate_terms_id, accepted_at, accept_method, sheet_version, terms_version, reservation_status",
      )
      .eq("user_id", context.userId);
    const byId = new Map((accs ?? []).map((a) => [a.estimate_terms_id, a]));
    return {
      ok: true,
      rows: rows.map((r) => {
        const a = byId.get(r.id);
        return {
          estimateId: r.estimate_id,
          sheetVersion: r.sheet_version,
          termsVersion: r.terms_version,
          sentAt: r.sent_at,
          viewedAt: r.viewed_at,
          acceptedAt: a?.accepted_at ?? null,
          acceptMethod: a?.accept_method ?? null,
          acceptedSheetVersion: a?.sheet_version ?? null,
          acceptedTermsVersion: a?.terms_version ?? null,
          reservationStatus: a?.reservation_status ?? null,
        };
      }),
    };
  });
