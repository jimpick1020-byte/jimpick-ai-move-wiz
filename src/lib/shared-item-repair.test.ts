import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compactSharedSnapshot, idsNeedingCatalog, isPlaceholderName, loadOwnerCatalogRows, normalizeIcon,
  serializeSharedSnapshot, NO_IMAGE_ICON, UNKNOWN_ITEM_NAME, FAKE_DEFAULT_BOX, type CatalogRow,
} from "./shared-item-repair";
import { builtinItemOf } from "./shared-item-builtin";
import { ICON3D } from "./jimpick-icon3d";

const A = "ci_ai_d03b6e45b1cb40e8", B = "ci_ai_43f5c0a5472f45c5";
const U1 = "11111111-1111-4111-8111-111111111111", U2 = "22222222-2222-4222-8222-222222222222";
const route = (u: string) => `/api/public/item-icon/${u}.png`;
const items = (s: any, r = 0) => s.rooms[r].items as any[];

test("recovers from the saved snapshot alone, without any catalog lookup", () => {
  const s: any = { draft: { customItems: [{ id: A, name: "원목 화장대", icon: route(U1) }] }, rooms: [{ items: [{ id: A, name: A, qty: 1 }] }] };
  assert.deepEqual(idsNeedingCatalog(s, builtinItemOf), []);
  const out = compactSharedSnapshot(s, [], builtinItemOf);
  assert.equal(items(out)[0].name, "원목 화장대");
  assert.equal(items(out)[0].icon, route(U1));
});

test("built-in ID-only rows use the saved alias and the card's own picture; same ID in two rooms matches", () => {
  const s: any = { draft: { itemNames: { box: "이사박스(대)" } }, rooms: [
    { name: "안방", items: [{ id: "box", name: "box", qty: 3 }, { id: "basket", name: "", qty: 2 }] },
    { name: "작은방", items: [{ id: "box", name: "이사박스(대)", qty: 1 }] }] };
  const out = compactSharedSnapshot(s, [], builtinItemOf);
  assert.deepEqual(items(out).map((i) => [i.name, i.qty, i.icon]), [["이사박스(대)", 3, ICON3D.box], [builtinItemOf("basket", "")!.name, 2, ICON3D.basket]]);
  assert.deepEqual([items(out, 1)[0].name, items(out, 1)[0].icon], ["이사박스(대)", ICON3D.box]);
});

test("names with slashes or maker labels are real names, not file paths", () => {
  for (const n of ["책장/수납장", "LG 오브제/냉장고", "삼성 비스포크 4도어"]) assert.equal(isPlaceholderName(n, A), false);
  for (const n of [A, "ci_x", "/storage/a.png", "a.webp", "https://x/y", ""]) assert.equal(isPlaceholderName(n, A), true);
});

test("a broken row never breaks the rest of the estimate", () => {
  const s: any = { draft: {}, rooms: [{ items: [null, { qty: 1 }, { id: A, name: "책장/수납장", qty: 1, icon: route(U1) }] }, null, { items: "x" }] };
  const out = compactSharedSnapshot(s, [], builtinItemOf);
  assert.equal(items(out)[2].name, "책장/수납장");
  assert.equal(out.rooms!.length, 3);
});

test("public copy keeps only picked items, even with a long company catalog, and never truncates", () => {
  const catalog = Array.from({ length: 3000 }, (_, i) => ({ id: `ci_ai_${String(i).padStart(16, "0")}`, name: `업체 품목 ${i} 아주 긴 설명이 붙은 이름`, cat: "기타", extra: 0, icon: route(U2) }));
  const names = Object.fromEntries(catalog.map((c) => [c.id, c.name]));
  const s: any = { draft: { customItems: catalog, itemNames: names, total: 500000 }, rooms: [{ items: [{ id: catalog[5].id, name: catalog[5].name, qty: 2 }] }], total: 500000 };
  assert.ok(JSON.stringify(s).length > 300_000);
  const json = serializeSharedSnapshot(s, builtinItemOf)!;
  const out = JSON.parse(json);
  assert.deepEqual(out.draft.customItems.map((c: any) => c.id), [catalog[5].id]);
  assert.deepEqual(Object.keys(out.draft.itemNames), [catalog[5].id]);
  assert.equal(out.draft.total, 500000);
  assert.equal(s.draft.customItems.length, 3000); // original catalog untouched
  const huge: any = { draft: {}, rooms: [{ items: Array.from({ length: 5000 }, (_, i) => ({ id: `x${i}`, name: "가".repeat(60), qty: 1 })) }] };
  assert.equal(serializeSharedSnapshot(huge, builtinItemOf), null);
});

