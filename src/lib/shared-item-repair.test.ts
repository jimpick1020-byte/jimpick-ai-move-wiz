import { test } from "node:test";
import assert from "node:assert/strict";
import { idsNeedingCatalog, repairSharedSnapshot, NO_IMAGE_ICON, UNKNOWN_ITEM_NAME, FAKE_DEFAULT_BOX } from "./shared-item-repair";

const builtin = (id: string) => ["bed", "box", "basket"].includes(id);
const A = "ci_ai_d03b6e45b1cb40e8", B = "ci_ai_43f5c0a5472f45c5";
const U1 = "11111111-1111-4111-8111-111111111111", U2 = "22222222-2222-4222-8222-222222222222";
const oldSnap = () => ({
  draft: { itemNames: {}, customItems: [{ id: A, name: A, icon: FAKE_DEFAULT_BOX }] },
  rooms: [
    { id: "r1", name: "안방", items: [{ id: "bed", name: "침대(싱글)", qty: 1 }, { id: "basket", name: "바구니", qty: 3 }, { id: A, name: A, qty: 1 }] },
    { id: "r2", name: "작은방", items: [{ id: B, name: B, qty: 1, disposal: true }] },
  ],
});
const rows = [
  { id: U1, item_id: A, display_name: "회사 화장대", status: "ready", active: true, image_path: "u/a.png" },
  { id: U2, item_id: B, display_name: "옛 책장", status: "ready", active: false, image_path: "u/b.png" },
];

test("old ID-only links resolve from the estimate company's catalog, keeping rooms, order, qty and disposal", () => {
  const s = oldSnap();
  assert.deepEqual(idsNeedingCatalog(s, builtin), [A, B]);
  repairSharedSnapshot(s, rows, builtin);
  assert.deepEqual(s.rooms[0].items.map((i) => [i.id, i.name, i.qty]), [["bed", "침대(싱글)", 1], ["basket", "바구니", 3], [A, "회사 화장대", 1]]);
  assert.equal(s.rooms[1].items[0].name, "옛 책장");
  assert.equal((s.rooms[1].items[0] as { disposal?: boolean }).disposal, true);
  const icons = Object.fromEntries(s.draft.customItems.map((c: any) => [c.id, c.icon]));
  assert.equal(icons[A], `/api/public/item-icon/${U1}.png`);
  assert.equal(icons[B], NO_IMAGE_ICON); // deleted row: name kept, no unrelated box
});

test("no real data at all shows neutral text and no-image, never the ID or box", () => {
  const s = oldSnap();
  repairSharedSnapshot(s, [], builtin);
  assert.equal(s.rooms[0].items[2].name, UNKNOWN_ITEM_NAME);
  assert.ok(s.draft.customItems.every((c: any) => c.icon === NO_IMAGE_ICON));
  assert.equal(s.rooms[0].items[1].name, "바구니");
});

test("valid saved snapshot and renamed names win over the catalog", () => {
  const s = { draft: { itemNames: { [A]: "업체가 바꾼 이름" }, customItems: [{ id: A, name: "직접 등록", icon: `/api/public/item-icon/${U2}.png` }] }, rooms: [{ items: [{ id: A, name: "업체가 바꾼 이름", qty: 2 }] }] };
  assert.deepEqual(idsNeedingCatalog(s, builtin), []);
  repairSharedSnapshot(s, rows, builtin);
  assert.equal(s.rooms[0].items[0].name, "업체가 바꾼 이름");
  assert.equal((s.draft.customItems[0] as any).icon, `/api/public/item-icon/${U2}.png`);
});

test("browser-only or signed image addresses are not trusted", () => {
  for (const icon of ["blob:x", "https://x.supabase.co/storage/v1/object/sign/a.png?token=1"]) {
    const s = { draft: { customItems: [{ id: A, name: "화장대", icon }] }, rooms: [{ items: [{ id: A, name: "화장대", qty: 1 }] }] };
    repairSharedSnapshot(s as any, rows, builtin);
    assert.equal((s.draft.customItems[0] as any).icon, `/api/public/item-icon/${U1}.png`);
  }
});
