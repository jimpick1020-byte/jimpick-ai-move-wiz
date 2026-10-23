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
  // Kept for callers; drop hints are rendered through data attributes instead.
  const target: DropTarget | null = null;
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
    let dirty = false;
    let last = 0;
    const startX = x, startY = y;
    const container = opts.containerRef.current;
    const startScroll = container?.scrollTop ?? 0;
    let markedSection: HTMLElement | null = null;
    let markedCard: HTMLElement | null = null;
    let markedEnd = false;
    // Drop hints are DOM attributes, not React state, so the list never re-renders while moving.
    const mark = (section: HTMLElement | null, before: HTMLElement | null, end: boolean) => {
      if (markedSection !== section) { markedSection?.removeAttribute('data-drop-group'); section?.setAttribute('data-drop-group', 'true'); markedSection = section; }
      if (markedCard !== before || markedEnd !== end) {
        markedCard?.removeAttribute('data-drop-before'); markedCard?.removeAttribute('data-drop-after');
        if (before) before.setAttribute(end ? 'data-drop-after' : 'data-drop-before', 'true');
        markedCard = before; markedEnd = end;
      }
    };
    const updateTarget = () => {
      const hit = document.elementFromPoint(x, y);
      const section = hit?.closest<HTMLElement>('[data-item-group]');
      if (!section || !container?.contains(section)) { dropTarget = null; mark(null, null, false); return; }
      const cards = [...section.querySelectorAll<HTMLElement>('[data-picker-card]')]
        .filter((n) => n.dataset.pickerCard && n.dataset.pickerCard !== itemId);
      const at = hit?.closest<HTMLElement>('[data-picker-card]');
      let index = cards.length;
      if (at && at !== card) {
        const rect = at.getBoundingClientRect();
        const before = y < rect.top + rect.height * 0.4 || x < rect.left + rect.width / 2;
        const hitIndex = cards.indexOf(at);
        if (hitIndex >= 0) index = hitIndex + (before ? 0 : 1);
      }
      const beforeEl = cards[index] ?? null;
      dropTarget = { group: section.dataset.itemGroup || '', index, beforeId: beforeEl?.dataset.pickerCard || null };
      mark(section, beforeEl ?? cards[cards.length - 1] ?? null, !beforeEl);
    };
    const place = () => {
      const dy = y - startY + ((container?.scrollTop ?? 0) - startScroll);
      card.style.transform = `translate3d(${x - startX}px, ${dy}px, 0) scale(1.03)`;
    };
    const tick = (now: number) => {
      if (!active || ended) return;
      const dt = last ? Math.min(32, now - last) : 16;
      last = now;
      if (container) {
        const rect = container.getBoundingClientRect();
        const edge = Math.min(72, rect.height / 4);
        // Eased speed proportional to depth into the edge zone, scaled by frame time.
        const depth = y < rect.top + edge ? -(rect.top + edge - y) / edge : y > rect.bottom - edge ? (y - rect.bottom + edge) / edge : 0;
        const clamped = Math.max(-1, Math.min(1, depth));
        if (clamped) {
          const before = container.scrollTop;
          container.scrollTop = before + Math.sign(clamped) * clamped * clamped * 0.9 * dt;
          if (container.scrollTop !== before) dirty = true;
        }
      }
      if (dirty) { dirty = false; place(); updateTarget(); }
      frame = requestAnimationFrame(tick);
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
      mark(null, null, false);
      card.style.transform = ''; card.style.transition = ''; card.style.pointerEvents = ''; card.style.willChange = '';
      if (active) setDragId(null);
      if (active) suppressClick();
      if (save && active && dropTarget) onDropRef.current(itemId, dropTarget);
    };
    const reservation = reserveItemPress(x, y, () => {
      active = true;
      setDragId(itemId);
      try { card.setPointerCapture(pointerId); } catch { /* Touch may have already ended. */ }
      // Let hit-testing see the cards underneath the lifted card.
      card.style.pointerEvents = 'none'; card.style.transition = 'none'; card.style.willChange = 'transform';
      place(); updateTarget();
      frame = requestAnimationFrame(tick);
    });
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      x = event.clientX; y = event.clientY;
      if (!active) { if (reservation.move(x, y)) finish(false); return; }
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      dirty = true;
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
