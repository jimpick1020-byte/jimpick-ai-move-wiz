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
  /** 보낼 때의 견적서 원본(JSON 글). 고객 화면에 그대로 그립니다 */
  sheetSnapshot?: string | null;
  /** 실제로 입금 확인된 예약금 (원). 확인되지 않은 입금은 들어가지 않습니다 */
  depositPaid?: number;
  /** 예약금 입금이 확인된 일시 */
  depositPaidAt?: string | null;
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
        /** 문자에 적는 업체 연락처 (문의처) */
        companyPhone: z.string().max(40).optional(),
        termsName: z.string().min(1).max(120),
        termsVersion: z.string().min(1).max(40),
        termsEffectiveAt: z.string().max(20).optional(),
        accessToken: z.string().min(8).max(80),
        sentAt: z.number().optional(),
        sentMsgId: z.string().max(80).optional(),
        /** 보낼 때의 견적서 원본(JSON 글) — 고객 화면에 그대로 보여 줍니다 */
        sheetSnapshot: z.string().max(300_000).optional(),
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
        company_phone: data.companyPhone ?? null,
        terms_name: data.termsName,
        terms_version: data.termsVersion,
        terms_effective_at: data.termsEffectiveAt ?? null,
        access_token: data.accessToken,
        sent_at: new Date(data.sentAt ?? Date.now()).toISOString(),
        sent_msg_id: data.sentMsgId ?? null,
        sheet_snapshot: data.sheetSnapshot ?? null,
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
        "id, customer_name, move_date, total, contact_phone, terms_name, terms_version, terms_effective_at, sheet_no, sheet_version, sent_at, sheet_snapshot, deposit_paid, deposit_paid_at",
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
      sheetSnapshot: (row as { sheet_snapshot?: string | null }).sheet_snapshot ?? null,
      depositPaid: Number((row as { deposit_paid?: number | null }).deposit_paid ?? 0) || 0,
      depositPaidAt: (row as { deposit_paid_at?: string | null }).deposit_paid_at ?? null,
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

    // 예약 확정 저장이 성공한 뒤에만 사장님에게 알림 문자를 보냅니다.
    // 문자가 실패해도 고객 동의·예약 확정 기록은 그대로 둡니다.
    await notifyManager(data.token);

    return { ok: true, acceptedAt };
  });

/**
 * 사장님 예약확정 알림 문자를 요청합니다.
 *
 * 문자 보내는 열쇠(알리고 키·중계 비밀값)는 발송 서버에만 있고,
 * 이 함수는 「이 보안 링크의 예약이 확정됐다」만 알려 줍니다.
 * 같은 견적·같은 차수는 발송 서버가 한 번만 보냅니다.
 */
async function notifyManager(token: string): Promise<void> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    console.error("[notifyManager] 발송 서버 설정이 없어 사장님 알림을 보내지 못했습니다.");
    return;
  }
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/functions/v1/send-estimate-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ mode: "manager_notify", token }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.error("[notifyManager] 실패", r.status, body.slice(0, 300));
    }
  } catch (e) {
    console.error("[notifyManager] 연결 오류", e instanceof Error ? e.message : e);
  }
}

export interface ManagerNoticeRow {
  estimateId: string;
  status: string;
  toMasked: string;
  msgId: string | null;
  sentAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
}

/** 관리자·업체용 — 사장님 예약확정 알림 발송 기록 */
export const getManagerNotices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; rows: ManagerNoticeRow[] }> => {
    const { data, error } = await context.supabase
      .from("estimate_deliveries")
      .select("estimate_id, status, to_masked, provider_message_id, sent_at, failed_at, error_message")
      .eq("user_id", context.userId)
      .eq("delivery_method", "manager_notification")
      .order("requested_at", { ascending: false })
      .limit(300);
    if (error || !data) {
      if (error) console.error("[getManagerNotices]", error.message);
      return { ok: false, rows: [] };
    }
    return {
      ok: true,
      rows: data.map((d) => ({
        estimateId: String(d.estimate_id ?? ""),
        status: String(d.status ?? ""),
        toMasked: String(d.to_masked ?? ""),
        msgId: d.provider_message_id ?? null,
        sentAt: d.sent_at ?? null,
        failedAt: d.failed_at ?? null,
        errorMessage: d.error_message ?? null,
      })),
    };
  });

