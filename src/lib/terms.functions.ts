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
import { requireActiveEntitlement } from "@/lib/entitlement.functions";
import { z } from "zod";

export interface TermsLinkInfo {
  ok: boolean;
  error?: string;
  customerName?: string;
  moveDate?: string | null;
  total?: number;
  contactPhone?: string | null;
  /** 설정에 저장된 현재 상호명 */
  companyName?: string | null;
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
  .middleware([requireActiveEntitlement])
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
    const { data: saved, error } = await context.supabase
      .from("estimate_terms")
      .upsert(
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
      )
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[publishEstimateTerms]", error.message);
      return { ok: false, error: "약관 발송 기록을 저장하지 못했습니다." };
    }
    // 이미 예약이 확정된 견적이면, 바뀐 이사 날짜로 전날 안내 문자를 다시 예약합니다
    const savedId = (saved as { id?: string } | null)?.id;
    if (savedId) {
      try {
        const { syncMoveReminder } = await import("./reminder.server");
        await syncMoveReminder(savedId);
      } catch (e) {
        console.error(
          "[publishEstimateTerms] 안내 문자 재예약 실패",
          e instanceof Error ? e.message : e,
        );
      }
    }
    return { ok: true };
  });

/** 고객용 — 보안 토큰으로 약관 정보와 동의 여부를 읽습니다 */
export const getTermsLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(80) }).parse(d))
  .handler(async ({ data }): Promise<TermsLinkInfo> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("estimate_terms")
      .select(
        "id, user_id, customer_name, move_date, total, contact_phone, terms_name, terms_version, terms_effective_at, sheet_no, sheet_version, sent_at, sheet_snapshot, deposit_paid, deposit_paid_at",
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

    // 공유 견적서도 설정에서 바꾼 최신 상호명을 즉시 사용합니다.
    // 보안 토큰으로 확인된 견적 소유자의 프로필 한 건만 읽습니다.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_name")
      .eq("id", (row as { user_id?: string }).user_id ?? "")
      .maybeSingle();

    return {
      ok: true,
      customerName: row.customer_name,
      moveDate: row.move_date,
      total: row.total,
      contactPhone: row.contact_phone,
      companyName: profile?.company_name?.trim() || null,
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
  .handler(
    async ({
      data,
    }): Promise<{ ok: boolean; acceptedAt?: string; error?: string; full?: boolean }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("estimate_terms")
        .select("id")
        .eq("access_token", data.token)
        .maybeSingle();
      if (error || !row) {
        return { ok: false, error: "링크가 만료되었거나 잘못된 주소입니다." };
      }

      // 고객이 어떤 기기로 눌렀는지 남깁니다 (접속 정보). 없으면 빈 값으로 둡니다.
      let userAgent = "";
      try {
        const { getRequest } = await import("@tanstack/react-start/server");
        userAgent = (getRequest()?.headers.get("user-agent") ?? "").slice(0, 300);
      } catch {
        /* 헤더를 못 읽어도 동의 기록은 남깁니다 */
      }

      // 하루 확정 예약 2건 상한은 데이터베이스 함수에서 원자적으로 확인합니다.
      // (같은 업체·같은 이사 날짜를 잠근 뒤 세고, 2건이면 저장하지 않습니다)
      const { data: res, error: rpcErr } = await supabaseAdmin.rpc("confirm_reservation_atomic", {
        _terms_id: (row as { id: string }).id,
        _terms_snapshot: data.termsSnapshot,
        _estimate_snapshot: data.estimateSnapshot ?? null,
        _accept_method: data.acceptMethod,
        _token_hint: data.token.slice(-6),
        _user_agent: userAgent || null,
      } as never);
      if (rpcErr) {
        console.error("[acceptTerms]", rpcErr.message);
        return { ok: false, error: "동의 기록을 저장하지 못했습니다." };
      }
      const out = (res ?? {}) as {
        ok?: boolean;
        reason?: string;
        duplicate?: boolean;
        accepted_at?: string;
        move_date?: string;
      };
      if (!out.ok) {
        if (out.reason === "full") {
          return {
            ok: false,
            full: true,
            error:
              "해당 날짜는 예약이 마감되었습니다(하루 2건). 업체에 문의해 다른 날짜로 변경해 주세요.",
          };
        }
        return { ok: false, error: "링크가 만료되었거나 잘못된 주소입니다." };
      }

      const acceptedAt = out.accepted_at ?? new Date().toISOString();
      const rowId = (row as { id: string }).id;
      await supabaseAdmin.from("estimate_terms").update({ viewed_at: acceptedAt }).eq("id", rowId);

      // 이미 확정된 건을 다시 누른 경우에는 알림·예약을 다시 만들지 않습니다.
      if (out.duplicate) return { ok: true, acceptedAt };

      // 예약 확정 저장이 성공한 뒤에만 사장님에게 알림 문자를 보냅니다.
      // 문자가 실패해도 고객 동의·예약 확정 기록은 그대로 둡니다.
      await notifyManager(data.token);

      // 예약이 확정됐으니, 이사 전날 18시(한국시간)에 보낼 안내 문자를 예약합니다
      try {
        const { syncMoveReminder } = await import("./reminder.server");
        await syncMoveReminder(rowId);
      } catch (e) {
        console.error("[acceptTerms] 안내 문자 예약 실패", e instanceof Error ? e.message : e);
      }

      return { ok: true, acceptedAt };
    },
  );

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
      .select(
        "estimate_id, status, to_masked, provider_message_id, sent_at, failed_at, error_message",
      )
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
  /** 고객이 링크를 처음 연 일시 */
  firstViewedAt: string | null;
  /** 고객이 가장 최근에 연 일시 */
  lastViewedAt: string | null;
  /** 고객이 링크를 연 횟수 */
  viewCount: number;
  /** 고객이 약관 전문을 본 일시 */
  termsViewedAt: string | null;
  /** 견적 총액 */
  total: number;
  /** 입금 확인된 예약금 */
  depositPaid: number;
  /** 입금 확인된 잔금 */
  balancePaid: number;
  balancePaidAt: string | null;
  /** 결제 진행 상태 */
  paymentStatus: string;
  paymentNote: string | null;
  paymentConfirmedAt: string | null;
}

/** 고객 열람 기록 — 어떤 행동을 남길지 */
export type CustomerViewEvent = "sheet" | "terms";

/**
 * 고객용 — 보안 링크를 열었을 때 열람 기록을 남깁니다.
 *
 * 남기는 값은 견적서·차수·열람 일시·열람 횟수·약관 열람 일시뿐입니다.
 * 접속 IP나 기기 상세정보는 저장하지 않습니다.
 */
export const logCustomerView = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(8).max(80),
        event: z.enum(["sheet", "terms"]).default("sheet"),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("estimate_terms")
      .select("id, view_count, first_viewed_at")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!row) return { ok: false };
    const now = new Date().toISOString();
    const r = row as { id: string; view_count?: number | null; first_viewed_at?: string | null };
    const patch: Record<string, unknown> =
      data.event === "terms"
        ? { terms_viewed_at: now }
        : {
            view_count: Number(r.view_count ?? 0) + 1,
            last_viewed_at: now,
            viewed_at: now,
            first_viewed_at: r.first_viewed_at ?? now,
          };
    const { error } = await supabaseAdmin
      .from("estimate_terms")
      .update(patch as never)
      .eq("id", r.id);
    if (error) {
      console.error("[logCustomerView]", error.message);
      return { ok: false };
    }
    return { ok: true };
  });

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
      .select(
        "id, estimate_id, sheet_version, terms_version, sent_at, viewed_at, first_viewed_at, last_viewed_at, view_count, terms_viewed_at, total, deposit_paid, balance_paid, balance_paid_at, payment_status, payment_note, payment_confirmed_at",
      )
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
      rows: rows.map((raw) => {
        const r = raw as Record<string, unknown>;
        const a = byId.get(String(r["id"]));
        return {
          estimateId: String(r["estimate_id"] ?? ""),
          sheetVersion: Number(r["sheet_version"] ?? 1),
          termsVersion: String(r["terms_version"] ?? ""),
          sentAt: (r["sent_at"] as string | null) ?? null,
          viewedAt: (r["viewed_at"] as string | null) ?? null,
          acceptedAt: a?.accepted_at ?? null,
          acceptMethod: a?.accept_method ?? null,
          acceptedSheetVersion: a?.sheet_version ?? null,
          acceptedTermsVersion: a?.terms_version ?? null,
          reservationStatus: a?.reservation_status ?? null,
          firstViewedAt: (r["first_viewed_at"] as string | null) ?? null,
          lastViewedAt: (r["last_viewed_at"] as string | null) ?? null,
          viewCount: Number(r["view_count"] ?? 0) || 0,
          termsViewedAt: (r["terms_viewed_at"] as string | null) ?? null,
          total: Number(r["total"] ?? 0) || 0,
          depositPaid: Number(r["deposit_paid"] ?? 0) || 0,
          balancePaid: Number(r["balance_paid"] ?? 0) || 0,
          balancePaidAt: (r["balance_paid_at"] as string | null) ?? null,
          paymentStatus: String(r["payment_status"] ?? "unpaid"),
          paymentNote: (r["payment_note"] as string | null) ?? null,
          paymentConfirmedAt: (r["payment_confirmed_at"] as string | null) ?? null,
        };
      }),
    };
  });

