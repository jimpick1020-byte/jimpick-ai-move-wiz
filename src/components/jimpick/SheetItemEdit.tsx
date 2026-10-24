import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ItemArt } from '@/lib/jimpick-art';
import { isDoubleTap, toggleSheetDisposal } from '@/lib/sheet-edit';
import type { Estimate } from '@/lib/jimpick';
import { DisposalX } from './EstimateSheet';

export function SheetItemEdit({ item, roomId, draft, onSave }: {
  item: { id: string; name: string; qty: number; disposal?: boolean }; roomId: string; draft: Estimate;
  onSave?: (patch: Partial<Estimate>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const first = useRef<{ at: number; x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const lock = useRef(false);
  async function toggle() {
    if (!onSave || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await onSave(toggleSheetDisposal(draft, roomId, item.id)); }
    catch (err) { setError(err instanceof Error ? err.message : '저장하지 못했습니다.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="min-w-0" data-sheet-item={item.id}>
    <div className="flex min-w-0 items-center gap-1.5">
      <span role={onSave ? 'button' : undefined} tabIndex={onSave ? 0 : undefined} aria-label={onSave ? `${item.name} 폐기 ${item.disposal ? '해제' : '표시'}` : undefined}
        className="relative flex h-[46px] w-[46px] shrink-0 touch-pan-y select-none items-center justify-center overflow-hidden rounded-lg border border-border bg-card"
        onPointerDown={e => { start.current = { x: e.clientX, y: e.clientY }; }}
        onPointerCancel={() => { start.current = null; first.current = null; }}
        onPointerUp={e => {
          const origin = start.current; start.current = null;
          if (!onSave || busy || !origin || Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 10) { first.current = null; return; }
          const tap = { at: Date.now(), x: e.clientX, y: e.clientY };
          if (isDoubleTap(first.current, tap)) { first.current = null; void toggle(); }
          else first.current = tap;
        }} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') void toggle(); }}>
        <ItemArt id={item.id} name={item.name} size={40} />{item.disposal && <DisposalX />}
      </span>
      {onSave ? <Button variant="ghost" className="h-auto min-w-0 justify-start whitespace-normal p-0 text-left" aria-label={`${item.name} 품목 수정`} onClick={() => { setName(item.name); setQty(item.qty); setEditing(true); setError(''); }}><span><span className="block break-words">{item.name}</span><span className="block">{item.qty}</span></span></Button> : <span className="min-w-0 text-base text-foreground"><span className="block break-words">{item.name}</span><span className="block font-bold">{item.qty}</span></span>}
    </div>
    {editing && <form className="jp-sheet-inline mt-2 space-y-2" onSubmit={async e => {
      e.preventDefault(); if (!onSave || busy) return;
      if (!name.trim() || !Number.isInteger(qty) || qty < 1) { setError('이름과 1 이상의 수량을 입력해 주세요.'); return; }
      setBusy(true);
      try { await onSave({ itemNames: { ...draft.itemNames, [item.id]: name.trim() }, rooms: draft.rooms.map(r => r.id === roomId ? { ...r, items: { ...r.items, [item.id]: qty } } : r) }); setEditing(false); }
      catch (err) { setError(err instanceof Error ? err.message : '저장하지 못했습니다.'); } finally { setBusy(false); }
    }}><label className="block text-sm">품목 이름<input aria-label="품목 이름" disabled={busy} value={name} onChange={e => setName(e.target.value)} className="w-full rounded-md border border-input bg-card p-2 text-base" /></label><label className="block text-sm">수량<input aria-label="품목 수량" disabled={busy} type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} className="w-full rounded-md border border-input bg-card p-2 text-base" /></label><div className="flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(false)}>취소</Button><Button disabled={busy}>저장</Button></div></form>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}