test("only approved durable app picture paths are accepted", () => {
  assert.equal(normalizeIcon(`${route(U1)}?v=1731744000000`), `${route(U1)}?v=1731744000000`);
  assert.equal(normalizeIcon(`https://gyeonjeokit.lovable.app${route(U1)}`), route(U1));
  for (const bad of ["https://evil.example/a.png", "blob:x", "data:image/png;base64,AA", "https://x.supabase.co/storage/v1/object/sign/a.png?token=1", "/assets/../secret.png"]) assert.equal(normalizeIcon(bad), null);
  const s: any = { draft: { customItems: [{ id: A, name: "화장대", icon: "https://evil.example/a.png" }] }, rooms: [{ items: [{ id: A, name: "화장대", qty: 1, icon: FAKE_DEFAULT_BOX }] }] };
  assert.deepEqual(idsNeedingCatalog(s, builtinItemOf), [A]);
  assert.equal(items(compactSharedSnapshot(s, [], builtinItemOf))[0].icon, NO_IMAGE_ICON);
});

test("old ID-only links use the owner's catalog; deleted rows keep name without picture; nothing → neutral", () => {
  const s: any = { draft: { customItems: [{ id: A, name: A, icon: FAKE_DEFAULT_BOX }] }, rooms: [{ items: [{ id: A, name: A, qty: 1 }] }, { items: [{ id: B, name: B, qty: 1, disposal: true }, { id: "ci_none", name: "ci_none", qty: 4 }] }] };
  const rows: CatalogRow[] = [
    { id: U1, item_id: A, display_name: "회사 화장대", status: "ready", active: true, image_path: "a.png" },
    { id: U2, item_id: B, display_name: "옛 책장", status: "ready", active: false, image_path: "b.png" }];
  const out = compactSharedSnapshot(s, rows, builtinItemOf);
  assert.deepEqual([items(out)[0].name, items(out)[0].icon], ["회사 화장대", route(U1)]);
  assert.deepEqual([items(out, 1)[0].name, items(out, 1)[0].icon, items(out, 1)[0].disposal], ["옛 책장", NO_IMAGE_ICON, true]);
  assert.deepEqual([items(out, 1)[1].name, items(out, 1)[1].icon, items(out, 1)[1].qty], [UNKNOWN_ITEM_NAME, NO_IMAGE_ICON, 4]);
});

test("catalog lookup is owner-scoped, chunked, and never mixes companies with the same ID", async () => {
  const db: (CatalogRow & { user_id: string })[] = [
    { user_id: "co1", id: U1, item_id: A, display_name: "1번 업체 화장대", status: "ready", active: true, image_path: "a" },
    { user_id: "co2", id: U2, item_id: A, display_name: "2번 업체 서랍장", status: "ready", active: true, image_path: "b" }];
  const calls: [string, number][] = [];
  const query = async (owner: string, ids: string[]) => { calls.push([owner, ids.length]); return db.filter((r) => r.user_id === owner && ids.includes(r.item_id)); };
  const many = [A, ...Array.from({ length: 249 }, (_, i) => `ci_q${i}`)];
  const rows1 = await loadOwnerCatalogRows(query, "co1", many);
  assert.deepEqual(calls, [["co1", 100], ["co1", 100], ["co1", 50]]);
  const rows2 = await loadOwnerCatalogRows(query, "co2", [A]);
  const snap = () => ({ draft: {}, rooms: [{ items: [{ id: A, name: A, qty: 1 }] }] }) as any;
  assert.equal(items(compactSharedSnapshot(snap(), rows1, builtinItemOf))[0].name, "1번 업체 화장대");
  assert.equal(items(compactSharedSnapshot(snap(), rows2, builtinItemOf))[0].name, "2번 업체 서랍장");
  const failing = await loadOwnerCatalogRows(async () => { throw new Error("x"); }, "co1", [A]);
  assert.deepEqual(failing, []);
});
