import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { claimCustomerInterim } from "@/lib/storage-payment.functions";

export function InterimClaimPanel({ token, due, pending, canClaim, onSaved }: { token: string; due: number; pending: boolean; canClaim: boolean; onSaved: () => void }) {
  const claim = useServerFn(claimCustomerInterim);
  const lock = useRef(false);
  const [checked, setChecked] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setAmount(""); setChecked(false); setError(""); }, [token, due, pending]);
  if (pending) return <div className="space-y-1 rounded-lg border border-payment-review-balance bg-payment-review-balance-soft p-3 text-center text-payment-review-balance"><strong>중도금 입금 확인 대기</strong><p className="text-sm">업체 확인 후 받은 금액에 반영됩니다.</p></div>;
  if (!canClaim) return null;
  const submit = async () => {
    if (lock.current || !checked) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await claim({ data: { token, confirmed: true, seenAmount: due, amount: Number(amount.replace(/\D/g, "")) } });
      if (result.ok) onSaved(); else setError(result.error ?? "신고를 저장하지 못했습니다.");
    } catch { setError("신고를 저장하지 못했습니다. 다시 확인해 주세요."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className="space-y-2 rounded-lg border border-payment-review-balance bg-payment-review-balance-soft p-3 text-foreground">
    <label className="block text-sm" htmlFor={`interim-claim-${token}`}>실제로 입금한 중도금</label>
    <input id={`interim-claim-${token}`} inputMode="numeric" value={amount} disabled={busy} onChange={e => { const digits = e.target.value.replace(/\D/g, "").slice(0, 10); setAmount(digits ? Number(digits).toLocaleString("ko-KR") : ""); }} className="w-full rounded-md border border-input bg-background p-2" />
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} disabled={busy} onChange={e => setChecked(e.target.checked)} />실제로 중도금을 입금했습니다</label>
    <Button variant="staff" className="w-full" disabled={busy || !checked || !Number(amount.replace(/\D/g, ""))} onClick={() => void submit()}>{busy ? "알리는 중…" : "중도금 입금했습니다"}</Button>
    <p className="text-center text-xs text-muted-foreground">업체 확인 후 받은 금액에 반영됩니다.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}