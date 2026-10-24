import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { Estimate } from '@/lib/jimpick';

export type SheetField = { key: keyof Estimate; label: string; type?: 'text' | 'number' | 'date' | 'time'; choices?: string[] };

export function SheetInlineEdit({ children, fields, draft, onSave, label }: {
  children: ReactNode; fields: SheetField[]; draft: Estimate;
  onSave?: (patch: Partial<Estimate>) => Promise<void>; label: string;
}) {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!onSave) return <>{children}</>;
  if (!values) return <div role="button" tabIndex={0} aria-label={`${label} 수정`} className="cursor-pointer min-w-0" onClick={() => {
    setError(''); setValues(Object.fromEntries(fields.map(f => [f.key, String(draft[f.key] ?? '')])));
  }} onKeyDown={e => { if (e.key === 'Enter') setValues(Object.fromEntries(fields.map(f => [f.key, String(draft[f.key] ?? '')]))); }}>{children}</div>;
  return <form className="jp-sheet-inline min-w-0 space-y-2 p-2" onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    const patch: Record<string, unknown> = {};
    for (const f of fields) {
      const value = values[f.key]?.trim() ?? '';
      if (value === String(draft[f.key] ?? '').trim()) continue;
      if (!value && (f.key === 'totalOverride' || f.key === 'transportOverride')) { patch[f.key] = null; continue; }
      if (f.key === 'customerName' && !value) { setError('고객 이름을 입력해 주세요.'); return; }
      if (f.type === 'number' && (!value || !Number.isFinite(Number(value)) || Number(value) < 0)) { setError('0 이상의 숫자를 입력해 주세요.'); return; }
      patch[f.key] = f.type === 'number' ? Number(value) : value;
    }
    setBusy(true); setError('');
    try { await onSave(patch as Partial<Estimate>); setValues(null); }
    catch (err) { setError(err instanceof Error ? err.message : '저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }}>
    {fields.map(f => <label key={f.key} className="block text-sm text-foreground">{f.label}
      {f.choices ? <select aria-label={f.label} disabled={busy} value={values[f.key]} onChange={e => setValues({ ...values, [f.key]: e.target.value })} className="w-full rounded-md border border-input bg-card p-2">{f.choices.map(v => <option key={v}>{v}</option>)}</select> :
      <input aria-label={f.label} disabled={busy} type={f.type || 'text'} min={f.type === 'number' ? 0 : undefined} step={f.type === 'number' ? 'any' : undefined} value={values[f.key]} onChange={e => setValues({ ...values, [f.key]: e.target.value })} className="w-full min-w-0 rounded-md border border-input bg-card p-2 text-base text-foreground" />}
    </label>)}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setValues(null)}>취소</Button><Button type="submit" disabled={busy}>{busy ? '저장 중…' : '저장'}</Button></div>
  </form>;
}