import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { Check, Minus, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemArt } from "@/lib/jimpick-art";
import { matchesQuery } from "@/lib/item-search";
import { displayGroupOf } from "@/lib/item-classify";
import { pickerItemLabel } from "@/lib/picker-item-label";
import { favoriteCardTapQuantity } from "@/lib/room-item-state";
import { effectiveCat5, effectiveGroup, groupRank, type ItemLayout } from "@/lib/item-families";
import { useItemDrag, type DropTarget } from "@/lib/use-item-drag";
import { DisposalX } from "./EstimateSheet";
import { PrimaryButton, TextInput } from "./ui";

export type ItemListMode = "category" | "favorites" | "picked";
export interface PickerItem { id: string; name: string; cat5?: string; sub?: string; group?: string; baseName?: string }

/** A same-page history entry; closing never navigates to another app screen. */
export function FullScreenItemFrame({ title, onClose, children, footer, level = "list" }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; level?: "list" | "form";
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const closeButton = useRef<HTMLButtonElement>(null);
  const historyToken = useRef<string | null>(null);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
    const token = historyToken.current || `jp-item-${Date.now()}-${Math.random()}`;
    historyToken.current = token;
    const focused = document.activeElement;
    const scroller = document.querySelector<HTMLElement>("[data-room-item-list]");
    const overflow = scroller?.style.overflowY;
    if (scroller) scroller.style.overflowY = "hidden";
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (history.state?.jpItemLayer !== token) history.pushState({ ...history.state, jpItemLayer: token }, "");
    const pop = (event: PopStateEvent) => {
      if (history.state?.jpItemLayer !== token) {
        event.stopImmediatePropagation();
        closeRef.current();
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && history.state?.jpItemLayer === token) {
        event.stopImmediatePropagation();
        closeRef.current();
      }
      if (event.key === "Tab" && history.state?.jpItemLayer === token) {
        const frame = closeButton.current?.closest("[data-item-layer]");
        const controls = frame?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, [tabindex="0"]');
        const first = controls?.[0];
        const last = controls?.[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("popstate", pop, true);
    document.addEventListener("keydown", key, true);
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("popstate", pop, true);
      document.removeEventListener("keydown", key, true);
      cleanupTimer.current = setTimeout(() => {
        if (history.state?.jpItemLayer === token) history.back();
      }, 0);
      if (scroller) scroller.style.overflowY = overflow || "";
      document.body.style.overflow = bodyOverflow;
      if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
    };
  }, []);
  return <div className={`fixed inset-x-0 top-0 h-[100dvh] overflow-hidden bg-card text-card-foreground ${level === "form" ? "z-[80]" : "z-10"}`} role="dialog" aria-modal="true" aria-label={title} data-item-layer>
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col">
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <h2 className="min-w-0 truncate text-lg font-black">{title}</h2>
        <Button ref={closeButton} variant="ghost" className="h-12 shrink-0 gap-1 px-2 text-base font-bold" onClick={onClose} aria-label={`${title} 닫기`}>닫기 <X className="size-7" /></Button>
      </header>
      {children}
      {footer && <footer className="shrink-0 border-t border-border bg-card px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]" data-item-layer-footer>{footer}</footer>}
    </div>
  </div>;
}

