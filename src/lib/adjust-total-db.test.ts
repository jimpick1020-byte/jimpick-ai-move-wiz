import { afterAll, beforeAll, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
// Isolated PostgreSQL/WASM with the SAME production functions; no hosted data.
const me = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('t.uid',true),'')::uuid$$;
    CREATE TABLE estimate_drafts(user_id uuid,estimate_id text,payload jsonb,revision bigint,deleted_at timestamptz,archived_at timestamptz,PRIMARY KEY(user_id,estimate_id));
    CREATE TABLE estimate_terms(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,estimate_id text,sheet_version int,total int,deposit_paid int DEFAULT 0,balance_paid int DEFAULT 0,customer_name text,contact_phone text,move_date text,company_phone text,sheet_snapshot text,deleted_at timestamptz,cancelled_at timestamptz);`);
  for (const f of ["0039_save_edited_estimate_sheet_atomic.sql", "0047_adjust_estimate_total_atomic.sql"]) await db.exec(readFileSync(`drizzle/migrations/${f}`, "utf8"));
});
afterAll(async () => { await db?.close(); });
const parts = [{ label: "기본 운송료", amount: 1100000 }, { label: "사다리차 비용", amount: 300000 }];
async function fixture(run: () => Promise<void>) {
  await db.exec("BEGIN");
  try {
    await db.query("SELECT set_config('t.uid',$1,true)", [me]);
    for (const u of [me, other]) {
      const payload = { id: "est_x", total: 1400000, deposit: 140000, sheetSnapshot: { total: 1400000, parts, rooms: [{ id: "r1" }] } };
      await db.query("INSERT INTO estimate_drafts VALUES($1,'est_x',$2,100,null,null)", [u, payload]);
      await db.query("INSERT INTO estimate_terms(user_id,estimate_id,sheet_version,total,deposit_paid,balance_paid,sheet_snapshot) VALUES($1,'est_x',1,1060000,100000,0,'{\"total\":1060000}'),($1,'est_x',2,1400000,100000,$2,$3)", [u, u === me ? 300000 : 0, JSON.stringify({ total: 1400000, parts })]);
    }
    await run();
  } finally { await db.exec("ROLLBACK"); }
}
const adjust = async (total: number, expected: number, rev: number) =>
  (await db.query<{ r: { ok: boolean; changed?: boolean; stale?: boolean } }>("SELECT adjust_estimate_total('est_x',$1,$2,$3) r", [total, expected, rev])).rows[0].r;
const rows = async (u = me) => ({
  draft: (await db.query<{ payload: { total: number; totalOverride: number; sheetSnapshot: { total: number; parts: { label: string; amount: number }[]; rooms: unknown[] } }; revision: number }>("SELECT payload,revision FROM estimate_drafts WHERE user_id=$1", [u])).rows[0],
  terms: (await db.query<{ sheet_version: number; total: number; deposit_paid: number; balance_paid: number; sheet_snapshot: string }>("SELECT * FROM estimate_terms WHERE user_id=$1 ORDER BY sheet_version", [u])).rows,
});

test("1.4M→1.5M saves draft, snapshot parts and latest shared sheet together; paid amounts and v1 untouched", () => fixture(async () => {
  expect(await adjust(1500000, 1400000, 200)).toMatchObject({ ok: true, changed: true });
  const { draft, terms } = await rows();
  expect([draft.revision, draft.payload.total, draft.payload.totalOverride, draft.payload.sheetSnapshot.total]).toEqual([200, 1500000, 1500000, 1500000]);
  expect(draft.payload.sheetSnapshot.parts.reduce((s, p) => s + p.amount, 0)).toBe(1500000);
  expect(draft.payload.sheetSnapshot.parts.at(-1)).toEqual({ label: "할인·조정", amount: 100000 });
  expect(draft.payload.sheetSnapshot.rooms).toEqual([{ id: "r1" }]);
  expect(terms[0]).toMatchObject({ total: 1060000, deposit_paid: 100000, sheet_snapshot: '{"total":1060000}' });
  expect(terms[1]).toMatchObject({ total: 1500000, deposit_paid: 100000, balance_paid: 300000 });
  expect(JSON.parse(terms[1].sheet_snapshot).total).toBe(1500000);
  expect(JSON.parse(terms[1].sheet_snapshot).draft.total).toBe(1500000);
}));
test("repeating the same adjustment changes nothing and adds no second 조정 line", () => fixture(async () => {
  await adjust(1500000, 1400000, 200);
  expect(await adjust(1500000, 1400000, 300)).toMatchObject({ ok: true, changed: false });
  const { draft } = await rows();
  expect(draft.revision).toBe(200);
  expect(draft.payload.sheetSnapshot.parts.filter((p) => p.label === "할인·조정")).toHaveLength(1);
}));
test("a second adjustment merges into the same 조정 line", () => fixture(async () => {
  await adjust(1500000, 1400000, 200);
  await adjust(1450000, 1500000, 300);
  const { draft } = await rows();
  expect(draft.payload.sheetSnapshot.parts.filter((p) => p.label === "할인·조정")).toEqual([{ label: "할인·조정", amount: 50000 }]);
}));
test("stale expected total or older revision is rejected without writing", () => fixture(async () => {
  expect(await adjust(1500000, 1300000, 200)).toMatchObject({ ok: false, stale: true });
  expect(await adjust(1500000, 1400000, 50)).toMatchObject({ ok: false, stale: true });
  const { draft, terms } = await rows();
  expect([draft.payload.total, terms[1].total]).toEqual([1400000, 1400000]);
}));
test("another company's estimate with the same ID is not touched", () => fixture(async () => {
  await adjust(1500000, 1400000, 200);
  const { draft, terms } = await rows(other);
  expect([draft.payload.total, draft.revision, terms[1].total]).toEqual([1400000, 100, 1400000]);
}));
