import { test } from "node:test";
import assert from "node:assert/strict";
import { drawerTiers, traceContour } from "./live-vision";

function dresser(lineYs: number[]) {
  const w = 100, h = 120;
  const m = new Uint8Array(w * h), g = new Uint8Array(w * h).fill(60);
  for (let y = 10; y <= 110; y++) for (let x = 20; x <= 80; x++) { m[y * w + x] = 1; g[y * w + x] = 200; }
  for (const ly of lineYs) for (let x = 20; x <= 80; x++) g[ly * w + x] = 40;
  return { w, h, m, g };
}

test("서랍 틈 4줄이면 5단 서랍장", () => {
  const d = dresser([30, 50, 70, 90]);
  assert.equal(drawerTiers(d.g, d.m, d.w, d.h)?.tiers, 5);
});

test("서랍 틈이 없으면 단수를 추측하지 않음", () => {
  const d = dresser([]);
  assert.equal(drawerTiers(d.g, d.m, d.w, d.h), null);
});

test("간격이 고르지 않으면 단수를 추측하지 않음", () => {
  const d = dresser([20, 24, 100]);
  assert.equal(drawerTiers(d.g, d.m, d.w, d.h), null);
});

test("물건 영역이 있으면 외곽선 점을 만든다", () => {
  const d = dresser([]);
  assert.ok(traceContour(d.m, d.w, d.h).length >= 40);
});