export function ItemPickerCard({ item, qty, disposed, busy, selectedMode, highlight, onTap, onQuantity, onMenu, onRemove, categoryMode, onImageTap, favoriteMode = false, dragCardDown, dragging = false }: {
  item: PickerItem; qty: number; disposed: boolean; busy: boolean; selectedMode: boolean; highlight?: boolean;
  onTap: () => void; onQuantity: (qty: number) => void; onMenu: () => void; onRemove: () => void; categoryMode?: boolean; onImageTap?: () => void; favoriteMode?: boolean;
  /** 카드 그림·이름·빈 영역을 길게 누르면 이동합니다 */
  dragCardDown?: (event: React.PointerEvent) => void;
  dragging?: boolean;
}) {
  const label = pickerItemLabel(item.id, item.name);
  const sizeMatch = /[({]\s*([^(){}]+?)\s*[)}]/.exec(item.baseName || item.name || "");
  const sizeLabel = sizeMatch?.[1];
  return <div data-picker-card={item.id} data-item-draggable={!!dragCardDown} data-item-dragging={dragging} onPointerDown={!busy ? dragCardDown : undefined} onContextMenu={dragCardDown ? (event) => event.preventDefault() : undefined} onDragStart={dragCardDown ? (event) => event.preventDefault() : undefined} onClickCapture={dragging ? (event) => { event.preventDefault(); event.stopPropagation(); } : undefined} onClick={favoriteMode ? () => { if (!busy) onTap(); } : undefined} className={`jp-item-card relative flex min-w-0 flex-col items-center rounded-lg border px-1.5 pb-1.5 pt-1 transition-shadow ${qty > 0 ? "jp-item-card-selected" : ""} ${highlight ? "ring-2 ring-auth-primary ring-offset-1" : ""} ${dragging ? "jp-item-card-dragging" : ""}`}>
    <Button data-item-drag-exclude variant="outline" size="icon" disabled={busy} className="absolute left-1 top-1 z-10 size-6 rounded-full text-muted-foreground" onClick={(event) => { event.stopPropagation(); onMenu(); }} aria-label={`${label} 품목 관리`} title="품목 관리"><MoreHorizontal className="size-4" /></Button>
    {selectedMode ? <Button data-item-drag-exclude variant="ghost" size="icon" disabled={busy} className="absolute right-1 top-1 z-10 size-7 text-destructive" onClick={onRemove} aria-label={`${label} 삭제`}><X className="size-4" /></Button> : qty > 0 && <span data-item-selected className="jp-item-check pointer-events-none absolute right-1 top-1 z-10 grid size-6 place-items-center rounded-full"><Check className="size-4" /></span>}
    <Button variant="ghost" disabled={busy} className="jp-picker-face h-auto min-h-0 w-full touch-manipulation select-none flex-col gap-0.5 whitespace-normal p-0" onClick={(event) => { if (favoriteMode) event.stopPropagation(); onTap(); }} aria-pressed={qty > 0} aria-label={`${label} 선택`}>
      <span className="relative inline-flex w-full shrink-0" onClick={!favoriteMode && onImageTap ? (event) => { event.stopPropagation(); onImageTap(); } : undefined}>
        <span className={disposed ? "jp-picker-art opacity-60" : "jp-picker-art"}><ItemArt id={item.id} name={label} size={96} /></span>
        {disposed && <DisposalX />}
      </span>
      <span className="line-clamp-2 min-h-8 w-full shrink-0 break-all text-center text-[13px] font-black leading-4" title={label}>{label}</span>
    </Button>
    {qty > 0 ? <div data-item-drag-exclude className="mt-auto flex w-full items-center justify-between gap-1" onClick={favoriteMode ? (event) => event.stopPropagation() : undefined}>
      <Button variant="outline" size="icon" disabled={busy} className="size-7 shrink-0 rounded-full text-foreground" onClick={() => onQuantity(qty - 1)} aria-label={`${label} 감소`}><Minus className="size-3.5" /></Button>
      <span className="min-w-0 truncate text-center text-[13px] font-black tabular-nums" data-item-quantity>{sizeLabel ? `${sizeLabel} · ${qty}개` : `${qty}개`}</span>
      <Button variant={favoriteMode ? "outline" : "default"} size="icon" disabled={busy} className={`size-7 shrink-0 rounded-full ${favoriteMode ? "" : "bg-auth-primary text-auth-primary-foreground"}`} onClick={() => onQuantity(qty + 1)} aria-label={`${label} 증가`}><Plus className="size-3.5" /></Button>
    </div> : null}
  </div>;
}

