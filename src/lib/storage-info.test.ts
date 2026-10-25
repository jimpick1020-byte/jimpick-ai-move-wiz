import { describe, expect, it } from "vitest";
import { storageDays, storageFeeOf, usesStorage, type Estimate } from "./jimpick";

const base = {
  moveType: "반포장이사",
  storageEnabled: false,
  storageStart: "",
  storageEnd: "",
  storageDaily: 0,
} as unknown as Estimate;

describe("보관 정보 표시·계산 규칙", () => {
  it("보관을 켠 견적은 보관료가 0원이어도 보관 정보를 표시한다", () => {
    const e = { ...base, storageEnabled: true, storageDaily: 0 };
    expect(usesStorage(e)).toBe(true);
    expect(storageFeeOf(e)).toBe(0);
  });

  it("보관이사 유형이면 storageEnabled 없이도 보관 정보를 표시한다", () => {
    expect(usesStorage({ ...base, moveType: "보관이사" })).toBe(true);
  });

  it("보관 미사용 견적은 보관 정보를 숨긴다", () => {
    expect(usesStorage(base)).toBe(false);
    expect(storageFeeOf(base)).toBe(0);
  });

  it("보관료는 실제 저장값(시작일·종료일·하루 보관료)으로 계산한다", () => {
    const e = {
      ...base,
      storageEnabled: true,
      storageStart: "2026-10-27",
      storageEnd: "2026-11-04",
      storageDaily: 6000,
    };
    expect(storageDays(e.storageStart, e.storageEnd)).toBe(8);
    expect(storageFeeOf(e)).toBe(48000);
  });
});
