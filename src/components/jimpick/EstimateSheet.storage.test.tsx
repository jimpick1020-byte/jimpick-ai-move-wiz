import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EstimateSheet } from "./EstimateSheet";
import type { Estimate } from "@/lib/jimpick";

/** 실제 저장된 JP-2026-1025-001의 보관 값과 같은 형태 */
const storageDraft = {
  sheetNo: "JP-2026-1025-001",
  customerName: "김호영",
  moveType: "반포장이사",
  storageEnabled: true,
  storageStart: "2026-10-27",
  storageEnd: "2026-11-04",
  storageDaily: 6000,
  options: [],
  rooms: [],
} as unknown as Estimate;

function renderSheet(draft: Estimate, forCustomer = false) {
  return renderToStaticMarkup(
    createElement(EstimateSheet, {
      draft,
      rooms: [],
      parts: [
        { label: "기본 운송료", amount: 500000 },
        { label: "보관료", amount: 48000 },
      ],
      total: 548000,
      forCustomer,
    }),
  );
}

describe("견적서 보관 정보 카드", () => {
  it("사장님 견적서에 보관 기간·하루 보관료·총 보관료의 실제 저장값을 표시한다", () => {
    const html = renderSheet(storageDraft);
    expect(html).toContain("보관 정보");
    expect(html).toContain("보관 기간");
    expect(html).toContain("2026. 10. 27");
    expect(html).toContain("2026. 11. 04");
    expect(html).toContain("8일");
    expect(html).toContain("하루 보관료");
    expect(html).toContain("6,000");
    expect(html).toContain("총 보관료");
    expect(html).toContain("48,000");
  });

  it("고객 공유 견적서에도 동일하게 표시한다", () => {
    const html = renderSheet(storageDraft, true);
    expect(html).toContain("보관 정보");
    expect(html).toContain("48,000");
  });

  it("보관료가 0원이어도 보관 정보는 표시한다", () => {
    const html = renderSheet({ ...storageDraft, storageDaily: 0 });
    expect(html).toContain("보관 정보");
    expect(html).toContain("총 보관료");
  });

  it("보관 미사용 견적에서는 보관 정보를 숨긴다", () => {
    const html = renderSheet({ ...storageDraft, storageEnabled: false, moveType: "반포장이사" });
    expect(html).not.toContain("보관 정보");
  });
});
