import { afterAll, beforeAll, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { homeReviewStages } from "./home-reservation-stage";
import { paymentReview } from "./payment-review";
import { isWaitingHistoryTarget } from "./history-focus";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('t.uid',true),'')::uuid$$;
    CREATE TABLE estimate_terms(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,user_id uuid,estimate_id text,sheet_version int,created_at timestamptz DEFAULT now(),deleted_at timestamptz,contract_status text DEFAULT 'active',total int,deposit_paid int DEFAULT 100000,deposit_paid_at timestamptz,balance_paid int DEFAULT 0,balance_paid_at timestamptz,payment_status text DEFAULT 'deposit_paid',payment_method text,payment_amount int,payment_confirmed_at timestamptz,payment_confirmed_by uuid,paid_at timestamptz,payment_note text,card_approval_number text,calendar_archived boolean DEFAULT false,calendar_archived_at timestamptz,calendar_archived_by uuid,calendar_selected boolean DEFAULT false);
    CREATE TABLE deposit_records(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,user_id uuid,estimate_id text,amount int,status text DEFAULT 'pending_review',payment_kind text DEFAULT 'balance',payment_method text DEFAULT 'bank_transfer',confirmed_at timestamptz,confirmed_by uuid,customer_name text DEFAULT '합성 고객',depositor_name text DEFAULT '합성 입금자',source text DEFAULT 'sms_paste',dedupe_key text,UNIQUE(user_id,dedupe_key));
    CREATE TABLE owner_notifications(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,company_id uuid,kind text,ref_id text,dedupe_key text,title text,body text,url text,read_at timestamptz,UNIQUE(company_id,dedupe_key));`);
  for (const file of ["0048_pending_balance_review_completion.sql", "0028_sync_confirmed_deposit_payment_state.sql"]) await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
  await db.exec("CREATE TRIGGER deposit_records_notify AFTER INSERT ON deposit_records FOR EACH ROW EXECUTE FUNCTION notify_deposit_record();");
});
afterAll(async () => { await db?.close(); });
async function fixture(run: () => Promise<void>) {
  await db.exec("BEGIN");
  try {
    await db.query("SELECT set_config('t.uid',$1,true)", [owner]);
    for (const uid of [owner, other]) await db.query("INSERT INTO estimate_terms(user_id,estimate_id,sheet_version,total) VALUES($1,'synthetic',1,1060000),($1,'synthetic',2,1400000)", [uid]);
    await run();
  } finally { await db.exec("ROLLBACK"); }
}
async function insert(key: string, amount = 100000, status = "pending_review", kind = "balance") {
  return (await db.query<{ id: string }>("INSERT INTO deposit_records(user_id,estimate_id,amount,status,payment_kind,dedupe_key) VALUES($1,'synthetic',$2,$3,$4,$5) ON CONFLICT(user_id,dedupe_key) DO NOTHING RETURNING id", [owner, amount, status, kind, key])).rows[0]?.id;
}
async function state() {
  const t = (await db.query<{ payment_status: string; balance_paid: number; total: number }>("SELECT * FROM estimate_terms WHERE user_id=$1 ORDER BY sheet_version DESC LIMIT 1", [owner])).rows[0];
  const receipts = (await db.query<{ id: string; amount: number; status: string; paymentKind: string; paymentMethod: string; depositorName: string; source: string }>('SELECT id,amount,status,payment_kind AS "paymentKind",payment_method AS "paymentMethod",depositor_name AS "depositorName",source FROM deposit_records WHERE user_id=$1', [owner])).rows;
  const queues = homeReviewStages({ paymentStatus: t.payment_status, paymentReceipts: receipts });
  return { t, receipts, queues, count: queues.includes("balance_waiting") ? 1 : 0, review: paymentReview(receipts, t.payment_status, 100000, t.balance_paid, t.total) };
}
async function confirm(id: string | undefined) {
  return (await db.query<{ r: { ok: boolean; completed?: boolean } }>("SELECT confirm_payment_receipt($1) r", [id])).rows[0].r;
}
test("pending partial balance → server acknowledgement → review and home count clear; no fake completion", () => fixture(async () => {
  const id = await insert("first", 300000);
  expect((await state()).count).toBe(1);
  expect(await confirm(id)).toMatchObject({ ok: true, completed: false });
  const s = await state();
  expect(s.t).toMatchObject({ balance_paid: 300000, payment_status: "partial" });
  expect(s.review).toBeNull(); expect(s.count).toBe(0);
  await confirm(id); expect((await state()).t.balance_paid).toBe(300000);
}));
test("multiple pending receipts keep review until all acknowledged, then full payment alone completes", () => fixture(async () => {
  const a = await insert("a", 300000); const b = await insert("b", 1000000);
  await confirm(a);
  expect((await state()).review?.amount).toBe(1000000); expect((await state()).count).toBe(1);
  expect(await confirm(b)).toMatchObject({ ok: true, completed: true });
  expect((await state()).count).toBe(0); expect((await state()).t.balance_paid).toBe(1300000);
  await insert("new", 10000); expect((await state()).count).toBe(1);
}));
test("read notification / repeat event / requery do not acknowledge or duplicate receipts and notes; link targets exact estimate", () => fixture(async () => {
  await insert("same"); await insert("same");
  await db.exec("UPDATE owner_notifications SET read_at=now()");
  const s = await state(); expect(s.count).toBe(1); expect(s.receipts).toHaveLength(1);
  const notes = (await db.query<{ kind: string; ref_id: string; body: string; url: string }>("SELECT * FROM owner_notifications")).rows;
  expect(notes).toHaveLength(1); expect(notes[0].kind).toBe("balance"); expect(notes[0].body).toContain("100,000");
  const url = new URL(notes[0].url, "https://example.test");
  expect(url.searchParams.get("estimate")).toBe("synthetic"); expect(url.searchParams.get("notice")).toBe("balance");
  expect(isWaitingHistoryTarget(notes[0].ref_id, "synthetic", s.queues[0])).toBe(true);
  expect((await state()).count).toBe(1);
}));
test("rejected receipt / cross-company failure keep proper queue and latest terms; past terms unchanged", () => fixture(async () => {
  const rejected = await insert("rejected", 100000, "rejected");
  expect((await state()).count).toBe(0); expect(await confirm(rejected)).toMatchObject({ ok: false });
  const id = await insert("pending");
  await db.query("SELECT set_config('t.uid',$1,true)", [other]);
  expect(await confirm(id)).toMatchObject({ ok: false });
  expect((await state()).count).toBe(1);
  await db.query("SELECT set_config('t.uid',$1,true)", [owner]); await confirm(id);
  const old = (await db.query<{ balance_paid: number }>("SELECT balance_paid FROM estimate_terms WHERE user_id=$1 AND sheet_version=1", [owner])).rows[0];
  expect(old.balance_paid).toBe(0);
  const untouched = (await db.query<{ balance_paid: number }>("SELECT balance_paid FROM estimate_terms WHERE user_id=$1", [other])).rows;
  expect(untouched.map(r => r.balance_paid)).toEqual([0, 0]);
}));
test("completed contract extra pending receipt can clear without changing paid totals or completed state", () => fixture(async () => {
  await db.query("UPDATE estimate_terms SET payment_status='completed',balance_paid=1300000,calendar_archived=true WHERE user_id=$1 AND sheet_version=2", [owner]);
  const id = await insert("extra", 50000); expect((await state()).count).toBe(1);
  expect(await confirm(id)).toMatchObject({ ok: true, completed: true });
  expect((await state()).count).toBe(0); expect((await state()).t).toMatchObject({ balance_paid: 1300000, payment_status: "completed" });
  await confirm(id); expect((await state()).t.balance_paid).toBe(1300000);
}));
test("deposit and balance notify independently and reviewing one cannot hide the other", () => fixture(async () => {
  const d = await insert("deposit", 100000, "pending_review", "deposit"); await insert("balance", 300000);
  expect((await state()).queues).toEqual(["deposit_waiting", "balance_waiting"]);
  await confirm(d); expect((await state()).queues).toEqual(["balance_waiting"]);
  expect((await db.query("SELECT * FROM owner_notifications")).rows).toHaveLength(2);
}));
test("same customer 10000 deposit acknowledged then 90000 balance remains pending until owner confirms", () => fixture(async () => {
  await db.query("UPDATE estimate_terms SET total=100000,deposit_paid=0,payment_status='unpaid' WHERE user_id=$1 AND sheet_version=2", [owner]);
  const deposit = await insert("test-deposit-10000", 10000, "pending_review", "deposit");
  expect(await confirm(deposit)).toMatchObject({ ok: true });
  const balance = await insert("test-balance-90000", 90000);
  expect((await state()).t).toMatchObject({ payment_status: "deposit_paid", balance_paid: 0 });
  expect((await state()).review?.kind).toBe("balance");
  expect((await state()).count).toBe(1);
  await insert("test-balance-90000", 90000);
  expect((await state()).receipts).toHaveLength(2);
  expect((await db.query("SELECT * FROM owner_notifications")).rows).toHaveLength(2);
  expect(await confirm(balance)).toMatchObject({ ok: true, completed: true });
  expect((await state()).t).toMatchObject({ payment_status: "completed", balance_paid: 90000 });
  expect((await state()).count).toBe(0);
}));