import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reserveItemPress } from "./item-drag-gesture";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
describe("item long press", () => {
  it("starts only after a stationary 500ms press", async () => {
    let calls = 0;
    reserveItemPress(10, 10, () => calls++);
    await wait(450); assert.equal(calls, 0);
    await wait(100); assert.equal(calls, 1);
  });
  it("a short tap cannot start movement", async () => {
    let calls = 0;
    const press = reserveItemPress(10, 10, () => calls++);
    await wait(100); press.cancel(); await wait(500);
    assert.equal(calls, 0);
  });
  it("scrolling before activation cancels the reservation", async () => {
    let calls = 0;
    const press = reserveItemPress(10, 10, () => calls++);
    assert.equal(press.move(10, 19), true);
    await wait(550); assert.equal(calls, 0);
  });
  it("small finger jitter does not cancel a long press", async () => {
    let calls = 0;
    const press = reserveItemPress(10, 10, () => calls++);
    assert.equal(press.move(13, 13), false);
    await wait(550); assert.equal(calls, 1);
  });
  it("cancelled touch never starts movement", async () => {
    let calls = 0;
    reserveItemPress(10, 10, () => calls++).cancel();
    await wait(550); assert.equal(calls, 0);
  });
});
