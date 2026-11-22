import { beforeAll, afterAll, test, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { calcDeposit } from "./deposit-rule";

let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${owner}'::uuid$$;
    CREATE TABLE estimate_drafts(user_id uuid,estimate_id text,payload jsonb,revision bigint,deleted_at timestamptz,archived_at timestamptz,PRIMARY KEY(user_id,estimate_id));
    CREATE TABLE estimate_terms(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,estimate_id text,sheet_version int,total int,deposit_paid int DEFAULT 0,balance_paid int DEFAULT 0,interim_paid int DEFAULT 0,customer_name text,contact_phone text,move_date text,company_phone text,sheet_snapshot text,deleted_at timestamptz,cancelled_at timestamptz,storage_origin_completed_at timestamptz,storage_payment_enabled boolean DEFAULT false,planned_interim int DEFAULT 0,payment_status text DEFAULT 'unpaid',calendar_selected boolean DEFAULT false);
    CREATE TABLE deposit_records(estimate_id text,amount int,status text,payment_kind text,confirmed_by uuid,confirmed_at timestamptz);`);
  for (const f of ["0039_save_edited_estimate_sheet_atomic", "0047_adjust_estimate_total_atomic", "0060_rounded_deposit_plan"]) await db.exec(readFileSync(`drizzle/migrations/${f}.sql`, "utf8"));
  await db.exec("CREATE TRIGGER storage_plan BEFORE INSERT OR UPDATE ON estimate_terms FOR EACH ROW EXECUTE FUNCTION sync_storage_payment_plan()");
});
afterAll(async () => { await db.close(); });
async function fixture(run: () => Promise<void>, interim = 0) {
  await db.exec("BEGIN");
  try {
    const draft = { id: "test", total: 2002000, deposit: 100000, depositOverride: 100000, moveType: "보관이사", plannedInterim: interim, sheetSnapshot: { total: 2002000, parts: [{ label: "금액", amount: 2002000 }], rooms: [] } };
    await db.query("INSERT INTO estimate_drafts VALUES($1,'test',$2,100,null,null)", [owner, draft]);
    await db.query("INSERT INTO estimate_terms(user_id,estimate_id,sheet_version,total,sheet_snapshot) VALUES($1,'test',1,2002000,$2)", [owner, JSON.stringify({ draft, total: 2002000 })]);
    await run();
  } finally { await db.exec("ROLLBACK"); }
}
async function read() {
  const rows = await db.query<{ payload: { total: number; deposit: number }; sheet_snapshot: string; deposit_paid: number; balance_paid: number; interim_paid: number; payment_status: string; calendar_selected: boolean }>("SELECT d.payload,t.sheet_snapshot,t.deposit_paid,t.balance_paid,t.interim_paid,t.payment_status,t.calendar_selected FROM estimate_drafts d JOIN estimate_terms t USING(user_id,estimate_id)");
  const row = rows.rows[0]; if (!row) throw new Error("missing fixture"); return row;
}
test.each([[2002000, 200000], [1104000, 110000], [1105000, 111000]])("save/read total %i plans %i in draft and customer snapshot", (total, deposit) => fixture(async () => {
  await db.query("SELECT adjust_estimate_total('test',$1,2002000,200)", [total]);
  const first = await read(); const reopened = await read();
  expect(first.payload.deposit).toBe(deposit);
  expect(JSON.parse(first.sheet_snapshot).draft.deposit).toBe(deposit);
  expect(calcDeposit(first.payload.total)).toBe(deposit);
  expect(reopened).toEqual(first);
}));
test("total edits keep confirmed/excluded receipts and reservation/calendar state unchanged", () => fixture(async () => {
  await db.exec(`UPDATE estimate_terms SET deposit_paid=123456,interim_paid=333333,payment_status='partial',calendar_selected=true;
    INSERT INTO deposit_records VALUES('test',123456,'confirmed','deposit','${owner}',now()),('test',100000,'rejected','deposit',null,null),('test',333333,'confirmed','interim','${owner}',now());`);
  const audit = (await db.query("SELECT * FROM deposit_records ORDER BY amount")).rows;
  await db.exec("SELECT adjust_estimate_total('test',1105001,2002000,200)");
  const row = await read();
  expect(row.payload.deposit).toBe(111000);
  expect(row.deposit_paid).toBe(123456); expect(row.interim_paid).toBe(333333);
  expect(row.payload.total - row.deposit_paid - row.interim_paid - row.balance_paid).toBe(648212);
  expect(row.payment_status).toBe("partial"); expect(row.calendar_selected).toBe(true);
  expect((await db.query("SELECT * FROM deposit_records ORDER BY amount")).rows).toEqual(audit);
}));
test("storage plan validates rounded deposit not the legacy override", () => fixture(async () => {
  await db.exec("SAVEPOINT invalid");
  await expect(db.exec("UPDATE estimate_terms SET sheet_snapshot=jsonb_set(sheet_snapshot::jsonb,'{draft,plannedInterim}','1802001')::text")).rejects.toThrow();
  await db.exec("ROLLBACK TO SAVEPOINT invalid");
  expect((await read()).payload.deposit).toBe(200000);
}, 1000000));