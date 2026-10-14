import { it } from "node:test";
import { strict as assert } from "node:assert";
import { clearWhiteBackdrop } from "./item-cutout";
it("removes white backdrop but preserves enclosed white furniture detail and original pixels", () => {
  const pixels = new Uint8ClampedArray(5 * 5 * 4).fill(255);
  for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) {
    if (x === 2 && y === 2) continue;
    const i = (y * 5 + x) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = 60;
  }
  const next = clearWhiteBackdrop(pixels, 5, 5);
  assert.equal(next[3], 0);
  assert.equal(next[(2 * 5 + 2) * 4 + 3], 255);
  assert.equal(next[(1 * 5 + 1) * 4 + 3], 255);
  assert.equal(pixels[3], 255);
});
it("preserves white object surfaces on already transparent images", () => {
  const pixels = new Uint8ClampedArray(3 * 3 * 4);
  pixels.set([70,70,70,255], 3 * 4);
  pixels.set([255,255,255,255], 4 * 4);
  pixels.set([70,70,70,255], 5 * 4);
  assert.deepEqual(clearWhiteBackdrop(pixels, 3, 3), pixels);
});