import { beforeAll, afterAll, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { calendarReservationShown } from "./calendar-visibility";
import { homeReservationStageOf } from "./home-reservation-stage";
const owner = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
beforeAll(async () => {
 db = new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('t.uid',true),'')::uuid$$;
 CREATE TABLE user_roles(user_id uuid,role text); CREATE FUNCTION has_role(_user_id uuid,_role text) RETURNS boolean LANGUAGE sql AS $$SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=_user_id AND role=_role)$$;
 CREATE TABLE estimate_terms(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,user_id uuid,estimate_id text,sheet_version int DEFAULT 1,created_at timestamptz DEFAULT now(),deleted_at timestamptz,contract_status text DEFAULT 'active',total int DEFAULT 900000,deposit_paid int DEFAULT 0,balance_paid int DEFAULT 0,balance_paid_at timestamptz,payment_status text DEFAULT 'unpaid',payment_method text,payment_amount int,payment_confirmed_at timestamptz,payment_confirmed_by uuid,paid_at timestamptz,calendar_archived boolean DEFAULT false,calendar_archived_at timestamptz,calendar_archived_by uuid,calendar_selected boolean DEFAULT false,customer_name text DEFAULT '합성 고객',move_date text DEFAULT '2026-12-01',terms_name text,terms_version text,terms_effective_at date,sent_at timestamptz,sent_msg_id text);
 CREATE TABLE terms_acceptances(estimate_terms_id uuid UNIQUE,user_id uuid,estimate_id text,sheet_version int,terms_name text,terms_version text,terms_effective_at date,terms_snapshot text,accepted boolean,accepted_at timestamptz,accept_method text,token_hint text,sent_at timestamptz,sent_msg_id text,estimate_snapshot text,user_agent text,reservation_status text,confirmed_by text,confirmed_by_user_id uuid);
 CREATE TABLE owner_notifications(id uuid DEFAULT gen_random_uuid(),company_id uuid,kind text,ref_id text,dedupe_key text,title text,body text,url text,UNIQUE(company_id,dedupe_key));
 CREATE TABLE deposit_records(user_id uuid,estimate_id text,status text,amount int);`);
 await db.exec(readFileSync('supabase/migrations/20260928133837_2695bf0d-5a74-4fcd-ad1e-a2e83fc4f865.sql','utf8'));
 for (const f of ['0054_onsite_card_reservations.sql','0055_protect_card_reservation_inserts.sql']) await db.exec(readFileSync(`drizzle/migrations/${f}`,'utf8'));
}, 30000);
afterAll(async () => { await db?.close(); });
async function fixture(run: (id: string) => Promise<void>) {
 await db.exec('BEGIN');
 try {
  const id = (await db.query<{id:string}>("INSERT INTO estimate_terms(user_id,estimate_id) VALUES($1,'synthetic') RETURNING id",[owner])).rows[0].id;
  await run(id);
 } finally { await db.exec('ROLLBACK'); }
}
const request = async (id: string, choice = 'onsite_card') => (await db.query<{r:any}>("SELECT request_reservation_payment($1,$2,'약관 동의 합성 자료',null,'web','token',null) r",[id,choice])).rows[0].r;
const confirm = async (id: string, complete = false, terminal = false, uid = owner) => {
 await db.query("SELECT set_config('t.uid',$1,true)",[uid]);
 return (await db.query<{r:any}>("SELECT confirm_onsite_card($1,$2,$3) r",[id,complete,terminal])).rows[0].r;
};
async function state(id:string) {
 const t=(await db.query<any>('SELECT * FROM estimate_terms WHERE id=$1',[id])).rows[0];
 const input={reservationPaymentChoice:t.reservation_payment_choice,cardRequestedAt:t.card_requested_at,cardConfirmedAt:t.card_confirmed_at,paymentStatus:t.payment_status,depositPaid:t.deposit_paid,balancePaid:t.balance_paid};
 return { t, stage:homeReservationStageOf(input), calendar:calendarReservationShown(t), notices:(await db.query<{n:number}>('SELECT count(*)::int n FROM owner_notifications')).rows[0].n, acceptances:(await db.query<{n:number}>('SELECT count(*)::int n FROM terms_acceptances')).rows[0].n };
}
test('900000 request → waiting 1 → owner confirms unpaid/calendar → terminal confirmation completes 0 remaining; repeats do not duplicate', () => fixture(async id => {
 expect(await request(id)).toMatchObject({ok:true}); expect(await request(id)).toMatchObject({ok:true,duplicate:true});
 let s=await state(id); expect(s.stage).toBe('card_waiting'); expect(s.notices).toBe(1); expect(s.acceptances).toBe(1); expect(s.calendar).toBe(false); expect(s.t.deposit_paid).toBe(0); expect(s.t.payment_status).toBe('unpaid');
 expect(await confirm(id)).toMatchObject({ok:true}); expect(await confirm(id)).toMatchObject({ok:true,duplicate:true});
 s=await state(id); expect(s.stage).toBe('reservation_confirmed'); expect(s.calendar).toBe(true); expect(s.t.payment_status).toBe('unpaid'); expect(s.t.balance_paid).toBe(0);
 expect(await confirm(id,true,true)).toMatchObject({ok:true,completed:true}); expect(await confirm(id,true,true)).toMatchObject({ok:true,duplicate:true});
 s=await state(id); expect(s.stage).toBe('payment_completed'); expect(s.t.payment_status).toBe('completed'); expect(s.t.payment_method).toBe('card'); expect(s.t.balance_paid).toBe(900000); expect(s.t.total-s.t.deposit_paid-s.t.balance_paid).toBe(0); expect(s.notices).toBe(1); expect(s.acceptances).toBe(1);
}));
test('only owner/authorized admin can confirm; unrelated company and signed out are refused',()=>fixture(async id=>{
 await request(id); expect((await confirm(id,false,false,other)).ok).toBe(false); expect((await confirm(id,false,false,'')).ok).toBe(false);
 await db.query("INSERT INTO user_roles VALUES($1,'admin')",[other]); expect((await confirm(id,false,false,other)).ok).toBe(true);
}));
test('payment requires confirmed reservation and explicit terminal attestation',()=>fixture(async id=>{
 await request(id); expect((await confirm(id,true,true)).ok).toBe(false); await confirm(id); expect((await confirm(id,true,false)).ok).toBe(false); expect((await state(id)).t.balance_paid).toBe(0);
}));
test('bank transfer consent stays requested; no card alert, no confirmation, existing payments unchanged',()=>fixture(async id=>{
 expect((await request(id,'bank_transfer')).ok).toBe(true); expect((await request(id,'bank_transfer')).duplicate).toBe(true);
 const s=await state(id); expect(s.stage).toBe('estimate_notice'); expect(s.notices).toBe(0); expect(s.calendar).toBe(false); expect(s.t.payment_status).toBe('unpaid'); expect(s.t.deposit_paid).toBe(0);
}));
test('older/deleted/cancelled and already-paid estimates cannot request card',()=>fixture(async id=>{
 await db.query("UPDATE estimate_terms SET deposit_paid=100000 WHERE id=$1",[id]); expect((await request(id)).ok).toBe(false);
 await db.query("UPDATE estimate_terms SET deposit_paid=0,contract_status='cancelled' WHERE id=$1",[id]); expect((await request(id)).ok).toBe(false);
 await db.query("UPDATE estimate_terms SET contract_status='active' WHERE id=$1",[id]); await db.query("INSERT INTO estimate_terms(user_id,estimate_id,sheet_version) VALUES($1,'synthetic',2)",[owner]); expect((await request(id)).ok).toBe(false);
}));
test('direct INSERT/UPDATE cannot forge card request, confirmation or payment',()=>fixture(async id=>{
 await expect(db.query("UPDATE estimate_terms SET card_confirmed_at=now() WHERE id=$1",[id])).rejects.toThrow();
}));
test('card booking prevents direct payment status completion',()=>fixture(async id=>{
 await request(id); await expect(db.query("UPDATE estimate_terms SET payment_status='completed' WHERE id=$1",[id])).rejects.toThrow();
}));
test('pending bank receipt blocks card request atomically without consent or notification',()=>fixture(async id=>{
 await db.query("INSERT INTO deposit_records VALUES($1,'synthetic','pending_review',90000)",[owner]);
 await expect(request(id)).rejects.toThrow();
}));

test('direct insert cannot forge paid card booking',()=>fixture(async()=>{
 await expect(db.query("INSERT INTO estimate_terms(user_id,estimate_id,reservation_payment_choice,card_confirmed_at) VALUES($1,'forged','onsite_card',now())",[owner])).rejects.toThrow();
}));
