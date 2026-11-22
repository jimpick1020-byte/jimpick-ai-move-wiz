import { beforeAll, afterAll, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { homeReviewStages } from "./home-reservation-stage";
import { storagePaymentPlan } from "./storage-payment";

const owner = "11111111-1111-4111-8111-111111111111";
const request = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT coalesce(nullif(current_setting('test.role',true),''),'service_role')$$;
    CREATE TABLE estimate_terms(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,estimate_id text,sheet_version int,created_at timestamptz DEFAULT now(),deleted_at timestamptz,contract_status text DEFAULT 'active',total int,deposit_paid int DEFAULT 0,balance_paid int DEFAULT 0,deposit_paid_at timestamptz,balance_paid_at timestamptz,payment_status text DEFAULT 'unpaid',payment_method text,payment_confirmed_at timestamptz,payment_confirmed_by uuid,payment_amount int,paid_at timestamptz,payment_note text,card_approval_number text,calendar_archived boolean DEFAULT false,calendar_archived_at timestamptz,calendar_archived_by uuid,calendar_selected boolean DEFAULT true,reservation_payment_choice text,access_token text,sheet_no text,customer_name text DEFAULT '가상 보관 고객',sheet_snapshot text);
    CREATE TABLE deposit_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,estimate_id text,amount int,status text,payment_kind text,payment_method text,confirmed_at timestamptz,confirmed_by uuid,created_at timestamptz DEFAULT now(),sheet_no text,estimate_version int,depositor_name text,customer_name text,deposited_at timestamptz,source text,raw_text text,name_matched boolean,review_note text,dedupe_key text,UNIQUE(user_id,dedupe_key));
    CREATE TABLE owner_notifications(company_id uuid,kind text,ref_id text,dedupe_key text,title text,body text,url text,UNIQUE(company_id,dedupe_key));`);
  for (const file of ["0048_pending_balance_review_completion", "0027_owner_direct_bank_balance_confirmation"]) await db.exec(readFileSync(`drizzle/migrations/${file}.sql`, "utf8"));
  await db.exec("CREATE TABLE deposit_receipt_aliases(user_id uuid,alias_key text,record_id uuid,event_id text,created_at timestamptz DEFAULT now(),PRIMARY KEY(user_id,alias_key)); ALTER TABLE deposit_records ADD COLUMN linked_evidence_key text;");
  for (const file of ["0050_bank_receipt_evidence_aliases", "0057_estimate_receipt_projection", "0058_storage_interim_receipts"]) await db.exec(readFileSync(`drizzle/migrations/${file}.sql`, "utf8"));
  await db.exec("CREATE TRIGGER receipt_notice AFTER INSERT ON deposit_records FOR EACH ROW EXECUTE FUNCTION notify_deposit_record();");
});
afterAll(async () => { await db.close(); });
async function fixture(run: () => Promise<void>, plannedInterim = 1000000, storage = true) {
  await db.exec("BEGIN");
  try {
    await db.query("SELECT set_config('test.uid',$1,true)", [owner]);
    const snapshot = JSON.stringify({ draft: { moveType: storage ? "보관이사" : "일반이사", plannedInterim, depositOverride: 100000 } });
    await db.query("INSERT INTO estimate_terms(user_id,estimate_id,sheet_version,total,access_token,sheet_snapshot) VALUES($1,'test',1,2002000,'old-token',$2),($1,'test',2,2002000,'new-token',$2)", [owner, snapshot]);
    await db.query("INSERT INTO deposit_records(user_id,estimate_id,amount,payment_kind,status,payment_method,confirmed_at,confirmed_by,source,dedupe_key) VALUES($1,'test',100000,'deposit','confirmed','bank_transfer',now(),$1,'manual','deposit')", [owner]);
    await run();
  } finally { await db.exec("ROLLBACK"); }
}
async function money() {
  const result = await db.query<{ total: number; deposit_paid: number; balance_paid: number; payment_status: string; interim_paid: number; planned_interim: number }>("SELECT m.*,s.interim_paid,s.planned_interim FROM read_estimate_payments($1,ARRAY['test']) m JOIN read_storage_payments($1,ARRAY['test']) s USING(estimate_id)", [owner]);
  const row = result.rows[0]; if (!row) throw new Error("projection absent"); return row;
}
async function result(sql: string, params: (string | number | boolean | null)[] = []) {
  const rows = await db.query<{ r: { ok: boolean; already?: boolean; completed?: boolean; error?: string } }>(`SELECT ${sql} r`, params);
  const row = rows.rows[0]; if (!row) throw new Error("result absent"); return row.r;
}
async function start() { return result("start_storage_interim('test',true)"); }
async function claim(amount: number, seen = 1000000) { return result("claim_customer_interim('old-token',true,$1,$2)", [seen, amount]); }
async function manual(amount: number, key = request, receipt: string | null = null) { return result("confirm_owner_interim('test',$1,$2,true,$3)", [amount, key, receipt]); }

test("plan only: remaining 1,902,000; no payment or calendar changes; origin stage is explicit", () => fixture(async () => {
  expect(await money()).toMatchObject({ total: 2002000, planned_interim: 1000000, interim_paid: 0, payment_status: "deposit_paid" });
  expect((await claim(1000000)).ok).toBe(false);
  expect((await manual(1000000)).ok).toBe(false);
  expect((await start()).ok).toBe(true);
  const m = await money(); expect(storagePaymentPlan({ total: m.total, plannedDeposit: 100000, plannedInterim: m.planned_interim, depositPaid: Number(m.deposit_paid) }).remaining).toBe(1902000);
  expect((await db.query("SELECT calendar_selected,calendar_archived FROM estimate_terms")).rows).toEqual([{ calendar_selected: true, calendar_archived: false }, { calendar_selected: true, calendar_archived: false }]);
}));
test("old link claim/retry: one pending receipt, one notification, no money deducted", () => fixture(async () => {
  await start(); expect((await claim(400000)).ok).toBe(true); expect((await claim(400000)).already).toBe(true);
  expect((await money()).interim_paid).toBe(0);
  const pending = (await db.query<{ id: string; amount: number; status: string }>("SELECT id,amount,status FROM deposit_records WHERE payment_kind='interim'")).rows;
  expect(pending).toHaveLength(1);
  expect(homeReviewStages({ paymentReceipts: pending.map(r => ({ ...r, paymentKind: "interim", paymentMethod: "bank_transfer", source: "customer_claim", depositorName: "가상" })) })).toEqual(["interim_waiting"]);
  expect((await db.query("SELECT * FROM owner_notifications")).rows).toHaveLength(1);
}));
test("owner confirms actual 300,000 from 400,000 claim; retries never add twice; next 700,000 completes interim only", () => fixture(async () => {
  await start(); await claim(400000);
  const rec = (await db.query<{ id: string }>("SELECT id FROM deposit_records WHERE payment_kind='interim'")).rows[0]; if (!rec) throw new Error("receipt missing");
  expect((await manual(300000, request, rec.id)).ok).toBe(true); expect((await manual(300000, request, rec.id)).already).toBe(true);
  expect(await money()).toMatchObject({ interim_paid: 300000, balance_paid: 0, payment_status: "partial" });
  expect((await result("claim_customer_balance('old-token',true,1602000)")).ok).toBe(false);
  expect((await manual(700000, "44444444-4444-4444-8444-444444444444")).ok).toBe(true);
  expect(await money()).toMatchObject({ interim_paid: 1000000, balance_paid: 0, payment_status: "partial", total: 2002000 });
  expect((await db.query("SELECT calendar_archived FROM estimate_terms WHERE sheet_version=2")).rows[0]).toEqual({ calendar_archived: false });
}));
test("excluded interim is never restored; new manual receipt has audit and distinct identity", () => fixture(async () => {
  await start(); await claim(1000000);
  await db.exec("UPDATE deposit_records SET status='rejected' WHERE payment_kind='interim'");
  expect((await manual(1000000)).ok).toBe(true); await manual(1000000);
  expect(await money()).toMatchObject({ interim_paid: 1000000, total: 2002000 });
  const rows = (await db.query<{ status: string; amount: number; confirmed_by: string | null }>("SELECT status,amount,confirmed_by FROM deposit_records WHERE payment_kind='interim' ORDER BY created_at,id")).rows;
  expect(rows.filter(r => r.status === "rejected")).toHaveLength(1);
  expect(rows.filter(r => r.status === "confirmed")).toEqual([{ status: "confirmed", amount: 1000000, confirmed_by: owner }]);
}));
test("latest total change and reread keeps receipts; final balance 902,000 completes once", () => fixture(async () => {
  await start(); await manual(1000000);
  await db.exec("UPDATE estimate_terms SET total=2102000 WHERE sheet_version=2");
  expect(await money()).toMatchObject({ total: 2102000, interim_paid: 1000000 });
  await db.exec("UPDATE estimate_terms SET total=2002000 WHERE sheet_version=2");
  expect((await result("claim_customer_balance('old-token',true,902000)")).ok).toBe(true);
  const rec = (await db.query<{ id: string }>("SELECT id FROM deposit_records WHERE payment_kind='balance'")).rows[0]; if (!rec) throw new Error("balance missing");
  expect(await result("confirm_payment_receipt($1)", [rec.id])).toMatchObject({ ok: true, completed: true });
  await result("confirm_payment_receipt($1)", [rec.id]);
  expect(await money()).toMatchObject({ total: 2002000, interim_paid: 1000000, balance_paid: 902000, payment_status: "completed" });
}));
test("zero or ordinary interim does not change general balance flow", async () => {
  for (const [interim, storage] of [[0, true], [1000000, false]] as const) await fixture(async () => {
    expect((await money()).planned_interim).toBe(0); expect((await manual(1000000)).ok).toBe(false);
    expect((await result("claim_customer_balance('old-token',true,1902000)")).ok).toBe(true);
  }, interim, storage);
});
test("invalid/other-owner confirmation fails without new record or confirmation timestamp", () => fixture(async () => {
  await start(); const audit = (await db.query("SELECT payment_confirmed_at FROM estimate_terms WHERE sheet_version=2")).rows;
  expect((await manual(-1)).ok).toBe(false);
  await db.exec("SELECT set_config('test.uid','22222222-2222-4222-8222-222222222222',true)");
  expect((await manual(1000000)).ok).toBe(false);
  expect((await db.query("SELECT id FROM deposit_records WHERE payment_kind='interim'")).rows).toHaveLength(0);
  expect((await db.query("SELECT payment_confirmed_at FROM estimate_terms WHERE sheet_version=2")).rows).toEqual(audit);
}));
test("server rejects plan over total, transaction keeps total and receipts", () => fixture(async () => {
  await db.exec("SAVEPOINT invalid_plan");
  await expect(db.exec(`UPDATE estimate_terms SET sheet_snapshot='{"draft":{"moveType":"보관이사","depositOverride":100000,"plannedInterim":1902001}}' WHERE sheet_version=2`)).rejects.toThrow();
  await db.exec("ROLLBACK TO SAVEPOINT invalid_plan");
  expect(await money()).toMatchObject({ total: 2002000, planned_interim: 1000000, deposit_paid: 100000 });
}));