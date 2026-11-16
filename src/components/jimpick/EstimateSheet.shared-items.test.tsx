import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EstimateSheet } from "./EstimateSheet";
import { compactSharedSnapshot } from "@/lib/shared-item-repair";
import { builtinItemOf } from "@/lib/shared-item-builtin";
import { ICON3D } from "@/lib/jimpick-icon3d";
import type { Estimate } from "@/lib/jimpick";

const A = "ci_ai_aaaa000000000001";
const U1 = "33333333-3333-4333-8333-333333333333", U2 = "44444444-4444-4444-8444-444444444444";
const render = (snap: any) => renderToStaticMarkup(createElement(EstimateSheet, { draft: { options: [], rooms: [], ...snap.draft } as Estimate, rooms: snap.rooms, parts: [], total: 100000, forCustomer: true }));
const visible = (h: string) => h.replace(/<[^>]*>/g, " ");

describe("고객 공유 견적서 품목 카드", () => {
  it("각 카드는 고정된 그림 주소로 그리고, 같은 ID의 두 업체 견적을 이어 보여도 섞이지 않는다", () => {
    const one = compactSharedSnapshot({ draft: { customItems: [{ id: A, name: "1번 화장대", icon: `/api/public/item-icon/${U1}.png` }] }, rooms: [{ id: "r1", name: "안방", items: [{ id: "basket", name: "바구니", qty: 3 }, { id: A, name: A, qty: 1 }] }] } as any, [], builtinItemOf);
    const two = compactSharedSnapshot({ draft: {}, rooms: [{ id: "r2", name: "작은방", items: [{ id: A, name: A, qty: 2 }] }] } as any,
      [{ id: U2, item_id: A, display_name: "2번 서랍장", status: "ready", active: true, image_path: "b" }], builtinItemOf);
    const h1 = render(one), h2 = render(two);
    expect(visible(h1)).toContain("1번 화장대");
    expect(h1).toContain(`/api/public/item-icon/${U1}.png`);
    expect(h1).toContain(ICON3D.basket);
    expect(h1).not.toContain(U2);
    expect(visible(h2)).toContain("2번 서랍장");
    expect(h2).toContain(`/api/public/item-icon/${U2}.png`);
    expect(h2).not.toContain(U1);
    expect(visible(h1 + h2)).not.toContain(A);
  });
  it("실자료가 없으면 중립 문구와 그림 없음, 상자 그림은 쓰지 않는다", () => {
    const h = render(compactSharedSnapshot({ draft: {}, rooms: [{ id: "r", name: "작은방", items: [{ id: "ci_ai_none", name: "ci_ai_none", qty: 1 }] }] } as any, [], builtinItemOf));
    expect(visible(h)).toContain("품목 정보 없음");
    expect(h).toContain("data-no-image");
    expect(h).not.toContain("moving-box-medium");
  });
});
