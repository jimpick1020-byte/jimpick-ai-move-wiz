import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { payappRequest, payappRegistrationFields, PayappRequestError } from "./payapp-live.server";
import { payappRegistrationQuote } from "./payapp-live";
const keys = ["PAYAPP_USER_ID","PAYAPP_LINK_KEY","PAYAPP_REQUEST_KEY"];
let previous: (string | undefined)[];
let originalFetch: typeof fetch;
beforeEach(() => { previous = keys.map(k => process.env[k]); originalFetch = globalThis.fetch; });
afterEach(() => {
  keys.forEach((key,i) => { const value = previous[i]; if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  globalThis.fetch = originalFetch;
});
function setup(response: string | Error, status = 200) {
  for (const key of keys) process.env[key] = "synthetic-not-a-real-key";
  globalThis.fetch = async () => { if (response instanceof Error) throw response; return new Response(response,{status}); };
}
describe("registration request result classification without external requests", () => {
  test("real request builder sends order-snapshot expiry and card/no-SMS without invented validity parameter", async () => {
    setup("state=1&rebill_no=123&payurl=https%3A%2F%2Fpayapp.kr%2Fpayment");
    const quote=payappRegistrationQuote(new Date("2028-02-29T02:00:00Z"));
    const fields=payappRegistrationFields({id:"synthetic-order",user_id:"synthetic-company",requested_day:quote.day,rebill_expire:quote.expire},"synthetic-phone");
    let captured: URLSearchParams | null = null;
    globalThis.fetch = async (_input,init) => { captured=new URLSearchParams(String(init?.body)); return new Response("state=1&rebill_no=123"); };
    await payappRequest("rebillRegist",fields);
    expect(captured).not.toBeNull();
    const body=new URLSearchParams(String(captured));
    expect(body.get("rebillExpire")).toBe("2033-02-28"); expect(body.get("rebillCycleMonth")).toBe("29");
    expect(body.get("goodprice")).toBe("30000"); expect(body.get("openpaytype")).toBe("card"); expect(body.get("smsuse")).toBe("n");
    expect(Object.keys(fields).sort()).toEqual(["goodname","goodprice","recvphone","rebillCycleType","rebillCycleMonth","rebillExpire","smsuse","openpaytype","var1","var2","feedbackurl","failurl","returnurl"].sort());
  });
  test("definitive state=0 rejection is retryable without revealing raw text", async () => {
    setup("state=0&errno=70020&errorMessage=secret-card-person-key");
    try { await payappRequest("rebillRegist",{}); throw new Error("expected rejection"); } catch(e) {
      expect(e).toBeInstanceOf(PayappRequestError); expect((e as PayappRequestError).definitive).toBe(true);
      expect((e as Error).message).toContain("70020"); expect((e as Error).message).not.toContain("secret-card-person-key");
    }
  });
  test.each(["", "state=0&errno=99999", "state=0&rebill_no=123", "state=0&state=1", "state=unknown"])('ambiguous response "%s" retains lock', async (text) => {
    setup(text); await expect(payappRequest("rebillRegist",{})).rejects.toMatchObject({definitive:false});
  });
  test("timeout does not expose network exception/keys and keeps lock", async () => {
    setup(new Error("secret-key lost response")); await expect(payappRequest("rebillRegist",{})).rejects.toMatchObject({definitive:false});
  });
  test("HTTP failure remains ambiguous even with state=0", async () => {
    setup("state=0&errno=70020",503); await expect(payappRequest("rebillRegist",{})).rejects.toMatchObject({definitive:false});
  });
  test("success response returns only registration number and URL", async () => {
    setup("state=1&rebill_no=123&payurl=https%3A%2F%2Fpayapp.kr%2Fpayment&linkkey=secret&card_num=secret&errorMessage=secret");
    expect(Object.fromEntries(await payappRequest("rebillRegist",{}))).toEqual({rebill_no:"123",payurl:"https://payapp.kr/payment"});
  });
});