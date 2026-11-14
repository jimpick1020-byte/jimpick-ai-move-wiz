/**
 * 은행 입금 문자 처리 (서버 전용).
 *
 * 수신 → 원문 저장 → 입금 정보 추출 → 중복 검사 → 견적 매칭 → 입금 기록 연결.
 * 원문은 매칭 결과와 관계없이 먼저 저장되어 「입금 문자」 화면에 항상 보입니다.
 * 입금 감지만으로 결제완료하지 않습니다. 사장님 확인은 기존 확인 RPC가 담당합니다.
 */
import { parseDepositSms } from "./deposit-parse";
import { bankSmsDedupeKey, matchBankSms, normalizeSmsText, type MatchCandidate } from "./bank-sms-match";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function loadCandidates(client: Client, companyId: string): Promise<MatchCandidate[]> {
  const { data, error } = await client
    .from("estimate_terms")
    .select("estimate_id,sheet_version,created_at,customer_name,total,deposit_paid,balance_paid,payment_status,contract_status")
    .eq("user_id", companyId)
    .is("deleted_at", null)
    .order("sheet_version", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error("견적 목록을 읽지 못했습니다.");
  const latest = new Map<string, MatchCandidate>();
  for (const r of data ?? []) {
    const id = String(r.estimate_id ?? "");
    if (!id || latest.has(id)) continue;
    latest.set(id, {
      estimateId: id,
      customerName: String(r.customer_name ?? ""),
      total: Number(r.total ?? 0),
      depositPaid: Number(r.deposit_paid ?? 0),
      balancePaid: Number(r.balance_paid ?? 0),
      paymentStatus: String(r.payment_status ?? "unpaid"),
      contractCancelled: String(r.contract_status ?? "active") === "cancelled",
    });
  }
  return [...latest.values()];
}

/** 매칭된 견적에 입금 기록을 연결합니다. 같은 종류·금액의 확인 대기 기록(고객 「입금했습니다」)이 있으면 그 기록에 연결해 이중 집계를 막습니다. */
export async function attachReceipt(
  _client: Client,
  companyId: string,
  msg: { id: string; depositor_name: string | null; amount: number | null; deposited_at: string | null; raw_text: string },
  estimateId: string,
  kind: "deposit" | "balance",
): Promise<string> {
  // 회사+견적 잠금 안에서 원문 ID 중복 확인 → 미연결 고객 신고 1:1 연결 → 새 기록 순으로 처리합니다 (서버 전용 함수).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("record_bank_receipt" as never, {
    p_company: companyId,
    p_estimate: estimateId,
    p_kind: kind,
    p_amount: Number(msg.amount ?? 0),
    p_depositor: String(msg.depositor_name ?? ""),
    p_deposited_at: msg.deposited_at ?? new Date().toISOString(),
    p_raw: msg.raw_text,
    p_source: "sms_paste",
    p_dedupe: `banksms|${msg.id}`,
    p_note: "은행 입금 문자에서 연결했습니다. 사장님 확인이 필요합니다.",
    p_name_matched: true,
  } as never);
  const r = data as { ok?: boolean; id?: string; error?: string } | null;
  if (error || !r?.ok || !r.id) throw new Error(r?.error ?? "입금 기록을 저장하지 못했습니다.");
  return String(r.id);
}

export interface IngestResult {
  ok: boolean;
  duplicated?: boolean;
  id?: string;
  matchStatus?: string;
  estimateId?: string | null;
  kind?: string | null;
  error?: string;
}

export async function ingestBankSms(
  client: Client,
  companyId: string,
  input: { rawText: string; eventId?: string | null; sender?: string | null; receivedAt?: string | null; channel: "paste" | "forward" },
): Promise<IngestResult> {
  const raw = normalizeSmsText(input.rawText).slice(0, 2000);
  if (!raw) return { ok: false, error: "문자 내용이 비어 있습니다." };
  const dedupeKey = bankSmsDedupeKey({ eventId: input.eventId, rawText: raw }, await sha256Hex(raw));
  const parsed = parseDepositSms(raw);
  const receivedAt = input.receivedAt && !Number.isNaN(Date.parse(input.receivedAt)) ? new Date(input.receivedAt).toISOString() : new Date().toISOString();

  // 1) 원문 저장 (중복이면 기존 기록을 그대로 돌려줍니다 — 숫자·입금 기록이 다시 늘지 않습니다)
  const { data: msg, error } = await client
    .from("bank_sms_messages")
    .insert({
      company_id: companyId,
      dedupe_key: dedupeKey,
      event_id: input.eventId ? String(input.eventId).slice(0, 200) : null,
      channel: input.channel,
      sender: input.sender ? String(input.sender).slice(0, 40) : null,
      raw_text: raw,
      received_at: receivedAt,
      looks_like_deposit: parsed.looksLikeDeposit,
      depositor_name: parsed.depositorName || null,
      amount: parsed.amount || null,
      deposited_at: parsed.depositedAt,
      bank: parsed.bank || null,
      match_status: "unmatched",
      match_note: "매칭 중",
    })
    .select("id,depositor_name,amount,deposited_at,raw_text")
    .maybeSingle();
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      const { data: prev } = await client.from("bank_sms_messages").select("id,match_status,matched_estimate_id,payment_kind").eq("company_id", companyId).eq("dedupe_key", dedupeKey).maybeSingle();
      return { ok: true, duplicated: true, id: prev?.id, matchStatus: prev?.match_status, estimateId: prev?.matched_estimate_id, kind: prev?.payment_kind };
    }
    console.error("[ingestBankSms] save", error.message);
    return { ok: false, error: "문자를 저장하지 못했습니다." };
  }

  // 2) 매칭 → 3) 입금 기록 연결. 실패해도 원문은 남고 확인 필요로 표시됩니다.
  try {
    const match = matchBankSms({ depositorName: parsed.depositorName, amount: parsed.amount, looksLikeDeposit: parsed.looksLikeDeposit }, await loadCandidates(client, companyId));
    let recordId: string | null = null;
    if (match.status === "matched") recordId = await attachReceipt(client, companyId, msg, match.estimateId, match.kind);
    await client.from("bank_sms_messages").update({
      match_status: match.status,
      match_note: match.note,
      candidate_estimate_ids: match.candidates,
      matched_estimate_id: match.status === "matched" ? match.estimateId : null,
      payment_kind: match.status === "matched" ? match.kind : null,
      deposit_record_id: recordId,
    }).eq("id", msg.id).eq("company_id", companyId);
    return { ok: true, id: msg.id, matchStatus: match.status, estimateId: match.status === "matched" ? match.estimateId : null, kind: match.status === "matched" ? match.kind : null };
  } catch (e) {
    const note = e instanceof Error ? e.message : "매칭 실패";
    await client.from("bank_sms_messages").update({ match_status: "review", match_note: `자동 연결 실패: ${note}` }).eq("id", msg.id).eq("company_id", companyId);
    return { ok: true, id: msg.id, matchStatus: "review" };
  }
}
