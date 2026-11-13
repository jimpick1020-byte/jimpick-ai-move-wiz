import { describe, expect, test } from "vitest";
import { authenticatePayappNotice, payappDate, payappNextDate, payappReadiness, payappRegistrationQuote, payappPendingReusable, payappFirstApprovalMatches, payappBillingSchedule, safePayappUrl, sha256 } from "./payapp-live";

// Explicit synthetic fixture, never read project credentials or call a payment provider.
const fixture = {PAYAPP_USER_ID:"fixture-merchant",PAYAPP_LINK_KEY:"fixture-link",PAYAPP_LINK_VALUE:"fixture-value",PAYAPP_REQUEST_KEY:"fixture-request"};
const now = Date.parse("2026-11-13T02:00:00Z");
async function notice(overrides:Record<string,unknown> = {}) {
  return {userid:fixture.PAYAPP_USER_ID,linkkey:fixture.PAYAPP_LINK_KEY,linkval:fixture.PAYAPP_LINK_VALUE,responsedate:"20261113110000",hash:await sha256("fixture-merchant20261113110000fixture-request"),var1:"11111111-1111-4111-8111-111111111111",var2:"22222222-2222-4222-8222-222222222222",rebill_no:"123",mul_no:"456",price:"30000",pay_state:"4",pay_date:"2026-11-13 11:00:00",...overrides};
}
describe("PayApp authenticated live boundaries (no external billing)",()=>{
  test("checks merchant, both link credentials and signed timestamp",async()=>{
    expect((await authenticatePayappNotice(await notice(),fixture,now)).price).toBe(30000);
    for (const key of ["userid","linkkey","linkval","hash"]) await expect(authenticatePayappNotice(await notice({[key]:key==="hash"?"0".repeat(64):"wrong"}),fixture,now)).rejects.toThrow();
  });
  test("only 30000 is accepted",async()=>{await expect(authenticatePayappNotice(await notice({price:"29999"}),fixture,now)).rejects.toThrow();});
  test("expires a replay timestamp after fifteen minutes",async()=>{await expect(authenticatePayappNotice(await notice(),fixture,now+900001)).rejects.toThrow();});
  test("requires request and company UUID identifiers",async()=>{await expect(authenticatePayappNotice(await notice({var1:"other-company"}),fixture,now)).rejects.toThrow();});
  test("strips incoming card information rather than storing it",async()=>{
    const parsed = await authenticatePayappNotice(await notice({card_num:"synthetic-card-field",cvc:"synthetic-cvc"}),fixture,now);
    expect(Object.keys(parsed).includes("card_num")).toBe(false); expect(Object.keys(parsed).includes("cvc")).toBe(false);
  });
  test("only unverified month and same-day validity policy block configured requests",()=>{
    const r=payappReadiness(fixture,new Date(now)); expect(r.ready).toBe(false); expect(r.issues.length).toBe(2);
  });
  test("general month flag cannot bypass unverified same-day validity",()=>{
    const r = payappReadiness({...fixture,PAYAPP_MONTH_POLICY_CONFIRMED:"true"},new Date(now));
    expect(r.ready).toBe(false); expect(r.issues.length).toBe(1);
  });
  test("old fixed expiry setting never determines a new order",()=>{expect(payappReadiness({...fixture,PAYAPP_REBILL_EXPIRE:"2025-11-13"},new Date(now)).quote.expire).toBe("2031-11-13");});
  test("payment URL must use HTTPS and actual PayApp domain",()=>{
    expect(safePayappUrl("https://payapp.kr/payment")).toBe("https://payapp.kr/payment");
    for(const url of ["http://payapp.kr/payment","https://payapp.kr.evil.example/payment","https://evil.example/payment"]) expect(()=>safePayappUrl(url)).toThrow();
  });
});

