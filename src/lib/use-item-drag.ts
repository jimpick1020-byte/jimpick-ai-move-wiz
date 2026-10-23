import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

/**
 * 품목 카드 「이동 손잡이」 드래그.
 *
 * - 손잡이에만 touch-action:none 을 주어 목록 스크롤·카드 선택·수량 버튼과 충돌하지 않게 합니다.
 * - 8px 이상 움직여야 드래그가 시작되므로 손잡이를 살짝 눌러도 아무 일도 일어나지 않습니다.
 * - 드래그 중 손가락 아래의 묶음([data-item-group])과 카드([data-picker-card])를 읽어
 *   들어갈 자리를 화면에 표시하고, 놓으면 onDrop 으로 알립니다.
 */
export interface DropTarget {
  /** 대상 묶음 제목 */
  group: string;
  /** 그 묶음 안에서 들어갈 자리 (옮기는 카드 제외) */
  index: number;
  /** 이 카드 앞에 넣습니다 (끝에 넣을 때는 null) */
  beforeId: string | null;
}

export function useItemDrag(opts: {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onDrop: (itemId: string, target: DropTarget) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const stateRef = useRef<{ id: string; startX: number; startY: number; active: boolean } | null>(null);
  const targetRef = useRef<DropTarget | null>(null);
  const onDropRef = useRef(opts.onDrop);
  onDropRef.current = opts.onDrop;

  const onHandleDown = (itemId: string) => (e: ReactPointerEvent) => {
    if (!opts.enabled) return;
    e.preventDefault();
    e.stopPropagation();
    stateRef.current = { id: itemId, startX: e.clientX, startY: e.clientY, active: false };

    const move = (ev: PointerEvent) => {
      const s = stateRef.current;
      if (!s) return;
      if (!s.active && Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY) > 8) s.active = true;
      if (!s.active) return;
      setDragId(s.id);

      // 화면 가장자리에 가까우면 목록을 따라 스크롤합니다
      const c = opts.containerRef.current;
      if (c) {
        const r = c.getBoundingClientRect();
        if (ev.clientY < r.top + 60) c.scrollTop -= 14;
        else if (ev.clientY > r.bottom - 60) c.scrollTop += 14;
      }

      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const section = el?.closest?.("[data-item-group]") as HTMLElement | null;
      if (!section) {
        targetRef.current = null;
        setTarget(null);
        return;
      }
      const group = section.getAttribute("data-item-group") || "";
      const cards = [...section.querySelectorAll("[data-picker-card]")]
        .map((n) => n.getAttribute("data-picker-card")!)
        .filter((id) => id && id !== s.id);
      const card = el?.closest?.("[data-picker-card]") as HTMLElement | null;
      const cardId = card?.getAttribute("data-picker-card");
      if (card && cardId && cardId !== s.id) {
        const rect = card.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const sameRow = Math.abs(ev.clientY - midY) < rect.height / 2;
        const before =
          ev.clientY < rect.top + rect.height * 0.4 ||
          (sameRow && ev.clientX < rect.left + rect.width / 2);
        let idx = cards.indexOf(cardId);
        if (!before) idx += 1;
        const next = { group, index: idx, beforeId: before ? cardId : null };
        targetRef.current = next;
        setTarget(next);
      } else {
        const next = { group, index: cards.length, beforeId: null };
        targetRef.current = next;
        setTarget(next);
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const s = stateRef.current;
      const t = targetRef.current;
      stateRef.current = null;
      targetRef.current = null;
      setDragId(null);
      setTarget(null);
      if (s?.active && t) onDropRef.current(s.id, t);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return { dragId, target, onHandleDown };
}
