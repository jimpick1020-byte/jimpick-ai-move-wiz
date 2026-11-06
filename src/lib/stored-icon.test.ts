import { test } from "node:test";
import { strict as assert } from "node:assert";
import { registerCustomIcons, hasStoredIcon, icon3dFor } from "./jimpick-icon3d";
test("saved AI icon wins over name", () => {
  registerCustomIcons([{ id: "ci_ai_x", icon: "/api/public/item-icon/a.png" }]);
  assert.equal(hasStoredIcon("ci_ai_x"), true);
  assert.equal(icon3dFor("ci_ai_x", "조립식 장농"), "/api/public/item-icon/a.png");
});
