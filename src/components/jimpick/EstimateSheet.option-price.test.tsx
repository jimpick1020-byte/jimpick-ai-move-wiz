import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EstimateSheet } from "./EstimateSheet";
import { calcEstimate, type Estimate } from "@/lib/jimpick";

/** 6단계에서 155,000원을 입력한 옵션(견적에 포함)을 가진 견적 */
const draft = {
  sheetNo: "JP-2026-1026-001",
  customerName: "테스트고객",
  moveType: "반포장이사",
  options: [{ id: "op1", name: "정수기냉장고", enabled: true, separate: false, price: 155000 }],
  rooms: [],
} as unknown as Estimate;

function renderSheet(draftValue: Estimate, forCustomer = false) {
  const { parts, total } = calcEstimate(draftValue);
  return renderToStaticMarkup(
    createElement(EstimateSheet, { draft: draftValue, rooms: [], parts, total, forCustomer }),
  );
}

describe("견적서 옵션 비용 만 원 올림", () => {
  it("사장님 견적서의 옵션 행과 비용 상세에 올린 금액만 표시한다", () => {
    const html = renderSheet(draft);
    expect(html).toContain("160,000");
    expect(html).not.toContain("155,000");
    expect(html).toContain("추가 작업비");
  });

  it("고객 공유 견적서에도 올린 금액을 표시한다", () => {
    const html = renderSheet(draft, true);
    expect(html).toContain("160,000");
    expect(html).not.toContain("155,000");
  });

  it("이미 만 원 단위인 금액은 그대로 표시한다", () => {
    const html = renderSheet({
      ...draft,
      options: [{ id: "op1", name: "정수기냉장고", enabled: true, separate: false, price: 150000 }],
    } as unknown as Estimate);
    expect(html).toContain("150,000");
  });
});
