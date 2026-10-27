import { test } from "node:test";
import { strict as assert } from "node:assert";
import { canShareIntakeMms, intakeMmsPayload } from "./intake-mms";

const file = new File(["existing image"], "견적잇-사전정보-안내.jpg", { type: "image/jpeg" });
const body = "[견적잇 사전정보 요청]\n\nhttps://example.test/intake/customer-specific";
test("MMS shares the actual image file and customer-specific text/link together", () => {
  const payload = intakeMmsPayload(file, body);
  assert.deepEqual(payload.files, [file]); assert.equal(payload.text, body);
  assert.equal("url" in payload, false);
});
test("capability checks include both files and text, not files alone", () => {
  let checked: ShareData | undefined;
  assert.equal(canShareIntakeMms({ share: async () => {}, canShare: (data) => { checked = data; return data?.text === body && data.files?.[0] === file; } }, file, body), true);
  assert.equal(checked?.text, body); assert.deepEqual(checked?.files, [file]);
});
test("no file-plus-text support never falls back to pretending text-only is an MMS", () => {
  assert.equal(canShareIntakeMms({ share: async () => {}, canShare: () => false }, file, body), false);
  assert.equal(canShareIntakeMms({ share: async () => {}, canShare: () => { throw new Error("unsupported"); } }, file, body), false);
});