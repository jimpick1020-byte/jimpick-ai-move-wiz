import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

// Isolated PostgreSQL/WASM; no hosted credentials, customers, auth users or HTTP.
// Executes the SAME production migrations, with minimal legacy table fixtures.
const user = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
    CREATE TABLE public.profiles(id uuid PRIMARY KEY);
    CREATE TABLE public.subscriptions(user_id uuid PRIMARY KEY,plan text DEFAULT 'free',status text DEFAULT 'trialing',price integer DEFAULT 0,interval text DEFAULT 'month',current_period_start timestamptz DEFAULT now(),current_period_end timestamptz DEFAULT now()+interval '10 days',cancel_at_period_end boolean DEFAULT false,trial_ends_at timestamptz DEFAULT now()+interval '10 days');
    CREATE TABLE public.billing_keys(user_id uuid);
    CREATE TABLE public.payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,plan text,amount integer,method text,status text,provider text,order_id text,payment_key text,paid_at timestamptz DEFAULT now(),next_billing_at timestamptz,test_mode boolean,receipt_no text,fail_reason text,created_at timestamptz DEFAULT now());`);
  for (const file of ["0043_payapp_verified_subscription_orders.sql", "0044_payapp_optional_notice_dates.sql", "0045_payapp_order_isolation_and_cancellation_audit.sql"]) {
    await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
  }
});
afterAll(async () => { await db?.close(); });

async function fixture(run: () => Promise<void>) {
  await db.exec("BEGIN");
  try {
    await db.query("INSERT INTO profiles VALUES($1),($2);", [user, other]);
    await db.query("INSERT INTO subscriptions(user_id) VALUES($1),($2)", [user, other]);
    await run();
  } finally { await db.exec("ROLLBACK"); }
}
async function order(owner = user) {
  const r = await db.query<{id: string}>("INSERT INTO payapp_orders(user_id,requested_day,rebill_no,status,consented_at) VALUES($1,13,(floor(random()*1e14))::text,'pending',now()-interval '3 months') RETURNING id", [owner]);
  return r.rows[0].id;
}
async function notice(id: string, mul: string, state: string, orig: string | null = null, owner = user) {
  return db.query("SELECT apply_payapp_notice(id,user_id,rebill_no,$2,$3,$4,now()-interval '1 hour',now()+interval '1 month',$5,$6) as result FROM payapp_orders WHERE id=$1 AND user_id=$7", [id,mul,state,orig ? 5000 : 30000,orig,orig ? 30000 : null,owner]);
}
async function sub() { return (await db.query<{payapp_order_id: string; cancel_at_period_end: boolean; status: string; plan: string; trial_ends_at: string}>("SELECT * FROM subscriptions WHERE user_id=$1", [user])).rows[0]; }
async function payments() { return (await db.query<{status: string; amount: number}>("SELECT status,amount FROM payments WHERE user_id=$1", [user])).rows; }

describe("real production RPCs in isolated rollback PostgreSQL", () => {
  test("old canceled order late success/cancel cannot change a new subscription", () => fixture(async () => {
    const old = await order(); await notice(old,"100","4");
    await db.query("SELECT finish_payapp_cancel($1,$2)", [old,user]);
    // Ensure deterministic chronology even inside the same transaction.
    await db.query("UPDATE payapp_orders SET created_at=now()-interval '1 day' WHERE id=$1", [old]);
    const fresh = await order(); await notice(fresh,"200","4");
    const before = await sub(); await notice(old,"101","4");
    await db.query("SELECT finish_payapp_cancel($1,$2)", [old,user]);
    await notice(old,"100","9");
    expect(await sub()).toEqual(before); expect(before.payapp_order_id).toBe(fresh); expect(before.cancel_at_period_end).toBe(false);
  }));
  test.each([["99","4"], ["4","99"], ["99","4","99","4"]].map(states => ({states})))("one monotonic payment for sequence $states", ({states}) => fixture(async () => {
    const id = await order(); for (const state of states) await notice(id,"300",state);
    expect(await payments()).toEqual([{status:"paid",amount:30000}]); expect((await sub()).status).toBe("active");
  }));
  test.each([["70","4"],["4","70"],["71","4"],["4","71"]].map(states => ({states})))("partial cancellation in either order $states cannot grant paid access", ({states}) => fixture(async () => {
    const id = await order();
    for (const state of states) await notice(id,state === "4" ? "400" : "401",state,state === "4" ? null : "400");
    expect(await payments()).toEqual([{status:"partially_canceled",amount:30000}]); expect((await sub()).status).not.toBe("active");
    const audit = await db.query<{amount:number;orig_mul_no:string;orig_price:number}>("SELECT amount,orig_mul_no,orig_price FROM payapp_notice_audit WHERE pay_state IN('70','71')");
    expect(audit.rows).toEqual([{amount:5000,orig_mul_no:"400",orig_price:30000}]);
  }));
  test.each([["9","4"],["4","9"],["64","4"],["4","64"]].map(states => ({states})))("full cancellation dominates sequence $states", ({states}) => fixture(async () => {
    const id = await order(); for (const state of states) await notice(id,"500",state);
    expect(await payments()).toEqual([{status:"canceled",amount:30000}]); expect((await sub()).status).not.toBe("active");
  }));
  test("duplicate cancellation and success stay single records", () => fixture(async () => {
    const id = await order(); await notice(id,"600","4"); await notice(id,"600","4");
    await notice(id,"601","70","600"); await notice(id,"601","70","600");
    expect((await payments()).length).toBe(1);
    expect((await db.query("SELECT * FROM payapp_notice_audit")).rows.length).toBe(2);
  }));
  test("cross-company transaction replay is rejected", () => fixture(async () => {
    const a = await order(); const b = await order(other); await notice(a,"700","4");
    await db.exec("SAVEPOINT mismatch");
    await expect(notice(b,"700","4",null,other)).rejects.toThrow("another order");
    await db.exec("ROLLBACK TO SAVEPOINT mismatch"); expect((await payments()).length).toBe(1);
  }));
  test("definitive rejection releases creation lock, ambiguous creation does not; trial remains", () => fixture(async () => {
    const before = await sub();
    const reserve = async () => (await db.query<{result:{created:boolean;order:{id:string}}}>("SELECT reserve_payapp_order($1,13) as result", [user])).rows[0].result;
    const first = await reserve(); const ambiguous = await reserve();
    expect(first.created).toBe(true); expect(ambiguous.created).toBe(false); expect(ambiguous.order.id).toBe(first.order.id);
    await db.query("SELECT reject_payapp_registration($1,$2)", [first.order.id,user]);
    const retry = await reserve(); expect(retry.created).toBe(true); expect(retry.order.id).not.toBe(first.order.id);
    expect(await sub()).toEqual(before);
  }));
  test("request cancellation preserves original trial expiry", () => fixture(async () => {
    const before = await sub(); const id = await order(); await notice(id,"800","8"); expect(await sub()).toEqual(before);
  }));
  test("a newer pending order blocks old order success from restoring entitlement", () => fixture(async () => {
    const old = await order(); await db.query("SELECT finish_payapp_cancel($1,$2)", [old,user]);
    await db.query("UPDATE payapp_orders SET created_at=now()-interval '1 day' WHERE id=$1", [old]);
    await order(); const before = await sub(); await notice(old,"850","4"); expect(await sub()).toEqual(before);
  }));
  test("out-of-order renewal success cannot shorten the newer paid period", () => fixture(async () => {
    const id = await order(); await notice(id,"860","4"); const before = await sub();
    await db.query("SELECT apply_payapp_notice(id,user_id,rebill_no,'861','4',30000,now()-interval '1 month',now()-interval '1 day') FROM payapp_orders WHERE id=$1", [id]);
    expect(await sub()).toEqual(before); expect((await payments()).length).toBe(2);
  }));
  test("RPCs are unavailable to anonymous/authenticated callers and audit retains owner RLS", async () => {
    const permissions = await db.query<{a:boolean;b:boolean;c:boolean}>("SELECT has_function_privilege('anon','apply_payapp_notice(uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,integer)','EXECUTE') a,has_function_privilege('authenticated','finish_payapp_cancel(uuid,uuid)','EXECUTE') b,has_function_privilege('service_role','apply_payapp_notice(uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,integer)','EXECUTE') c");
    expect(permissions.rows).toEqual([{a:false,b:false,c:true}]);
    expect((await db.query<{relrowsecurity:boolean}>("SELECT relrowsecurity FROM pg_class WHERE oid='payapp_notice_audit'::regclass")).rows[0].relrowsecurity).toBe(true);
  });
});