/**
 * 날짜별(YYYY-MM-DD) 확정 예약 건수 — 달력에서 예약 1건/마감 표시에 씁니다.
 *
 *  · 로그인한 업체(user_id)의 예약만 셉니다 (RLS + user_id 필터 → 다른 업체와 섞이지 않음).
 *  · 확정 예약 = terms_acceptances 에 동의(accepted_at)가 있고 reservation_status 가
 *    'canceled' 가 아닌 건. (임시 견적·문자만 보낸 상태·취소 건은 제외)
 *  · 화면 표시용 집계입니다. 실제 3번째 예약 차단은 예약 확정 시 서버에서 원자적으로 막아야 합니다.
 */
export interface ReservationRow {
  /** 견적번호 (앱의 견적 id) */
  estimateId: string;
  termsId: string;
  customerName: string;
  moveDate: string;
  total: number;
  sheetNo: string | null;
  acceptedAt: string | null;
}

export const getReservationCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      ok: boolean;
      counts: Record<string, number>;
      reservations: Record<string, ReservationRow[]>;
    }> => {
      const { data: terms, error } = await context.supabase
        .from("estimate_terms")
        .select("id, estimate_id, move_date, customer_name, total, sheet_no, sheet_version")
        .eq("user_id", context.userId)
        .not("move_date", "is", null)
        .limit(2000);
      if (error || !terms) {
        if (error) console.error("[getReservationCounts]", error.message);
        return { ok: false, counts: {}, reservations: {} };
      }
      const { data: accs } = await context.supabase
        .from("terms_acceptances")
        .select("estimate_terms_id, accepted_at, reservation_status")
        .eq("user_id", context.userId);
      // 확정(동의 O · 취소 X)된 약관 id → 동의 일시
      const confirmed = new Map<string, string | null>();
      for (const a of (accs ?? []) as {
        estimate_terms_id?: string;
        accepted_at?: string | null;
        reservation_status?: string | null;
      }[]) {
        if (!a.accepted_at) continue;
        if (String(a.reservation_status ?? "confirmed") === "canceled") continue;
        confirmed.set(String(a.estimate_terms_id ?? ""), a.accepted_at ?? null);
      }

      // 같은 견적번호(estimate_id)는 여러 차수(버전)로 저장될 수 있습니다.
      // 계약은 견적 1건이므로 견적번호 기준으로 최신 차수 하나만 셉니다.
      const byEstimate = new Map<string, ReservationRow & { version: number }>();
      for (const row of terms as {
        id: string;
        estimate_id: string;
        move_date: string | null;
        customer_name: string | null;
        total: number | null;
        sheet_no: string | null;
        sheet_version: number | null;
      }[]) {
        if (!row.move_date) continue;
        const acceptedAt = confirmed.get(String(row.id));
        if (acceptedAt === undefined) continue;
        const key = String(row.estimate_id);
        const version = Number(row.sheet_version ?? 0);
        const prev = byEstimate.get(key);
        if (prev && prev.version >= version) continue;
        byEstimate.set(key, {
          version,
          estimateId: key,
          termsId: String(row.id),
          customerName: row.customer_name ?? "",
          moveDate: String(row.move_date).slice(0, 10),
          total: Number(row.total ?? 0),
          sheetNo: row.sheet_no ?? null,
          acceptedAt: acceptedAt ?? null,
        });
      }

      const counts: Record<string, number> = {};
      const reservations: Record<string, ReservationRow[]> = {};
      for (const r of byEstimate.values()) {
        counts[r.moveDate] = (counts[r.moveDate] ?? 0) + 1;
        (reservations[r.moveDate] ??= []).push({
          estimateId: r.estimateId,
          termsId: r.termsId,
          customerName: r.customerName,
          moveDate: r.moveDate,
          total: r.total,
          sheetNo: r.sheetNo,
          acceptedAt: r.acceptedAt,
        });
      }
      return { ok: true, counts, reservations };
    },
  );

