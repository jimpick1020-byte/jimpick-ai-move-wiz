import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EstimateSheet } from "./EstimateSheet";
import type { Estimate } from "@/lib/jimpick";

const draft = { sheetNo: "JP-TEST-001", customerName: "시험", options: [], rooms: [] } as unknown as Estimate;
const text = (total: number, paidDeposit?: number) => renderToStaticMarkup(createElement(EstimateSheet, {
  draft, rooms: [], parts: [{ label: "기본 운송료", amount: total }], total, showTerms: false, paidDeposit,
})).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

it("confirmed 100,000 on 1,400,000 shows 예약금 100,000 and 잔금 1,300,000", () => {
  const t = text(1400000, 100000);
  expect(t).toContain("예약금 (입금완료) 100,000");
  expect(t).toContain("잔금 1,300,000");
});
it("after raising the total to 1,500,000 the confirmed 100,000 stays and 잔금 is 1,400,000", () => {
  const t = text(1500000, 100000);
  expect(t).toContain("예약금 (입금완료) 100,000");
  expect(t).toContain("잔금 1,400,000");
});
it("without a confirmed deposit the planned 140,000 is shown, not marked paid", () => {
  const t = text(1400000, 0);
  expect(t).not.toContain("입금완료");
  expect(t).toContain("잔금 1,260,000");
});
