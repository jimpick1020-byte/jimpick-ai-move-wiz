import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { confirmOwnerInterim, startStorageInterim } from "@/lib/storage-payment.functions";
import type { TermsStatusRow } from "@/lib/terms.functions";
import { pendingReceipt } from "@/lib/payment-review";

export function InterimPaymentPanel({ estimateId, row, onSaved }: { estimateId: string; row: TermsStatusRow; onSaved?: () => void }) {
  const start = useServerFn(startStorageInterim);
  const confirm = useServerFn(confirmOwnerInterim);
  const lock = useRef(false);
  const key = useRef(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const pending = (row.paymentReceipts ?? []).filter(r => r.paymentKind === "interim" && pendingReceipt(r));
  useEffect(() => { key.current = crypto.randomUUID(); setAmount(""); setChecked(false); setSelected(""); setError(""); }, [estimateId]);
  if (!(Number(row.plannedInterim) > 0) || row.contractCancelled || ["canceled", "refunded"].includes(row.paymentStatus) || row.reservationPaymentChoice === "onsite_card") return null;
  const run = async (starting: boolean) => {
    if (lock.current || !checked) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = starting ? await start({ data: { estimateId, confirmed: true } }) : await confirm({ data: { estimateId, amount: Number(amount.replace(/\D/g, "")), requestKey: key.current, reviewed: true, ...(selected ? { receiptId: selected } : {}) } });
      if (!result.ok) { setError(result.error ?? "저장하지 못했습니다."); return; }
      setAmount(""); setChecked(false); setSelected(""); key.current = crypto.randomUUID();
      onSaved?.(); window.dispatchEvent(new Event("jimpick:payment-updated"));
    } catch { setError("저장하지 못했습니다. 입금 기록을 다시 확인해 주세요."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="mt-3 space-y-2 border-t border-border pt-3" aria-label="중도금 입금 확인">
    <h3 className="text-sm font-bold">중도금 입금 확인</h3>
    {!row.storageOriginCompletedAt ? <>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} disabled={busy} onChange={e => setChecked(e.target.checked)} />출발지 작업을 완료하고 보관 입고했습니다</label>
      <Button variant="staff" disabled={!checked || busy} onClick={() => void run(true)}>중도금 수납 시작</Button>
    </> : <>
      <p className="text-xs text-muted-foreground">출발지 작업 완료·보관 입고 확인됨</p>
      {pending.map(r => <label key={r.id} className="flex items-center gap-2 text-sm"><input type="radio" name={`interim-${estimateId}`} checked={selected === r.id} onChange={() => { setSelected(r.id ?? ""); setAmount(""); setChecked(false); }} />{r.depositorName} · 신고 {r.amount.toLocaleString("ko-KR")}원</label>)}
      <label className="block text-xs" htmlFor={`interim-amount-${estimateId}`}>실제 받은 중도금 (이번 입금)</label>
      <input id={`interim-amount-${estimateId}`} inputMode="numeric" value={amount} disabled={busy} onChange={e => { const digits = e.target.value.replace(/\D/g, "").slice(0, 10); setAmount(digits ? Number(digits).toLocaleString("ko-KR") : ""); }} className="w-full rounded-md border border-input bg-background p-2 text-sm" />
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={checked} disabled={busy} onChange={e => setChecked(e.target.checked)} />실제 계좌에 이 금액이 입금된 것을 확인했습니다</label>
      <Button variant="staff" disabled={busy || !checked || !Number(amount.replace(/\D/g, "")) || (pending.length > 0 && !selected)} onClick={() => void run(false)}>{busy ? "저장 중…" : "중도금 입금 확인"}</Button>
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}