export function ItemListLayer({ highlightId, mode, roomName, catalog, favorites, picked, quantities, disposal, cats, tab, query, busy, onTab, onQuery, onClose, onAdd, onEdit, onTap, onImageTap, onQuantity, onMenu, onRemove, layout, onMoveItem }: {
  highlightId?: string | null; mode: ItemListMode; roomName: string; catalog: PickerItem[]; favorites: PickerItem[]; picked: PickerItem[];
  quantities: Record<string, number>; disposal?: Record<string, boolean>; cats: readonly string[]; tab: string; query: string; busy: boolean;
  onTab: (tab: string) => void; onQuery: (query: string) => void; onClose: () => void; onAdd: () => void; onEdit: () => void;
  onTap: (item: PickerItem) => void; onImageTap?: (item: PickerItem) => void; onQuantity: (item: PickerItem, qty: number) => void; onMenu: (id: string) => void; onRemove: (item: PickerItem) => void;
  /** 사장님이 직접 옮긴 배치 — 자동 분류보다 우선합니다 */
  layout?: ItemLayout;
  /** 드래그로 옮겼을 때 — 저장에 실패하면 부르는 쪽에서 되돌립니다 */
  onMoveItem?: (itemId: string, target: DropTarget) => void;
}) {
  const title = mode === "category" ? "카테고리 품목" : mode === "favorites" ? "자주 담는 품목" : `${roomName} 선택 품목`;
  const source = mode === "category" ? catalog : mode === "favorites" ? favorites : picked;
  const layoutMap = layout ?? {};
  const shown = source.filter((item) => matchesQuery(query, item.name, item.sub, item.group, effectiveGroup(item, layoutMap)) && (mode !== "category" || effectiveCat5(item, layoutMap) === tab));
  const groups: { label: string; items: PickerItem[] }[] = [];
  if (mode === "category") for (const item of shown) {
    const label = effectiveGroup(item, layoutMap);
    const hit = groups.find((g) => g.label === label);
    if (hit) hit.items.push(item); else groups.push({ label, items: [item] });
  }
  groups.sort((a, b) => groupRank(a.label) - groupRank(b.label) || a.label.localeCompare(b.label, "ko"));
  for (const g of groups) g.items.sort((a, b) => (layoutMap[a.id]?.order ?? 5000) - (layoutMap[b.id]?.order ?? 5000));
  const listRef = useRef<HTMLDivElement>(null);
  const drag = useItemDrag({
    containerRef: listRef,
    enabled: mode === "category" && !query.trim() && !!onMoveItem && !busy,
    onDrop: (itemId, target) => onMoveItem?.(itemId, target),
  });
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => document.querySelector(`[data-picker-card="${CSS.escape(highlightId)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [highlightId, tab]);
  const kinds = Object.values(quantities).filter((qty) => qty > 0).length;
  const count = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
  const card = (item: PickerItem) => <ItemPickerCard key={item.id} item={item} highlight={highlightId === item.id} qty={quantities[item.id] || 0} disposed={!!disposal?.[item.id]} busy={busy} selectedMode={mode === "picked"} categoryMode={mode === "category"} favoriteMode={mode === "favorites"} dragging={drag.dragId === item.id} dragCardDown={mode === "category" && onMoveItem && !query.trim() ? drag.onCardDown(item.id) : undefined} onTap={() => mode === "favorites" ? onQuantity(item, favoriteCardTapQuantity(quantities[item.id] || 0)) : onTap(item)} onImageTap={onImageTap ? () => onImageTap(item) : undefined} onQuantity={(qty) => onQuantity(item, qty)} onMenu={() => onMenu(item.id)} onRemove={() => onRemove(item)} />;
  return <FullScreenItemFrame title={title} onClose={onClose} footer={<><p className="mb-2 text-sm font-bold">선택 {kinds}종 · {count}개{busy ? " · 저장 중…" : ""}</p><PrimaryButton disabled={busy} onClick={onClose}>{mode === "picked" ? "변경 완료" : "선택 완료"}</PrimaryButton></>}>
    <div className="shrink-0 space-y-2 border-b border-border px-4 py-2">
      {mode === "category" && <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1">{cats.map((cat) => <Button key={cat} variant="ghost" data-category={cat} data-selected={tab === cat} className="jp-category-tab shrink-0 rounded-2xl font-black" onClick={() => onTab(cat)}>{cat}</Button>)}</div>}
      {mode === "picked" && <p className="text-sm font-bold">총 선택 {kinds}종 · {count}개</p>}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <div className="relative min-w-0"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><TextInput value={query} onChange={(event) => onQuery(event.target.value)} placeholder="품목명을 검색하세요" className="pl-9" /></div>
        {mode === "favorites" && <Button variant="outline" onClick={onEdit} className="h-11 shrink-0 font-bold">편집</Button>}
      </div>
      {mode === "category" && <div className="flex justify-end"><button type="button" onClick={onAdd} className="text-sm font-bold text-auth-primary">+ 목록에 없는 품목 추가</button></div>}
    </div>
    <div ref={listRef} className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 pb-24 pt-3 [-webkit-overflow-scrolling:touch]" data-expanded-item-list>
      {mode === "category"
        ? <div className="space-y-3">{groups.map((g) => {
          const dropHere = drag.dragId && drag.target?.group === g.label;
          return <section key={g.label} data-item-group={g.label} className={dropHere ? "rounded-xl ring-2 ring-auth-primary ring-offset-1" : ""}>
          <span className={`mb-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${dropHere ? "bg-auth-primary text-auth-primary-foreground" : "bg-muted text-muted-foreground"}`}>{g.label}{dropHere ? " — 여기에 놓기" : ""}</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">{g.items.map((item, idx) => {
            const barBefore = dropHere && drag.target?.beforeId === item.id;
            const barEnd = dropHere && drag.target?.beforeId === null && idx === g.items.length - 1;
            return <Fragment key={item.id}>{barBefore && <div className="col-span-full h-1 rounded-full bg-auth-primary" />}{card(item)}{barEnd && <div className="col-span-full h-1 rounded-full bg-auth-primary" />}</Fragment>;
          })}</div>
        </section>;
        })}</div>
        : <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3" data-flat-order={mode} data-picked-order={mode === "picked" ? "1" : undefined}>{shown.map((item) => card(item))}</div>}
      {shown.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{query ? "검색 결과가 없습니다" : "등록된 품목이 없습니다"}</p>}
    </div>
  </FullScreenItemFrame>;
}
