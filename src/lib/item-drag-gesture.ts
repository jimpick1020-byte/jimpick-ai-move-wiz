/** Cancel a stationary press as soon as it becomes a scrolling gesture. */
export function reserveItemPress(x: number, y: number, activate: () => void) {
  let cancelled = false;
  const timer = setTimeout(() => { if (!cancelled) activate(); }, 500);
  const cancel = () => { cancelled = true; clearTimeout(timer); };
  return {
    cancel,
    move(nextX: number, nextY: number) {
      if (Math.hypot(nextX - x, nextY - y) > 8) { cancel(); return true; }
      return false;
    },
  };
}
