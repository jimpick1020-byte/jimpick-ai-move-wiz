import { describe, expect, it } from "vitest";
import { createOption, findOptionCandidates } from "./option-catalog";
const catalog = [
  { id: "fridge", name: "냉장고", icon: "/fridge.webp", aliases: ["업체 냉장고"] },
  { id: "mini", name: "미니냉장고", icon: "/mini.webp" },
  { id: "sofa", name: "소파", icon: "/sofa.webp" },
];
describe("option catalog snapshots", () => {
  it("connects a single exact name", () => expect(findOptionCandidates("냉장고", catalog).map((x) => x.id)).toEqual(["fridge"]));
  it("searches aliases", () => expect(findOptionCandidates("쇼파", catalog).map((x) => x.id)).toEqual(["sofa"]));
  it("offers multiple variants without choosing", () => expect(findOptionCandidates("냉장", catalog).map((x) => x.id)).toEqual(["fridge", "mini"]));
  it("does not invent a match", () => expect(findOptionCandidates("없는품목", catalog)).toEqual([]));
  it("rejects blank names", () => expect(() => createOption("  ", 0)).toThrow());
  it("persists name ID image and price together", () => {
    const saved = JSON.parse(JSON.stringify(createOption("업체 냉장고", 63000, catalog[0])));
    expect(saved).toMatchObject({ name: "업체 냉장고", catalogItemId: "fridge", imageUrl: "/fridge.webp", price: 63000, separate: false });
    catalog[0].name = "changed later";
    expect(saved.name).toBe("업체 냉장고");
  });
});