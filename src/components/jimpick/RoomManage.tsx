import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ROOM_LONG_PRESS_MS = 500;

/**
 * 방 카드 길게 누르기 이동 — 약 0.5초 누르면 이동 시작, 그 전에 움직이면 일반 스크롤.
 * 놓은 위치가 바뀐 경우에만 onDrop 을 부릅니다.
 */
export function useRoomDrag(enabled: boolean, onDrop: (id: string, toIndex: number) => void) {
  const st = useRef<{
    id: string; x: number; y: number; pointerId: number; el: HTMLElement | null;
    active: boolean; timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const overRef = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  useEffect(() => {
    const block = (e: TouchEvent) => { if (st.current?.active) e.preventDefault(); };
    document.addEventListener("touchmove", block, { passive: false });
    return () => document.removeEventListener("touchmove", block);
  }, []);

  const finish = (drop: boolean) => {
    const s = st.current;
    st.current = null;
    if (!s) return;
    clearTimeout(s.timer);
    if (!s.active) return;
    if (s.el) { s.el.style.transform = ""; s.el.style.zIndex = ""; }
    const to = overRef.current;
    overRef.current = null;
    setDragId(null);
    setOverIndex(null);
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 400);
    if (drop && to !== null) onDrop(s.id, to);
  };

  const pressProps = (id: string) => ({
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      if (!enabled || e.button > 0) return;
      const el = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-room-card-id]");
      const target = e.currentTarget as HTMLElement;
      const pointerId = e.pointerId;
      const timer = setTimeout(() => {
        const s = st.current;
        if (!s) return;
        s.active = true;
        try { target.setPointerCapture(pointerId); } catch { /* 무시 */ }
        if (s.el) s.el.style.zIndex = "30";
        setDragId(id);
        navigator.vibrate?.(15);
      }, ROOM_LONG_PRESS_MS);
      st.current = { id, x: e.clientX, y: e.clientY, pointerId, el, active: false, timer };
    },
    onPointerMove: (e: RPointerEvent<HTMLElement>) => {
      const s = st.current;
      if (!s || s.pointerId !== e.pointerId) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!s.active) {
        if (Math.hypot(dx, dy) > 8) { clearTimeout(s.timer); st.current = null; }
        return;
      }
      e.preventDefault();
      if (s.el) s.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`;
      const under = document.elementsFromPoint(e.clientX, e.clientY)
        .find((n) => !s.el?.contains(n) && (n as HTMLElement).closest?.("[data-room-card-index]"));
      const card = (under as HTMLElement | undefined)?.closest<HTMLElement>("[data-room-card-index]");
      const idx = card ? Number(card.dataset.roomCardIndex) : null;
      if (idx !== null && idx !== overRef.current) { overRef.current = idx; setOverIndex(idx); }
      const scroller = s.el?.closest<HTMLElement>("[data-room-grid-scroll]");
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (e.clientY < r.top + 60) scroller.scrollTop -= 12;
        else if (e.clientY > r.bottom - 60) scroller.scrollTop += 12;
      }
    },
    onPointerUp: () => finish(true),
    onPointerCancel: () => finish(false),
    draggable: false,
    onDragStart: (e: React.DragEvent) => { if (enabled) e.preventDefault(); },
    onContextMenu: (e: React.MouseEvent) => { if (enabled) e.preventDefault(); },
    onClickCapture: (e: React.MouseEvent) => {
      if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; }
    },
  });

  return { dragId, overIndex, pressProps };
}

export function RoomMenu({ name, onRename, onDelete, disabled }: { name: string; onRename: () => void; onDelete: () => void; disabled?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" disabled={disabled} className="size-7 rounded-full" aria-label={`${name} 방 관리`}
          onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onRename}><Pencil className="size-4" /> 방 이름 변경</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} className="text-destructive"><Trash2 className="size-4" /> 방 삭제</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RoomNameDialog({ open, title, initial, validate, onSubmit, onClose }: {
  open: boolean; title: string; initial: string;
  validate: (name: string) => string | null;
  onSubmit: (name: string) => Promise<boolean> | boolean; onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setValue(initial); setError(null); } }, [open, initial]);
  const submit = async () => {
    const err = validate(value);
    if (err) { setError(err); return; }
    setBusy(true);
    try { if (await onSubmit(value)) onClose(); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Input autoFocus value={value} maxLength={20} placeholder="예) 서재, 옷방" aria-label="방 이름"
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
        {error && <p className="text-sm font-bold text-destructive">{error}</p>}
        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={onClose}>취소</Button>
          <Button className="flex-1" disabled={busy} onClick={() => void submit()}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RoomDeleteDialog({ name, onConfirm, onClose }: { name: string | null; onConfirm: () => void; onClose: () => void }) {
  return (
    <AlertDialog open={!!name} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>방 삭제</AlertDialogTitle>
          <AlertDialogDescription>이 견적에서 {name}과 이 방에 담긴 품목을 삭제할까요?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel className="mt-0 flex-1">취소</AlertDialogCancel>
          <AlertDialogAction className="flex-1 bg-destructive text-destructive-foreground" onClick={onConfirm}>삭제</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
