import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { newEstimate, type Estimate } from "./jimpick";
import { sheetRoomsOf } from "./sheet-edit";
import { staffSheetDetails } from "./staff-sheet-display";
import { StaffSheetView } from "@/components/jimpick/StaffSheet";
import type { StaffSheetSnapshot } from "./staff-share";
import { ICON3D } from "./jimpick-icon3d";

const draft = (): Estimate => ({ ...newEstimate(), workers: 4, kitchenStaff: 2,
  customItems: [{ id: "ci_ai_fixture", name: "합성 세탁기콤보", icon: "/assets/items-3d/appliances/drum-washing-machine.webp", cat: "가전" as const, extra: 0 }],
  rooms: [{ id: "r1", name: "안방", items: { ci_ai_fixture: 1, basket: 3 } }, { id: "r2", name: "작은방", items: { ci_ai_fixture: 2 } }],
  options: [{ id: "op", name: "벽걸이티비", enabled: true, separate: true, price: 50000 }, { id: "off", name: "미선택", enabled: false, price: 10000 }],
});
describe("staff sheet selected details", () => {
  it("preserves stored worker counts across serialization", () => {
    const d = draft();
    const saved = JSON.parse(JSON.stringify(staffSheetDetails(d, sheetRoomsOf(d))));
    expect(saved.workers).toBe(4);
    expect(saved.kitchenStaff).toBe(2);
  });
  it("keeps separate labels for selected options without including unselected work", () => {
    const d = draft();
    expect(staffSheetDetails(d, sheetRoomsOf(d)).extraWork).toEqual(["벽걸이티비 · 별도"]);
    d.options[0].separate = false;
    expect(staffSheetDetails(d, sheetRoomsOf(d)).extraWork).toEqual(["벽걸이티비"]);
  });
  it("keeps ladder separate flags including legacy global separate", () => {
    const d = { ...draft(), ladderFrom: true, ladderTo: true, ladderFromSeparate: true };
    expect(staffSheetDetails(d, []).extraWork.slice(1)).toEqual(["사다리차 출발지 · 별도", "사다리차 도착지"]);
    d.ladderSeparate = true;
    expect(staffSheetDetails(d, []).extraWork.slice(1)).toEqual(["사다리차 출발지 · 별도", "사다리차 도착지 · 별도"]);
  });
  it("uses saved custom art and real basket art in every room without quantity changes", () => {
    const d = draft();
    const details = staffSheetDetails(d, sheetRoomsOf(d));
    expect(details.rooms[0].items[0]).toMatchObject({ name: "합성 세탁기콤보", qty: 1, icon: d.customItems[0].icon });
    expect(details.rooms[0].items[1]).toMatchObject({ qty: 3, icon: ICON3D.basket });
    expect(details.rooms[1].items[0]).toMatchObject({ name: "합성 세탁기콤보", qty: 2, icon: d.customItems[0].icon });
    const snapshot = { customerName: "합성 고객", customerPhone: "", moveDate: "", moveTime: "", moveType: "", fromAddress: "", fromDetail: "", toAddress: "", toDetail: "", fromFloor: 0, toFloor: 0, workEnv: "", truckText: "", distanceKm: 0, durationMin: 0, note: "", staffName: "", staffPhone: "", ...details } satisfies StaffSheetSnapshot;
    const html = renderToStaticMarkup(createElement(StaffSheetView, { state: { loading: false, snap: snapshot } }));
    writeFileSync("/tmp/staff-sheet-fixture.html", html);
  });
});