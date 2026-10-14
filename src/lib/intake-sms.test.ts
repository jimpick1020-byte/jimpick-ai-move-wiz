import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { createComposerGate, intakeSmsHref } from "./intake-sms";
import { intakeSmsText } from "./intake";

describe("통신사 문자 작성", () => {
  test("번호는 한 번, body는 URL 인코딩 한 번", () => {
    const body = intakeSmsText({ link: "https://example.test/intake/request?preview=v2" });
    const href = intakeSmsHref("010-1234-5678", body);
    assert.equal(href, `sms:01012345678?body=${encodeURIComponent(body)}`);
    assert.equal(decodeURIComponent(href.split("?body=")[1]), body);
    assert.equal(href.split("01012345678").length - 1, 1);
  });
  test("잘못된 번호로 문자 앱을 열지 않음", () => {
    assert.throws(() => intakeSmsHref("", "body"));
    assert.throws(() => intakeSmsHref("02-123-4567", "body"));
  });
  test("준비 중 두 번 클릭과 열기 직후 재클릭은 앱 한 번만 열림", async () => {
    let time = 1000; const gate = createComposerGate(() => time);
    let prepared = 0; const opened: string[] = [];
    let resolve: (value: string) => void = () => {};
    const first = gate(() => { prepared++; return new Promise<string>(done => { resolve = done; }); }, href => opened.push(href));
    assert.equal(await gate(async () => { prepared++; return "duplicate"; }, href => opened.push(href)), false);
    resolve("sms:01012345678?body=test"); await first;
    assert.equal(await gate(async () => "duplicate", href => opened.push(href)), false);
    assert.equal(prepared, 1); assert.equal(opened.length, 1);
    time += 2000;
    assert.equal(await gate(async () => "retry", href => opened.push(href)), true);
    assert.equal(opened.length, 2);
  });
  test("링크 준비 실패 후에는 다시 시도 가능", async () => {
    const gate = createComposerGate(); let count = 0;
    assert.equal(await gate(async () => null, () => count++), false);
    await assert.rejects(gate(async () => { throw new Error("failed"); }, () => count++));
    assert.equal(await gate(async () => "sms:test", () => count++), true);
    assert.equal(count, 1);
  });
});