describe("confirmed merchant date policy, synthetic inputs only", () => {
  test("new registration uses KST request date plus five years, price 30000", () => {
    expect(payappRegistrationQuote(new Date("2026-11-12T15:01:00Z"))).toEqual({requestDate:"2026-11-13",expire:"2031-11-13",day:13,amount:30000});
    expect(payappRegistrationQuote(new Date("2026-11-13T15:01:00Z")).expire).toBe("2031-11-14");
  });
  test("February 29 five years later clamps to February 28", () => {
    expect(payappRegistrationQuote(new Date("2028-02-28T15:00:00Z")).expire).toBe("2033-02-28");
  });
  test.each(["2031-11-12T15:00:00Z","2031-11-13T15:00:00Z"])("exclusive expiry %s never becomes a billing date", at => {
    expect(payappBillingSchedule({rebill_expire:"2031-11-13"},at,new Date("2031-11-12T00:00:00Z")).nextBillingAt).toBeNull();
  });
  test("last valid payment period remains separate from registration expiry", () => {
    const end = payappNextDate("2026-11-13T06:00:00Z","2031-10-13T01:00:00Z");
    expect(end).toBe("2031-11-13T06:00:00.000Z");
    expect(payappBillingSchedule({rebill_expire:"2031-11-13"},end).needsReregistration).toBe(true);
    expect(payappBillingSchedule({rebill_expire:"2031-11-13"},end,new Date("2031-11-13T00:00:00Z")).expired).toBe(true);
  });
  test("no expired contract means no fabricated expiration for historical order", () => {
    expect(payappBillingSchedule({},"2031-12-13T01:00:00Z").expired).toBe(false);
  });
  const order = {status:"pending",created_at:"2026-11-13T00:00:00Z",request_date:"2026-11-13",first_paid_at:null};
  test("previous KST day pending is blocked; same day is reusable", () => {
    expect(payappPendingReusable(order,new Date("2026-11-13T14:59:00Z"))).toBe(true);
    expect(payappPendingReusable(order,new Date("2026-11-13T15:00:00Z"))).toBe(false);
  });
  test("next month same day is not a matching first approval", () => {
    expect(payappFirstApprovalMatches(order,"2026-12-13T00:00:00Z")).toBe(false);
  });
  test("delayed NOTI uses actual approval date, not received date", () => {
    expect(payappFirstApprovalMatches(order,payappDate("20261113235959"))).toBe(true);
    expect(payappFirstApprovalMatches(order,payappDate("20261114000000"))).toBe(false);
  });
  test("renewals keep verified first approval rather than compare renewal to request day", () => {
    expect(payappFirstApprovalMatches({...order,first_paid_at:"2026-11-13T00:00:00Z"},"2026-12-13T00:00:00Z")).toBe(true);
  });
});
describe("Korean actual approval anchored calendar",()=>{
  test.each(["01:00:00", "06:00:00", "10:00:00"])("same renewal date at %s advances to January", (time) => {
    expect(payappNextDate("2026-11-13T06:00:00Z", `2026-12-13T${time}Z`)).toBe("2027-01-13T06:00:00.000Z");
  });
  test.each([29, 30, 31])("early clamped February renewal restores day %s", (day) => {
    expect(payappNextDate(`2026-01-${day}T06:00:00Z`, "2026-02-28T01:00:00Z")).toBe(`2026-03-${day}T06:00:00.000Z`);
    expect(payappNextDate(`2028-01-${day}T06:00:00Z`, "2028-02-29T01:00:00Z")).toBe(`2028-03-${day}T06:00:00.000Z`);
  });
  test("delayed notification uses approval timestamp, not receipt timestamp", () => {
    expect(payappNextDate("2026-11-13T06:00:00Z", "2027-02-13T01:00:00Z")).toBe("2027-03-13T06:00:00.000Z");
    expect(payappNextDate("2026-11-13T06:00:00Z", "2026-12-14T01:00:00Z")).toBe("2027-01-13T06:00:00.000Z");
  });
  test("KST parse and invalid date rejection",()=>{expect(payappDate("20261113110000")).toBe("2026-11-13T02:00:00.000Z");expect(()=>payappDate("20260230110000")).toThrow();});
  test.each([29,30,31])("January %s clamps to February and restores March anchor",(day: number)=>{
    const first=`2026-01-${day}T01:00:00.000Z`;
    expect(payappNextDate(first,first)).toBe("2026-02-28T01:00:00.000Z");
    expect(payappNextDate(first,"2026-02-28T01:00:00.000Z")).toBe(`2026-03-${day}T01:00:00.000Z`);
  });
  test("UTC prior day still follows Korean calendar day",()=>{const at="2026-01-30T15:10:00.000Z";expect(payappNextDate(at,at)).toBe("2026-02-27T15:10:00.000Z");});
  test("leap February clamps to the 29th",()=>{const at="2028-01-31T01:00:00.000Z";expect(payappNextDate(at,at)).toBe("2028-02-29T01:00:00.000Z");});
  test("request date does not determine displayed next payment",()=>{const approved="2026-11-14T02:00:00.000Z";expect(payappNextDate(approved,approved)).toBe("2026-12-14T02:00:00.000Z");});
});

describe("partial cancellation fields", () => {
  test.each(["70", "71"])("state %s retains original transaction and cancellation amount", async (state) => {
    const n = await authenticatePayappNotice(await notice({pay_state: state, price: "5000", orig_mul_no: "456", orig_price: "30000", mul_no: "789"}), fixture, now);
    expect(n.price).toBe(5000); expect(n.orig_mul_no).toBe("456"); expect(n.orig_price).toBe(30000);
  });
  test.each([{orig_price: "29000"}, {orig_mul_no: undefined}, {price: "30000"}])("rejects mismatched partial reference %j", async (override) => {
    await expect(authenticatePayappNotice(await notice({pay_state: "70", price: "5000", orig_mul_no: "456", orig_price: "30000", ...override}), fixture, now)).rejects.toThrow();
  });
  test("a cancellation amount cannot masquerade as a successful subscription", async () => {
    await expect(authenticatePayappNotice(await notice({pay_state: "4", price: "5000", orig_mul_no: "456", orig_price: "30000"}), fixture, now)).rejects.toThrow();
  });
});