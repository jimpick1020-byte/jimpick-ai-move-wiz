import { afterAll, beforeAll, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { homeReviewStages } from "./home-reservation-stage";
import { pendingBalanceReceipts } from "./payment-review";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('t.uid',true),'')::uuid$$;
    CREATE TABLE estimate_terms(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,user_id uuid,estimate_id text,sheet_no text,sheet_version int,customer_name text DEFAULT '테스트고객',access_token text UNIQUE,created_at timestamptz DEFAULT now(),deleted_at timestamptz,contract_status text DEFAULT 'active',total int,deposit_paid int DEFAULT 10000,deposit_paid_at timestamptz,balance_paid int DEFAULT 0,balance_paid_at timestamptz,payment_status text DEFAULT 'deposit_paid',payment_method text,payment_amount int,payment_confirmed_at timestamptz,payment_confirmed_by uuid,paid_at timestamptz,payment_note text,card_approval_number text,calendar_archived boolean DEFAULT false,calendar_archived_at timestamptz,calendar_archived_by uuid,calendar_selected boolean DEFAULT false);
    CREATE TABLE deposit_records(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,user_id uuid NOT NULL,estimate_id text NOT NULL,sheet_no text,estimate_version int NOT NULL DEFAULT 1,depositor_name text NOT NULL DEFAULT '',customer_name text NOT NULL DEFAULT '',amount int NOT NULL,deposited_at timestamptz,source text NOT NULL,raw_text text,name_matched boolean NOT NULL DEFAULT true,status text NOT NULL DEFAULT 'pending_review',review_note text,confirmed_at timestamptz,confirmed_by uuid,dedupe_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz DEFAULT now(),payment_kind text NOT NULL DEFAULT 'deposit',payment_method text,UNIQUE(user_id,dedupe_key));
    CREATE TABLE owner_notifications(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,company_id uuid,kind text,ref_id text,dedupe_key text,title text,body text,url text,read_at timestamptz,UNIQUE(company_id,dedupe_key));`);
  for (const f of ["0048_pending_balance_review_completion.sql", "0049_serialized_balance_receipts.sql"]) await db.exec(readFileSync(`drizzle/migrations/${f}`, "utf8"));
  await db.exec("CREATE TRIGGER deposit_records_notify AFTER INSERT ON deposit_records FOR EACH ROW EXECUTE FUNCTION notify_deposit_record();");
});
afterAll(async () => { await db?.close(); });

async function fixture(run: () => Promise<void>) {
  await db.exec("BEGIN");
  try {
    await db.query("INSERT INTO estimate_terms(user_id,estimate_id,sheet_version,total,access_token) VALUES($1,'est',1,100000,'tokA_123456'),($2,'est',1,100000,'tokB_123456')", [A, B]);
    await run();
  } finally { await db.exec("ROLLBACK"); }
}
const claim = async (seen = 90000, ok = true, token = "tokA_123456") =>
  (await db.query<{ r: { ok: boolean; already?: boolean; error?: string } }>("SELECT claim_customer_balance($1,$2,$3) r", [token, ok, seen])).rows[0].r;
const bank = async (msg: string, amount = 90000) =>
  (await db.query<{ r: { ok: boolean; id: string } }>("SELECT record_bank_receipt($1,'est','balance',$2,'테스트고객',now(),'raw','sms_paste',$3,'n',true) r", [A, amount, `banksms|${msg}`])).rows[0].r;
async function view() {
  const t = (await db.query<{ payment_status: string; balance_paid: number }>("SELECT payment_status,balance_paid FROM estimate_terms WHERE user_id=$1", [A])).rows[0];
  const receipts = (await db.query<{ id: string; amount: number; status: string; source: string; paymentKind: string; paymentMethod: string; depositorName: string }>('SELECT id,amount,status,source,payment_kind AS "paymentKind",payment_method AS "paymentMethod",depositor_name AS "depositorName" FROM deposit_records WHERE user_id=$1', [A])).rows;
  const notifications = Number((await db.query<{ n: number }>("SELECT count(*)::int n FROM owner_notifications WHERE company_id=$1", [A])).rows[0].n);
  return { t, receipts, notifications, blue: pendingBalanceReceipts(receipts).length, home: homeReviewStages({ paymentStatus: t.payment_status, paymentReceipts: receipts }).includes("balance_waiting") ? 1 : 0 };
}

test("고객 잔금 신고 90,000 → 알림 1·파란 테두리·홈 1 → 업체 확인 → 완료·해제", () => fixture(async () => {
  expect((await claim()).ok).toBe(true);
  expect((await claim()).already).toBe(true);
  let v = await view();
  expect([v.receipts.length, v.notifications, v.blue, v.home, v.t.balance_paid]).toEqual([1, 1, 1, 1, 0]);
  await db.query("SELECT set_config('t.uid',$1,true)", [A]);
  await db.query("SELECT complete_estimate_payment('est','bank_transfer',$1)", [v.receipts[0].id]);
  v = await view();
  expect([v.t.payment_status, v.t.balance_paid, v.blue, v.home, v.notifications]).toEqual(["completed", 90000, 0, 0, 1]);
}));

test("고객 신고 후 같은 은행 원문은 1:1 연결되고, 같은 금액 별도 거래는 따로 남음", () => fixture(async () => {
  await claim();
  const first = await bank("m1");
  expect((await bank("m1")).id).toBe(first.id);
  await bank("m2");
  const v = await view();
  expect([v.receipts.length, v.notifications]).toEqual([2, 2]);
}));

test("은행 먼저면 고객 신고는 새 기록 없이 대기, 차단 조건은 기록 없음", () => fixture(async () => {
  await bank("m1");
  expect((await claim()).already).toBe(true);
  expect((await view()).notifications).toBe(1);
  await db.exec("DELETE FROM deposit_records; DELETE FROM owner_notifications;");
  expect((await claim(90000, false)).ok).toBe(false);
  expect((await claim(80000)).ok).toBe(false);
  expect((await claim(90000, true, "tokB_123456")).ok).toBe(true);
  expect((await view()).receipts.length).toBe(0);
}));
