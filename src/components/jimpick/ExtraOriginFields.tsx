import { Button } from '@/components/ui/button';
import { Field, Counter, MoneyInput, Card } from './ui';
import { FloorStepper } from './screens';
import { useApp } from '@/lib/jimpick';
import { HOUSE_SIZES } from '@/lib/multi-origin';
import { ENV_IMG, VEHICLE_IMG, Art3D } from '@/lib/jimpick-art';

export function ExtraOriginFields({ mode }: { mode: 'conditions' | 'size' | 'vehicles' }) {
  const { draft, updateDraft } = useApp();
  const o = draft.extraOrigin;
  if (!o) return null;
  const update = (patch: Partial<typeof o>) => updateDraft({ extraOrigin: { ...o, ...patch } });
  if (mode === 'size') return <Field label="출발지 2 평수"><div className="flex gap-2 overflow-x-auto" data-no-swipe>{HOUSE_SIZES.map(size => <Button key={size} variant={o.size === size ? 'default' : 'outline'} className="shrink-0 min-h-11" onClick={() => update({ size })}>{size}</Button>)}</div></Field>;
  if (mode === 'vehicles') return <div className="space-y-3">
    <Field label="출발지 2 작업 차량"><div className="flex items-center justify-between">5톤<Counter value={o.truck5t ?? draft.truck5t} onChange={truck5t => update({ truck5t })} min={0} max={10} /></div><div className="flex items-center justify-between">1톤<Counter value={o.truck1t ?? draft.truck1t} onChange={truck1t => update({ truck1t })} min={0} max={10} /></div></Field>
    {o.ladder && <Field label="출발지 2 사다리 금액"><MoneyInput value={o.ladderPrice || 0} onChange={ladderPrice => update({ ladderPrice, ladderManual: true, ladderNote: undefined })} step={10000} /><label className="flex gap-2 mt-2"><input type="checkbox" checked={!!o.ladderSeparate} onChange={e => update({ ladderSeparate: e.target.checked })} />출발지 2 별도</label>{o.ladderNote && <p role="alert" className="text-destructive">{o.ladderNote}</p>}</Field>}
  </div>;
  return <div className="space-y-3 border-t border-border pt-5" data-extra-origin-conditions>
    <Field label="출발지 2 작업 조건"><div className="grid grid-cols-2 gap-3">{(['계단', '엘리베이터'] as const).map(env => <Card key={env} selected={!o.ladder && o.env === env} onClick={() => update({ env, ladder: false })} className="text-center py-5"><Art3D src={ENV_IMG[env]} alt={env} size={56} className="mx-auto" /><b>{env}</b></Card>)}</div></Field>
    <Card selected={o.ladder} onClick={() => update({ ladder: !o.ladder, env: undefined, ladderManual: false })}><div className="flex items-center gap-3"><Art3D src={VEHICLE_IMG.ladder} alt="사다리차" size={48} /><b>출발지 2 사다리차 사용</b></div></Card>
    <Field label="출발지 2 층수"><FloorStepper value={o.floor ?? 1} onChange={floor => update({ floor })} label="출발지 2 층수" /></Field>
  </div>;
}