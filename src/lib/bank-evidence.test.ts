import { expect, test } from "vitest";
import { bankEvidenceKey } from "./bank-sms.server";
import { normalizeSmsText } from "./bank-sms-match";

const sms = "[Web발신]\n농협 입금 90,000원\n11/14 09:45 302-****-1642-11 테스트고객 잔액 1,234,000원";
test("같은 은행 원문은 직접 붙여넣기·자동 전달·견적 내 등록에서 같은 증거 키", async () => {
  const forward = await bankEvidenceKey(normalizeSmsText(sms).slice(0, 2000));
  const paste = await bankEvidenceKey(normalizeSmsText("  " + sms.replace("[Web발신]\n", "") + "\n").slice(0, 2000));
  const estimatePaste = await bankEvidenceKey(normalizeSmsText(sms.replace(/\n/g, " ")).slice(0, 2000));
  expect(forward).toMatch(/^ev:[0-9a-f]{64}$/);
  expect(paste).toBe(forward);
  expect(estimatePaste).toBe(forward);
});
test("다른 거래 시각은 다른 키, 시각이 없는 원문은 증거 부족(null)", async () => {
  expect(await bankEvidenceKey(sms.replace("09:45", "09:46"))).not.toBe(await bankEvidenceKey(sms));
  expect(await bankEvidenceKey("농협 입금 90,000원 302-****-1642-11 테스트고객 잔액 1,234,000원")).toBeNull();
});