/**
 * 확정 예약 취소 — 업체 본인 예약만.
 * 같은 견적번호를 여러 차수(수정본)로 보낸 경우 모든 차수의 동의 기록을 함께 취소해야
 * 달력에서 즉시 빠집니다. (한 차수만 취소하면 이전 차수가 남아 계속 마감으로 보였습니다)
 */
export const cancelReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ termsId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ ok: boolean; error?: string }> => {
    // 동의 기록은 직접 수정할 수 없으므로(보안 규칙) 서버 전용 취소 기능으로 처리합니다.
    // 같은 견적의 모든 차수를 함께 취소해 달력에서 다시 살아나지 않게 합니다.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("cancel_reservation_all_for", {
      _terms_id: data.termsId,
      _user_id: context.userId,
    });
    if (error) {
      console.error("[cancelReservation]", error.message);
      return { ok: false, error: "예약을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요." };
    }
    const out = (res ?? {}) as { ok?: boolean; canceled?: number };
    if (!out.ok || Number(out.canceled ?? 0) < 1) {
      return {
        ok: false,
        error: "예약을 취소하지 못했습니다. 화면을 새로 고친 뒤 다시 시도해 주세요.",
      };
    }
    return { ok: true };
  });

/**
 * 계약(확정 예약)의 견적서 원본을 서버에서 불러옵니다.
 *
 * 이 기기(localStorage)에 견적이 없어도 달력에서 계약 견적서를 열 수 있게,
 * 발송 때 저장해 둔 sheet_snapshot(견적서 원본 JSON)과 estimate_terms 의 실제
 * 고객 이름을 그대로 돌려줍니다. 본인(user_id) 계약만 조회합니다(RLS).
 * 반환하는 estimate 는 견적서 화면(EstimateSheet)이 그대로 그리는 draft 객체입니다.
 */