export interface OwnerEstimateDetail {
  ok: boolean;
  error?: string;
  estimateId?: string;
  sheetNo?: string | null;
  sheetVersion?: number;
  customerName?: string;
  contactPhone?: string | null;
  moveDate?: string | null;
  total?: number;
  termsName?: string;
  termsVersion?: string;
  termsEffectiveAt?: string | null;
  /** 보낼 때의 견적서 원본(JSON 글) — 사장님 화면에 그대로 그립니다 */
  sheetSnapshot?: string | null;
  /** 실제로 입금 확인된 예약금 (원) */
  depositPaid?: number;
  depositPaidAt?: string | null;
  /** 잔금 = 총 견적금액 - 예약금 (음수 없음) */
  balanceDue?: number;
  sentAt?: string | null;
  /** 고객 동의·예약 확정 정보 (동의 전에는 null) */
  acceptedAt?: string | null;
  acceptMethod?: string | null;
  acceptedSheetVersion?: number | null;
  acceptedTermsVersion?: string | null;
  reservationStatus?: string | null;
}

/**
 * 관리자·업체용 — 예약확정 알림 문자의 관리자 링크로 여는 「이 고객 한 건」 상세.
 *
 * 보안: 로그인한 본인(user_id) 견적만 읽습니다. 주소의 견적번호를 남의 것으로 바꿔도
 * 본인 소유가 아니면 찾지 못합니다(서버에서 user_id 로 거르고, RLS 도 함께 막습니다).
 * 토큰을 주소에 넣지 않으므로 토큰 노출·유출 위험이 없습니다.
 */
export const getOwnerEstimateDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ estimateId: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<OwnerEstimateDetail> => {
    const { data: rows, error } = await context.supabase
      .from("estimate_terms")
      .select(
        "id, estimate_id, sheet_no, sheet_version, customer_name, contact_phone, move_date, total, terms_name, terms_version, terms_effective_at, sheet_snapshot, deposit_paid, deposit_paid_at, sent_at",
      )
      .eq("user_id", context.userId)
      .eq("estimate_id", data.estimateId)
      .order("sheet_version", { ascending: false })
      .limit(1);
    if (error) {
      console.error("[getOwnerEstimateDetail]", error.message);
      return { ok: false, error: "견적서를 불러오지 못했습니다." };
    }
    const row = rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      return { ok: false, error: "이 견적서를 볼 권한이 없거나 찾을 수 없습니다." };
    }

    const { data: acc } = await context.supabase
      .from("terms_acceptances")
      .select("accepted_at, accept_method, sheet_version, terms_version, reservation_status")
      .eq("estimate_terms_id", row.id as string)
      .maybeSingle();

    const total = Number(row.total ?? 0) || 0;
    const depositPaid = Math.max(0, Number(row.deposit_paid ?? 0) || 0);
    const balanceDue = Math.max(0, total - Math.min(depositPaid, total));

    return {
      ok: true,
      estimateId: String(row.estimate_id ?? ""),
      sheetNo: (row.sheet_no as string | null) ?? null,
      sheetVersion: Number(row.sheet_version ?? 1),
      customerName: String(row.customer_name ?? ""),
      contactPhone: (row.contact_phone as string | null) ?? null,
      moveDate: (row.move_date as string | null) ?? null,
      total,
      termsName: String(row.terms_name ?? ""),
      termsVersion: String(row.terms_version ?? ""),
      termsEffectiveAt: (row.terms_effective_at as string | null) ?? null,
      sheetSnapshot: (row.sheet_snapshot as string | null) ?? null,
      depositPaid,
      depositPaidAt: (row.deposit_paid_at as string | null) ?? null,
      balanceDue,
      sentAt: (row.sent_at as string | null) ?? null,
      acceptedAt: acc?.accepted_at ?? null,
      acceptMethod: acc?.accept_method ?? null,
      acceptedSheetVersion: acc?.sheet_version ?? null,
      acceptedTermsVersion: acc?.terms_version ?? null,
      reservationStatus: acc?.reservation_status ?? null,
    };
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
