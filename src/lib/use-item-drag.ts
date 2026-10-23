import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { reserveItemPress } from "./item-drag-gesture";

export interface DropTarget {
  group: string;
  index: number;
  beforeId: string | null;
}

/** Native scrolling remains available until the stationary long press activates. */
export function useItemDrag(opts: {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onDrop: (itemId: string, target: DropTarget) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const onDropRef = useRef(opts.onDrop);
  onDropRef.current = opts.onDrop;
  useEffect(() => () => cleanupRef.current?.(), []);
  useEffect(() => { if (!opts.enabled) cleanupRef.current?.(); }, [opts.enabled]);

  const onCardDown = (itemId: string) => (e: ReactPointerEvent) => {
    if (!opts.enabled || e.button !== 0 || !e.isPrimary) return;
    const hit = e.target instanceof Element ? e.target : null;
    if (hit?.closest('[data-item-drag-exclude]')) return;
    cleanupRef.current?.();
    const card = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    let active = false;
    let ended = false;
    let x = e.clientX;
    let y = e.clientY;
    let dropTarget: DropTarget | null = null;
    let frame = 0;
    const container = opts.containerRef.current;
    const updateTarget = () => {
      const section = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-item-group]');
      if (!section || !container?.contains(section)) {
        dropTarget = null;
        setTarget(null);
        return;
      }
      const cards = [...section.querySelectorAll<HTMLElement>('[data-picker-card]')]
        .filter((n) => n.dataset.pickerCard && n.dataset.pickerCard !== itemId);
      const at = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-picker-card]');
      let index = cards.length;
      if (at && at !== card) {
        const rect = at.getBoundingClientRect();
        const before = y < rect.top + rect.height * 0.4 || x < rect.left + rect.width / 2;
        const hitIndex = cards.indexOf(at);
        if (hitIndex >= 0) index = hitIndex + (before ? 0 : 1);
      }
      dropTarget = { group: section.dataset.itemGroup || '', index, beforeId: cards[index]?.dataset.pickerCard || null };
      setTarget(dropTarget);
    };
    const scrollFrame = () => {
      if (!active || ended) return;
      if (container) {
        const rect = container.getBoundingClientRect();
        const edge = Math.min(60, rect.height / 4);
        const speed = y < rect.top + edge ? -Math.min(14, (rect.top + edge - y) / 4)
          : y > rect.bottom - edge ? Math.min(14, (y - rect.bottom + edge) / 4) : 0;
        if (speed) { container.scrollTop += speed; updateTarget(); }
      }
      frame = requestAnimationFrame(scrollFrame);
    };
    const suppressClick = () => {
      // Capture the trailing click before image, selection or quantity handlers see it.
      const swallow = (event: MouseEvent) => {
        if (event.target instanceof Node && card.contains(event.target)) {
          event.preventDefault(); event.stopImmediatePropagation();
        }
      };
      document.addEventListener('click', swallow, true);
      setTimeout(() => document.removeEventListener('click', swallow, true), 700);
    };
    const finish = (save: boolean) => {
      if (ended) return;
      ended = true;
      reservation.cancel();
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('touchmove', touchMove);
      document.removeEventListener('touchstart', extraTouch);
      document.removeEventListener('keydown', key);
      card.removeEventListener('lostpointercapture', cancel);
      container?.removeEventListener('scroll', scroll);
      if (card.hasPointerCapture(pointerId)) card.releasePointerCapture(pointerId);
      cleanupRef.current = null;
      setDragId(null); setTarget(null);
      if (active) suppressClick();
      if (save && active && dropTarget) onDropRef.current(itemId, dropTarget);
    };
    const reservation = reserveItemPress(x, y, () => {
      active = true;
      setDragId(itemId);
      try { card.setPointerCapture(pointerId); } catch { /* Touch may have already ended. */ }
      updateTarget();
      frame = requestAnimationFrame(scrollFrame);
    });
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      x = event.clientX; y = event.clientY;
      if (!active) { if (reservation.move(x, y)) finish(false); return; }
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      updateTarget();
    };
    const touchMove = (event: TouchEvent) => {
      if (active && event.cancelable) event.preventDefault();
    };
    const up = (event: PointerEvent) => { if (event.pointerId === pointerId) finish(true); };
    const cancel = () => finish(false);
    const extraTouch = (event: TouchEvent) => { if (event.touches.length > 1) cancel(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    const scroll = () => { if (!active) cancel(); };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    document.addEventListener('touchmove', touchMove, { passive: false });
    document.addEventListener('touchstart', extraTouch, { passive: true });
    document.addEventListener('keydown', key);
    card.addEventListener('lostpointercapture', cancel);
    container?.addEventListener('scroll', scroll, { passive: true });
    cleanupRef.current = cancel;
  };
  return { dragId, target, onCardDown };
}