export const getReservationSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ termsId: z.string().uuid() }).parse(d))
  .handler(
    async ({
      context,
      data,
    }): Promise<{ ok: boolean; estimateJson?: string; customerName?: string; error?: string }> => {
      const { data: row, error } = await context.supabase
        .from("estimate_terms")
        .select("estimate_id, customer_name, move_date, total, sheet_no, sheet_snapshot")
        .eq("id", data.termsId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (error) {
        console.error("[getReservationSheet]", error.message);
        return { ok: false, error: "견적서를 불러오지 못했습니다." };
      }
      if (!row) return { ok: false, error: "견적서를 찾을 수 없습니다." };

      const r = row as {
        estimate_id: string;
        customer_name: string | null;
        move_date: string | null;
        total: number | null;
        sheet_no: string | null;
        sheet_snapshot: string | null;
      };
      // 계약(estimate_terms)에 저장된 이름이 정답입니다. 스냅샷보다 우선합니다.
      const customerName = (r.customer_name ?? "").trim();

      // 발송 때 저장한 견적서 원본이 있으면 그대로 씁니다.
      let draft: Record<string, unknown> | null = null;
      if (r.sheet_snapshot) {
        try {
          const snap = JSON.parse(r.sheet_snapshot) as { draft?: Record<string, unknown> };
          if (snap?.draft && typeof snap.draft === "object") draft = { ...snap.draft };
        } catch {
          /* 스냅샷이 깨졌으면 아래 최소 정보로 대체합니다 */
        }
      }
      if (!draft) {
        // 스냅샷이 없으면 최소한의 정보라도 채워 견적서 화면이 뜨게 합니다.
        draft = {
          id: r.estimate_id,
          sheetNo: r.sheet_no ?? "",
          moveDate: r.move_date ?? "",
          total: Number(r.total ?? 0),
        };
      }
      // 견적번호·고객 이름은 계약 기준으로 항상 올바르게 맞춰 줍니다.
      draft["id"] = r.estimate_id;
      draft["customerName"] = customerName;
      if (r.sheet_no) draft["sheetNo"] = r.sheet_no;

      // 견적서 원본(draft)은 JSON 문자열로 돌려주고 화면에서 파싱합니다(직렬화 안전).
      return { ok: true, estimateJson: JSON.stringify(draft), customerName };
    },
  );

/**
 * 고객 이름을 나중에 알게 되었을 때, 그 견적번호에 연결된 계약·입금·안내문자 기록의
 * 고객 이름을 최신 이름으로 함께 맞춰 줍니다.
 *
 * - 본인(user_id) 견적만 바꿉니다.
 * - 이름 외의 값(연락처·주소·이사 날짜·금액·계약 상태)은 건드리지 않습니다.
 * - 빈 이름으로는 덮어쓰지 않습니다.
 */
export const renameReservationCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ estimateId: z.string().min(1), customerName: z.string().trim().min(1).max(60) })
      .parse(d),
  )
  .handler(
    async ({ context, data }): Promise<{ ok: boolean; updated: number; error?: string }> => {
      const name = data.customerName.trim();
      // 내 계약인지 먼저 확인합니다(다른 업체 계약은 절대 바꾸지 않습니다).
      const { data: mine, error: findErr } = await context.supabase
        .from("estimate_terms")
        .select("id")
        .eq("user_id", context.userId)
        .eq("estimate_id", data.estimateId);
      if (findErr) {
        console.error("[renameReservationCustomer] find", findErr.message);
        return { ok: false, updated: 0, error: "고객 이름을 저장하지 못했습니다." };
      }
      if (!mine?.length) return { ok: true, updated: 0 };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await supabaseAdmin
        .from("estimate_terms")
        .update({ customer_name: name, updated_at: new Date().toISOString() })
        .eq("user_id", context.userId)
        .eq("estimate_id", data.estimateId)
        .select("id");
      if (error) {
        console.error("[renameReservationCustomer] update", error.message);
        return { ok: false, updated: 0, error: "고객 이름을 저장하지 못했습니다." };
      }
      // 입금 기록·이사 전날 안내문자에 표시되는 이름도 같이 맞춥니다(실패해도 계약 이름은 유지).
      await supabaseAdmin
        .from("deposit_records")
        .update({ customer_name: name, updated_at: new Date().toISOString() })
        .eq("user_id", context.userId)
        .eq("estimate_id", data.estimateId);
      await supabaseAdmin
        .from("move_reminders")
        .update({ customer_name: name, updated_at: new Date().toISOString() })
        .eq("user_id", context.userId)
        .eq("estimate_id", data.estimateId)
        .is("sent_at", null);
      return { ok: true, updated: rows?.length ?? 0 };
    },
  );

/**
 * 그 견적번호의 계약에 저장된 "최신" 고객 이름을 읽습니다.
 * 값을 확인하지 못하면 이름을 돌려주지 않습니다(임의로 덮어쓰지 않기 위해).
 */
export const getReservationCustomerName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ estimateId: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }): Promise<{ ok: boolean; customerName?: string }> => {
    const { data: rows, error } = await context.supabase
      .from("estimate_terms")
      .select("customer_name, sheet_version, updated_at")
      .eq("user_id", context.userId)
      .eq("estimate_id", data.estimateId)
      .order("sheet_version", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error || !rows?.length) return { ok: false };
    const name = String((rows[0] as { customer_name: string | null }).customer_name ?? "").trim();
    if (!name) return { ok: false };
    return { ok: true, customerName: name };
  });
