import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface BankSmsRow {
  id: string;
  channel: string;
  rawText: string;
  receivedAt: string;
  depositorName: string;
  amount: number;
  bank: string;
  matchStatus: "matched" | "review" | "unmatched" | "ignored";
  matchNote: string;
  candidates: Array<{ estimateId: string; customerName: string }>;
  matchedEstimateId: string | null;
  matchedCustomerName: string | null;
  paymentKind: "deposit" | "balance" | null;
  receiptStatus: string | null;
}

/** 사장님이 은행 입금 문자를 붙여넣어 등록합니다 */
export const submitBankSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(1).max(4000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { ingestBankSms } = await import("./bank-sms.server");
    return ingestBankSms(context.supabase, context.userId, { rawText: data.text, channel: "paste" });
  });

export const listBankSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: BankSmsRow[]; openEstimates: Array<{ estimateId: string; customerName: string }> }> => {
    const { data, error } = await context.supabase
      .from("bank_sms_messages")
      .select("id,channel,raw_text,received_at,depositor_name,amount,bank,match_status,match_note,candidate_estimate_ids,matched_estimate_id,payment_kind,deposit_record_id")
      .eq("company_id", context.userId)
      .order("received_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("입금 문자를 불러오지 못했습니다.");
    const { loadCandidates } = await import("./bank-sms.server");
    const all = await loadCandidates(context.supabase, context.userId);
    const nameOf = new Map(all.map((c) => [c.estimateId, c.customerName]));
    const recIds = (data ?? []).map((r) => r.deposit_record_id).filter(Boolean) as string[];
    const { data: recs } = recIds.length
      ? await context.supabase.from("deposit_records").select("id,status").eq("user_id", context.userId).in("id", recIds)
      : { data: [] as Array<{ id: string; status: string }> };
    const recStatus = new Map((recs ?? []).map((r) => [r.id, r.status]));
    const open = all.filter((c) => !c.contractCancelled && !["completed", "canceled", "refunded"].includes(c.paymentStatus));
    return {
      rows: (data ?? []).map((r) => ({
        id: r.id,
        channel: r.channel,
        rawText: r.raw_text,
        receivedAt: r.received_at,
        depositorName: r.depositor_name ?? "",
        amount: Number(r.amount ?? 0),
        bank: r.bank ?? "",
        matchStatus: r.match_status as BankSmsRow["matchStatus"],
        matchNote: r.match_note ?? "",
        candidates: (r.candidate_estimate_ids ?? []).map((id: string) => ({ estimateId: id, customerName: nameOf.get(id) ?? id })),
        matchedEstimateId: r.matched_estimate_id,
        matchedCustomerName: r.matched_estimate_id ? nameOf.get(r.matched_estimate_id) ?? null : null,
        paymentKind: (r.payment_kind as BankSmsRow["paymentKind"]) ?? null,
        receiptStatus: r.deposit_record_id ? recStatus.get(r.deposit_record_id) ?? null : null,
      })),
      openEstimates: open.map((c) => ({ estimateId: c.estimateId, customerName: c.customerName })),
    };
  });

/** 확인 필요·미연결 문자를 사장님이 고른 견적에 연결합니다 (결제완료는 하지 않습니다) */
export const linkBankSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), estimateId: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { data: msg } = await context.supabase.from("bank_sms_messages").select("id,depositor_name,amount,deposited_at,raw_text,match_status,deposit_record_id").eq("id", data.id).eq("company_id", context.userId).maybeSingle();
    if (!msg) return { ok: false, error: "문자를 찾지 못했습니다." };
    if (msg.deposit_record_id) return { ok: true };
    if (!(Number(msg.amount) > 0)) return { ok: false, error: "금액을 읽지 못한 문자는 연결할 수 없습니다." };
    const { loadCandidates, attachReceipt } = await import("./bank-sms.server");
    const { customerPaymentDue } = await import("./customer-payment");
    const target = (await loadCandidates(context.supabase, context.userId)).find((c) => c.estimateId === data.estimateId);
    if (!target || target.contractCancelled || ["completed", "canceled", "refunded"].includes(target.paymentStatus)) return { ok: false, error: "연결할 수 없는 견적입니다." };
    const kind = customerPaymentDue(target.total, target.depositPaid, target.balancePaid, target.paymentStatus).kind;
    try {
      const recordId = await attachReceipt(context.supabase, context.userId, msg, data.estimateId, kind);
      await context.supabase.from("bank_sms_messages").update({ match_status: "matched", match_note: "사장님이 직접 연결", matched_estimate_id: data.estimateId, payment_kind: kind, deposit_record_id: recordId }).eq("id", data.id).eq("company_id", context.userId);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "연결하지 못했습니다." };
    }
  });

export const ignoreBankSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("bank_sms_messages").update({ match_status: "ignored", match_note: "사장님이 제외" }).eq("id", data.id).eq("company_id", context.userId).is("deposit_record_id", null);
    return { ok: !error };
  });

/** 자동 전달 주소용 비밀 열쇠를 새로 만듭니다 (원문은 이번 한 번만 보여 줍니다) */
export const createBankSmsToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; token?: string; error?: string }> => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { sha256Hex } = await import("./bank-sms.server");
    const { error } = await context.supabase.from("bank_sms_ingest_tokens").upsert({ company_id: context.userId, token_hash: await sha256Hex(token), created_at: new Date().toISOString(), last_received_at: null }, { onConflict: "company_id" });
    if (error) return { ok: false, error: "주소를 만들지 못했습니다." };
    return { ok: true, token };
  });

export const getBankSmsTokenStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("bank_sms_ingest_tokens").select("created_at,last_received_at").eq("company_id", context.userId).maybeSingle();
    return { exists: Boolean(data), createdAt: data?.created_at ?? null, lastReceivedAt: data?.last_received_at ?? null };
  });
