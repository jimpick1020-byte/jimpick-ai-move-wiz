import { describe, it, expect } from "vitest";
import { depositConfirmedText } from "./deposit-notice";
describe("예약금 확인 문자", () => {
  it("이전 형식으로 금액·이사일·링크를 담는다", () => {
    const t = depositConfirmedText({ name: "김호영", deposit: 20000, total: 290000, moveDate: "2026-10-16", template: "안녕하세요. 짐도리 이사 업체입니다", link: "https://x/share/e?t=a&card=deposit", phone: "010-7566-2542" });
    expect(t).toContain("예약금: 20,000원");
    expect(t).toContain("잔금: 270,000원");
    expect(t).toContain("이사일: 2026-10-16");
    expect(t).toContain("&card=deposit");
  });
});
