import { beforeAll, afterAll, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { homeReviewStages } from "./home-reservation-stage";
import { paymentSummaryParts } from "./payment-method";
const owner = "11111111-1111-4111-8111-111111111111";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT coalesce(nullif(current_setting('test.role',true),''),'service_role')$$;
    CREATE TABLE estimate_terms(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,estimate_id text,sheet_version int,created_at timestamptz DEFAULT now(),deleted_at timestamptz,contract_status text DEFAULT 'active',total int,deposit_paid int DEFAULT 0,balance_paid int DEFAULT 0,deposit_paid_at timestamptz,balance_paid_at timestamptz,payment_status text DEFAULT 'unpaid',payment_method text,payment_confirmed_at timestamptz,payment_confirmed_by uuid,payment_amount int,paid_at timestamptz,payment_note text,card_approval_number text,calendar_archived boolean DEFAULT false,calendar_archived_at timestamptz,calendar_archived_by uuid,calendar_selected boolean DEFAULT false,reservation_payment_choice text,access_token text,sheet_no text,customer_name text DEFAULT '가상 고객');
    CREATE TABLE deposit_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,estimate_id text,amount int,status text,payment_kind text,payment_method text,confirmed_at timestamptz,confirmed_by uuid,created_at timestamptz DEFAULT now(),sheet_no text,estimate_version int,depositor_name text,customer_name text,deposited_at timestamptz,source text,raw_text text,name_matched boolean,review_note text,dedupe_key text,UNIQUE(user_id,dedupe_key));
    CREATE TABLE owner_notifications(company_id uuid,kind text,ref_id text,dedupe_key text,title text,body text,url text,UNIQUE(company_id,dedupe_key));`);
  await db.exec(readFileSync("drizzle/migrations/0048_pending_balance_review_completion.sql", "utf8"));
  await db.exec(readFileSync("drizzle/migrations/0057_estimate_receipt_projection.sql", "utf8"));
  await db.exec("CREATE TRIGGER receipt_notice AFTER INSERT ON deposit_records FOR EACH ROW EXECUTE FUNCTION notify_deposit_record();");
});
afterAll(async () => { await db.close(); });
async function fixture(run: () => Promise<void>) {
  await db.exec("BEGIN");
  try {
    await db.query("SELECT set_config('test.uid',$1,true)", [owner]);
    await db.query("INSERT INTO estimate_terms(user_id,estimate_id,sheet_version,total,access_token) VALUES($1,'test',1,1200000,'old_token'),($1,'test',5,1310000,'new_token')", [owner]);
    await run();
  } finally { await db.exec("ROLLBACK"); }
}
async function receipt(amount: number, kind = "deposit", status = "confirmed") {
  const result = await db.query<{ id: string }>("INSERT INTO deposit_records(user_id,estimate_id,amount,payment_kind,status,payment_method,confirmed_at,confirmed_by,source,dedupe_key) VALUES($1,'test',$2,$3,$4,'bank_transfer',CASE WHEN $4='confirmed' THEN '2026-11-19T01:00:00Z'::timestamptz END,CASE WHEN $4='confirmed' THEN $1::uuid END,'manual',gen_random_uuid()::text) RETURNING id", [owner, amount, kind, status]);
  return result.rows[0].id;
}
async function money() { return (await db.query<{ total: number; deposit_paid: number; balance_paid: number; payment_status: string }>("SELECT * FROM read_estimate_payments($1,ARRAY['test'])", [owner])).rows[0]; }
async function claim(amount = 1180000, checked = true) { return (await db.query<{ r: { ok: boolean; already?: boolean } }>("SELECT claim_customer_balance('old_token',$1,$2) r", [checked, amount])).rows[0].r; }
async function confirm(id: string) { return (await db.query<{ r: { ok: boolean; completed?: boolean } }>("SELECT confirm_payment_receipt($1) r", [id])).rows[0].r; }
test("1,310,000 latest quote + confirmed 130,000 legacy receipt = 1,180,000, not status-derived money", () => fixture(async () => {
  await receipt(130000);
  const m = await money();
  expect(m).toMatchObject({ total: 1310000, deposit_paid: 130000, balance_paid: 0, payment_status: "deposit_paid" });
  expect(paymentSummaryParts(m.total, Number(m.deposit_paid), 0, 130000).balance).toBe(1180000);
}));
test("saved quote change preserves receipts and audit while recalculating remaining balance", () => fixture(async () => {
  await receipt(130000);
  await db.exec("UPDATE estimate_terms SET total=1500000 WHERE sheet_version=5");
  const m = await money();
  expect(m.total - Number(m.deposit_paid)).toBe(1370000);
  expect((await db.query("SELECT confirmed_at,confirmed_by FROM deposit_records")).rows[0]).toMatchObject({ confirmed_by: owner, confirmed_at: new Date("2026-11-19T01:00:00Z") });
}));
test("old customer token → repeated balance claim → one notice/home queue → owner confirm → zero remaining", () => fixture(async () => {
  await receipt(130000);
  expect((await claim(1180000, false)).ok).toBe(false);
  expect((await claim()).ok).toBe(true); expect((await claim()).already).toBe(true);
  const pending = (await db.query<{ id: string; amount: number; status: string; payment_kind: string }>("SELECT * FROM deposit_records WHERE payment_kind='balance'")).rows;
  expect(pending).toHaveLength(1);
  expect((await db.query("SELECT * FROM owner_notifications")).rows).toHaveLength(1);
  expect((await money()).balance_paid).toBe(0);
  expect(homeReviewStages({ paymentStatus: "deposit_paid", paymentReceipts: pending.map(r => ({ ...r, source: "customer_claim", depositorName: "가상 고객", paymentKind: r.payment_kind, paymentMethod: "bank_transfer" })) })).toContain("balance_waiting");
  expect(await confirm(pending[0].id)).toMatchObject({ ok: true, completed: true });
  await confirm(pending[0].id);
  const m = await money(); expect(m).toMatchObject({ deposit_paid: 130000, balance_paid: 1180000, payment_status: "completed" });
  expect(m.total - Number(m.deposit_paid) - Number(m.balance_paid)).toBe(0);
}));
test("partial and excess receipts remain real sums; pending records never count; total is not raised", () => fixture(async () => {
  await receipt(130000);
  const part = await receipt(300000, "balance", "pending_review");
  expect((await money()).balance_paid).toBe(0);
  expect(await confirm(part)).toMatchObject({ completed: false });
  expect((await money()).payment_status).toBe("partial");
  expect(1310000 - Number((await money()).deposit_paid) - Number((await money()).balance_paid)).toBe(880000);
  const extra = await receipt(900000, "balance", "pending_review");
  await confirm(extra); await confirm(extra);
  expect(await money()).toMatchObject({ total: 1310000, balance_paid: 1200000, payment_status: "completed" });
}));
test("status alone never invents deposits; other company and onsite-card claims are isolated", () => fixture(async () => {
  await db.exec("UPDATE estimate_terms SET payment_status='deposit_paid' WHERE sheet_version=5");
  expect((await money()).deposit_paid).toBe(0); expect((await claim()).ok).toBe(false);
  await receipt(130000);
  await db.exec("UPDATE estimate_terms SET reservation_payment_choice='onsite_card' WHERE sheet_version=5");
  expect((await claim()).ok).toBe(false);
  await db.exec("SELECT set_config('test.role','authenticated',true); SELECT set_config('test.uid','22222222-2222-4222-8222-222222222222',true)");
  expect((await db.query("SELECT * FROM read_estimate_payments($1,ARRAY['test'])", [owner])).rows).toHaveLength(0);
}));
test("cash and card acknowledged payments without receipt rows retain their audited amounts", () => fixture(async () => {
  for (const method of ["cash", "card"]) {
    await db.query("UPDATE estimate_terms SET balance_paid=1310000,balance_paid_at=now(),paid_at=now(),payment_status='completed',payment_method=$1 WHERE sheet_version=5", [method]);
    expect(await money()).toMatchObject({ deposit_paid: 0, balance_paid: 1310000, payment_status: "completed" });
  }
}));
test("2160000 quote with only rejected 100000 receipt stays unpaid across saved versions and rereads", () => fixture(async () => {
  await db.exec("UPDATE estimate_terms SET total=2160000,payment_status='deposit_paid' WHERE sheet_version=5");
  await receipt(100000, "deposit", "rejected");
  for (let i = 0; i < 3; i++) {
    const m = await money();
    expect(m).toMatchObject({ total: 2160000, deposit_paid: 0, balance_paid: 0, payment_status: "unpaid" });
    expect(paymentSummaryParts(m.total, 0, 0, 500000)).toEqual({ total: 2160000, deposit: 500000, balance: 1660000, planned: true });
  }
  await db.exec("UPDATE estimate_terms SET total=2260000 WHERE sheet_version=5");
  expect((await money()).deposit_paid).toBe(0);
  expect((await db.query("SELECT status,amount FROM deposit_records")).rows).toEqual([{ status: "rejected", amount: 100000 }]);
}));