import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EstimateSheet } from "./EstimateSheet";
import { registerCustomIcons } from "@/lib/jimpick-icon3d";
import { repairSharedSnapshot, idsNeedingCatalog } from "@/lib/shared-item-repair";
import { itemNameById } from "@/lib/jimpick";
import { ICON3D } from "@/lib/jimpick-icon3d";
import type { Estimate } from "@/lib/jimpick";

const builtin = (id: string) => !!itemNameById(id) || !!ICON3D[id];
const A = "ci_ai_aaaa000000000001", B = "ci_ai_bbbb000000000002";
const U = "33333333-3333-4333-8333-333333333333";

describe("고객 공유 견적서 품목 이름·그림", () => {
  it("옛 ID-only 자료를 같은 업체 카탈로그로 복구하고, 없으면 중립 문구와 그림 없음", () => {
    const bed = Object.keys(ICON3D).find((k) => itemNameById(k))!;
    const snap: any = {
      draft: { customItems: [{ id: A, name: A, icon: "/assets/items-3d/packing/moving-box-medium.webp" }], options: [], rooms: [] },
      rooms: [
        { id: "r1", name: "안방", items: [{ id: bed, name: itemNameById(bed), qty: 1 }, { id: A, name: A, qty: 1 }] },
        { id: "r2", name: "작은방", items: [{ id: B, name: B, qty: 2 }] },
      ],
    };
    expect(idsNeedingCatalog(snap, builtin)).toEqual([A, B]);
    repairSharedSnapshot(snap, [{ id: U, item_id: A, display_name: "원목 화장대", status: "ready", active: true, image_path: "x.png" }], builtin);
    registerCustomIcons(snap.draft.customItems);
    const html = renderToStaticMarkup(createElement(EstimateSheet, { draft: snap.draft as Estimate, rooms: snap.rooms, parts: [], total: 100000, forCustomer: true }));
    expect(html).toContain("원목 화장대");
    expect(html).toContain(`/api/public/item-icon/${U}.png`);
    expect(html).toContain("품목 정보 없음");
    expect(html).toContain("data-no-image");
    const visible = html.replace(/<[^>]*>/g, " ");
    expect(visible).not.toContain(A);
    expect(visible).not.toContain(B);
    expect(html).not.toContain("moving-box-medium");
    expect(html.indexOf("안방")).toBeLessThan(html.indexOf("작은방"));
  });
});
