import { test, expect } from "bun:test";
import { registerCustomIcons, hasStoredIcon, icon3dFor } from "@/lib/jimpick-icon3d";
test("saved AI icon wins over name", () => {
  registerCustomIcons([{ id: "ci_ai_x", icon: "/api/public/item-icon/a.png" }]);
  expect(hasStoredIcon("ci_ai_x")).toBe(true);
  expect(icon3dFor("ci_ai_x", "조립식 장농")).toBe("/api/public/item-icon/a.png");
});
