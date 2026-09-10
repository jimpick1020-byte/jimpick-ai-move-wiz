/**
 * 예약금 입금 확인.
 *
 *  - registerDeposit : 은행 입금알림 문자를 붙여넣으면 입금자·금액을 읽어 기록합니다.
 *                      입금자 이름이 고객 이름과 같으면 바로 반영하고,
 *                      다른 이름이면 반영하지 않고 「확인 대기」로 남깁니다.
 *  - confirmDeposit  : 사장님이 직접 확인한 입금을 반영합니다.
 *  - rejectDeposit   : 우리 고객 입금이 아닌 것으로 처리합니다.
 *  - listDeposits    : 입금 기록을 읽습니다.
 *
 * 반영이란: 견적서에 「받은 예약금」을 저장해서 고객 화면의 예약금·잔금이 바뀌고,
 * 고객에게 입금 확인 문자가 한 번 나가는 것을 말합니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { parseDepositSms, isSameName, normalizeName } from "./deposit-parse";

export interface DepositRow {
  id: string;
  estimateId: string;
  sheetNo: string | null;
  depositorName: string;
  customerName: string;
  amount: number;
  depositedAt: string | null;
  status: "confirmed" | "pending_review" | "rejected";
  nameMatched: boolean;
  source: string;
  rawText: string | null;
  notifiedAt: string | null;
  notifyError: string | null;
  createdAt: string;
}

interface RowDb {
  id: string;
  estimate_id: string;
  sheet_no: string | null;
  depositor_name: string | null;
  customer_name: string | null;
  amount: number | null;
  deposited_at: string | null;
  status: string | null;
  name_matched: boolean | null;
  source: string | null;
  raw_text: string | null;
  notified_at: string | null;
  notify_error: string | null;
  created_at: string;
}

function toRow(d: RowDb): DepositRow {
  const s = String(d.status ?? "pending_review");
  return {
    id: d.id,
    estimateId: d.estimate_id,
    sheetNo: d.sheet_no,
    depositorName: String(d.depositor_name ?? ""),
    customerName: String(d.customer_name ?? ""),
    amount: Number(d.amount ?? 0),
    depositedAt: d.deposited_at,
    status: (s === "confirmed" || s === "rejected" ? s : "pending_review") as DepositRow["status"],
    nameMatched: d.name_matched === true,
    source: String(d.source ?? "sms_paste"),
    rawText: d.raw_text,
    notifiedAt: d.notified_at,
    notifyError: d.notify_error,
    createdAt: d.created_at,
  };
}

const SELECT =
  "id,estimate_id,sheet_no,depositor_name,customer_name,amount,deposited_at,status,name_matched,source,raw_text,notified_at,notify_error,created_at";

/** 고객에게 입금 확인 문자를 보냅니다 (문자 열쇠는 발송 서버에만 있습니다) */
async function notifyCustomer(estimateId: string): Promise<{ ok: boolean; error?: string }> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return { ok: false, error: "발송 서버 설정이 없습니다." };
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/functions/v1/send-estimate-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ mode: "deposit_notify", estimate_id: estimateId }),
    });
    const body = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!r.ok || !body?.ok) {
      return { ok: false, error: body?.error ?? `입금 확인 문자 발송 실패 (${r.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "연결 오류" };
  }
}

/**
 * 확인된 입금만 더해서 견적서의 「받은 예약금」을 다시 계산합니다.
 * 확인 대기·거절된 입금은 절대 금액에 넣지 않습니다.
 */


async function recalcAndSave(
  context: { supabase: any; userId: string },
  estimateId: string,
): Promise<number> {
  const { data } = await context.supabase
    .from("deposit_records")
    .select("amount")
    .eq("user_id", context.userId)
    .eq("estimate_id", estimateId)
    .eq("status", "confirmed");
  const paid = (data ?? []).reduce(
    (s: number, r: { amount: number | null }) => s + (Number(r.amount) || 0),
    0,
  );
  await context.supabase
    .from("estimate_terms")
    .update({ deposit_paid: paid, deposit_paid_at: paid > 0 ? new Date().toISOString() : null })
    .eq("user_id", context.userId)
    .eq("estimate_id", estimateId);
  return paid;
}

export interface RegisterDepositResult {
  ok: boolean;
  error?: string;
  /** 자동 반영됐는지 (이름이 같을 때만 true) */
  applied?: boolean;
  /** 이름이 달라 사장님 확인이 필요한지 */
  needsReview?: boolean;
  row?: DepositRow;
  paid?: number;
  /** 고객 문자 결과 */
  smsError?: string;
  duplicated?: boolean;
}

/** 은행 입금알림 문자를 붙여넣어 입금을 기록합니다 */
export const registerDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        estimateId: z.string().min(1).max(80),
        /** 은행 입금알림 문자 원문 */
        text: z.string().max(4000).default(""),
        /** 직접 입력하는 경우 */
        depositorName: z.string().max(60).optional(),
        amount: z.number().int().min(0).max(1_000_000_000).optional(),
        depositedAt: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<RegisterDepositResult> => {
    const parsed = parseDepositSms(data.text ?? "");
    const depositorName = (data.depositorName ?? parsed.depositorName ?? "").trim();
    const amount = Number(data.amount ?? parsed.amount ?? 0) || 0;
    const depositedAt = data.depositedAt ?? parsed.depositedAt ?? new Date().toISOString();
    if (amount <= 0) {
      return { ok: false, error: "입금 금액을 읽지 못했습니다. 금액을 직접 입력해 주세요." };
    }

    const { data: terms, error: tErr } = await context.supabase
      .from("estimate_terms")
      .select("id,estimate_id,sheet_no,sheet_version,customer_name,total")
      .eq("user_id", context.userId)
      .eq("estimate_id", data.estimateId)
      .order("sheet_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tErr || !terms) {
      return { ok: false, error: "이 견적서를 찾지 못했습니다. 견적서를 먼저 확정·발송해 주세요." };
    }

    const customerName = String(terms.customer_name ?? "");
    const matched = isSameName(depositorName, customerName);
    const dedupeKey = [
      data.estimateId,
      amount,
      depositedAt.slice(0, 16),
      normalizeName(depositorName),
    ].join("|");

    const insert = {
      user_id: context.userId,
      estimate_id: data.estimateId,
      sheet_no: terms.sheet_no ?? null,
      estimate_version: Number(terms.sheet_version ?? 1),
      depositor_name: depositorName,
      customer_name: customerName,
      amount,
      deposited_at: depositedAt,
      source: data.text ? "sms_paste" : "manual",
      raw_text: (data.text ?? "").slice(0, 2000) || null,
      name_matched: matched,
      status: matched ? "confirmed" : "pending_review",
      confirmed_at: matched ? new Date().toISOString() : null,
      confirmed_by: matched ? context.userId : null,
      dedupe_key: dedupeKey,
    };

    const { data: created, error: insErr } = await context.supabase
      .from("deposit_records")
      .insert(insert)
      .select(SELECT)
      .maybeSingle();
    if (insErr) {
      if (/duplicate key|unique/i.test(insErr.message)) {
        return { ok: false, duplicated: true, error: "이미 기록된 입금 문자입니다." };
      }
      console.error("[registerDeposit]", insErr.message);
      return { ok: false, error: "입금 기록을 저장하지 못했습니다." };
    }

    if (!matched) {
      return {
        ok: true,
        applied: false,
        needsReview: true,
        row: created ? toRow(created as RowDb) : undefined,
      };
    }

    const paid = await recalcAndSave(context, data.estimateId);
    const sms = await notifyCustomer(data.estimateId);
    if (created && !sms.ok) {
      await context.supabase
        .from("deposit_records")
        .update({ notify_error: (sms.error ?? "").slice(0, 300) })
        .eq("id", (created as RowDb).id);
    } else if (created) {
      await context.supabase
        .from("deposit_records")
        .update({ notified_at: new Date().toISOString(), notify_error: null })
        .eq("id", (created as RowDb).id);
    }
    return {
      ok: true,
      applied: true,
      needsReview: false,
      row: created ? toRow(created as RowDb) : undefined,
      paid,
      smsError: sms.ok ? undefined : sms.error,
    };
  });

/** 사장님이 직접 확인한 입금을 반영합니다 */
export const confirmDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().max(200).optional() }).parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: boolean; error?: string; paid?: number; smsError?: string }> => {
      const { data: row, error } = await context.supabase
        .from("deposit_records")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_by: context.userId,
          review_note: data.note ?? "사장님이 직접 확인",
        })
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select("id,estimate_id")
        .maybeSingle();
      if (error || !row) return { ok: false, error: "입금 기록을 찾지 못했습니다." };
      const paid = await recalcAndSave(context, String(row.estimate_id));
      const sms = await notifyCustomer(String(row.estimate_id));
      await context.supabase
        .from("deposit_records")
        .update(
          sms.ok
            ? { notified_at: new Date().toISOString(), notify_error: null }
            : { notify_error: (sms.error ?? "").slice(0, 300) },
        )
        .eq("id", data.id);
      return { ok: true, paid, smsError: sms.ok ? undefined : sms.error };
    },
  );

/** 우리 고객 입금이 아닌 것으로 처리합니다 (금액에 넣지 않습니다) */
export const rejectDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string; paid?: number }> => {
    const { data: row, error } = await context.supabase
      .from("deposit_records")
      .update({
        status: "rejected",
        review_note: data.note ?? "사장님이 우리 입금이 아니라고 확인",
        confirmed_at: null,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id,estimate_id")
      .maybeSingle();
    if (error || !row) return { ok: false, error: "입금 기록을 찾지 못했습니다." };
    const paid = await recalcAndSave(context, String(row.estimate_id));
    return { ok: true, paid };
  });

/** 입금 기록을 읽습니다 */
export const listDeposits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ estimateId: z.string().max(80).optional() }).parse(d ?? {}),
  )
  .handler(
    async ({ data, context }): Promise<{ ok: boolean; rows: DepositRow[]; paid: number }> => {
      let q = context.supabase.from("deposit_records").select(SELECT).eq("user_id", context.userId);
      if (data?.estimateId) q = q.eq("estimate_id", data.estimateId);
      const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(300);
      if (error || !rows) {
        if (error) console.error("[listDeposits]", error.message);
        return { ok: false, rows: [], paid: 0 };
      }
      const list = (rows as RowDb[]).map(toRow);
      const paid = list
        .filter((r) => r.status === "confirmed")
        .reduce((s, r) => s + r.amount, 0);
      return { ok: true, rows: list, paid };
    },
  );

export { applyPaid };
