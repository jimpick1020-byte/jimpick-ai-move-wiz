import { afterEach, describe, expect, it, vi } from "vitest";
import { reserveItemPress } from "./item-drag-gesture";

afterEach(() => vi.useRealTimers());
describe("item long press", () => {
  it("starts only after a stationary 500ms press", () => {
    vi.useFakeTimers();
    const start = vi.fn();
    reserveItemPress(10, 10, start);
    vi.advanceTimersByTime(499);
    expect(start).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(start).toHaveBeenCalledTimes(1);
  });
  it("a short tap cannot start movement", () => {
    vi.useFakeTimers();
    const start = vi.fn();
    const press = reserveItemPress(10, 10, start);
    vi.advanceTimersByTime(150); press.cancel();
    vi.advanceTimersByTime(500);
    expect(start).not.toHaveBeenCalled();
  });
  it("scrolling before activation cancels the reservation", () => {
    vi.useFakeTimers();
    const start = vi.fn();
    const press = reserveItemPress(10, 10, start);
    expect(press.move(10, 19)).toBe(true);
    vi.advanceTimersByTime(500);
    expect(start).not.toHaveBeenCalled();
  });
  it("small finger jitter does not cancel a long press", () => {
    vi.useFakeTimers();
    const start = vi.fn();
    const press = reserveItemPress(10, 10, start);
    expect(press.move(13, 13)).toBe(false);
    vi.advanceTimersByTime(500);
    expect(start).toHaveBeenCalledTimes(1);
  });
  it("cancelled touch never starts movement", () => {
    vi.useFakeTimers();
    const start = vi.fn();
    reserveItemPress(10, 10, start).cancel();
    vi.advanceTimersByTime(1000);
    expect(start).not.toHaveBeenCalled();
  });
});