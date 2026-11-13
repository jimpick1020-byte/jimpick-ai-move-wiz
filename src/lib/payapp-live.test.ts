import { describe, expect, test } from "vitest";
import { authenticatePayappNotice, payappDate, payappNextDate, payappReadiness, safePayappUrl, sha256 } from "./payapp-live";

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
  test("merchant approval alone cannot enable live requests",()=>{
    const r=payappReadiness(fixture,new Date(now)); expect(r.ready).toBe(false); expect(r.issues.length).toBe(3);
  });
  test("explicit verified permission, calendar and configured expiry enable requests",()=>{
    expect(payappReadiness({...fixture,PAYAPP_REBILL_APPROVED:"true",PAYAPP_MONTH_POLICY_CONFIRMED:"true",PAYAPP_REBILL_EXPIRE:"2027-11-13"},new Date(now)).ready).toBe(true);
  });
  test("expired provider contract disables requests",()=>{expect(payappReadiness({...fixture,PAYAPP_REBILL_APPROVED:"true",PAYAPP_MONTH_POLICY_CONFIRMED:"true",PAYAPP_REBILL_EXPIRE:"2025-11-13"},new Date(now)).ready).toBe(false);});
  test("payment URL must use HTTPS and actual PayApp domain",()=>{
    expect(safePayappUrl("https://payapp.kr/payment")).toBe("https://payapp.kr/payment");
    for(const url of ["http://payapp.kr/payment","https://payapp.kr.evil.example/payment","https://evil.example/payment"]) expect(()=>safePayappUrl(url)).toThrow();
  });
});
describe("Korean actual approval anchored calendar",()=>{
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