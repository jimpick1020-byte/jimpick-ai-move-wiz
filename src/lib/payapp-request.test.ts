import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { payappRequest, PayappRequestError } from "./payapp-live.server";
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