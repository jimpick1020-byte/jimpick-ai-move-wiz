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
    const { error: insErr } = await supabaseAdmin.from("terms_acceptances").insert({
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
    });
    if (insErr) {
      console.error("[acceptTerms]", insErr.message);
      return { ok: false, error: "동의 기록을 저장하지 못했습니다." };
    }
    await supabaseAdmin.from("estimate_terms").update({ viewed_at: acceptedAt }).eq("id", row.id);
    return { ok: true, acceptedAt };
  });
