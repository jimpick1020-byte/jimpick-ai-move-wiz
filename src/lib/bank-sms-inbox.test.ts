import { test } from "node:test";
import { strict as assert } from "node:assert";
import { ingestBankSms } from "./bank-sms.server";
import { matchBankSms } from "./bank-sms-match";
import { paymentReview } from "./payment-review";

test("deleted duplicate returns retained identity without rematching or creating receipts", async () => {
  const touched: string[] = [];
  const prev = { id: "hidden-message", match_status: "matched", matched_estimate_id: "estimate", payment_kind: "balance", deleted_at: "2026-10-22T00:00:00Z" };
  const client = { from(table: string) {
    touched.push(table);
    const query = {
      insert: () => query, select: () => query, eq: () => query,
      maybeSingle: async () => touched.length === 1 ? { data: null, error: { message: "duplicate key value violates unique constraint" } } : { data: prev, error: null },
    };
    return query;
  } };
  const result = await ingestBankSms(client, "owner", { rawText: "농협 입금180,000원 10/22 14:00 시험고객 잔액1,000,000원", channel: "forward" });
  assert.equal(result.duplicated, true); assert.equal(result.id, "hidden-message");
  assert.deepEqual(touched, ["bank_sms_messages", "bank_sms_messages"]);
});
for (const amount of [180000, 250000]) test(`bank balance ${amount} connects and needs owner review without any customer claim`, () => {
  const candidate = { estimateId: "estimate", customerName: "시험고객", total: 200000, depositPaid: 20000, balancePaid: 0, paymentStatus: "deposit_paid" };
  const result = matchBankSms({ amount, depositorName: "시험고객", looksLikeDeposit: true }, [candidate]);
  assert.equal(result.status, "matched"); assert.equal(result.status === "matched" && result.kind, "balance");
  const receipt = { amount, depositorName: "시험고객", paymentKind: "balance", paymentMethod: "bank_transfer", status: "pending_review", source: "sms_paste" };
  assert.equal(paymentReview([receipt], candidate.paymentStatus, 20000, 0, 200000)?.kind, "balance");
  assert.equal(candidate.total, 200000); assert.equal(candidate.paymentStatus, "deposit_paid");
  assert.equal(paymentReview([{ ...receipt, status: "confirmed" }], "completed", 20000, amount, 200000), null);
});