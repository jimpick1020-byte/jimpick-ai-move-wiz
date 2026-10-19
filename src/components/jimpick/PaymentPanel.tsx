import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setPaymentState, PAYMENT_STATUS_CHOICES, PAYMENT_STATUS_LABEL, normalizePaymentStatus, type PaymentStatus } from "@/lib/payment.functions";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS, completedPaymentLabel, normalizePaymentMethod, remainingPayment, type PaymentMethod } from "@/lib/payment-method";
import { pendingReceipt } from "@/lib/payment-review";
import type { TermsStatusRow } from "@/lib/terms.functions";

const won = (n: number) => `${Number(n || 0).toLocaleString("ko-KR")}원`;
export function PaymentPanel({ estimateId, total, row, onSaved }: { estimateId: string; total: number; row: TermsStatusRow; onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>(normalizePaymentStatus(row.paymentStatus));
  const [note, setNote] = useState(row.paymentNote ?? "");
  const [approval, setApproval] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [askComplete, setAskComplete] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const savePayment = useServerFn(setPaymentState);
  useEffect(() => { setStatus(normalizePaymentStatus(row.paymentStatus)); setAskComplete(false); setMethod(null); setNote(row.paymentNote ?? ""); }, [estimateId, row.paymentStatus, row.paymentNote]);
  const remain = remainingPayment(total, row.depositPaid, row.balancePaid);
  const receipts = (row.paymentReceipts ?? []).filter((r) => r.amount > 0 && ["pending_review", "confirmed"].includes(r.status) && r.paymentKind === "balance" && r.source !== "customer_claim" && (!r.paymentMethod || r.paymentMethod === "bank_transfer"));
  const pending = (row.paymentReceipts ?? []).filter(pendingReceipt);
  const label = pending.length ? "계좌이체 확인 필요" : status === "completed" ? completedPaymentLabel(row.paymentMethod) : `${PAYMENT_METHOD_LABEL[normalizePaymentMethod(row.paymentMethod)]} · ${PAYMENT_STATUS_LABEL[status]}`;
  const cancel = () => { setAskComplete(false); setMethod(null); };
  const run = async (selected?: PaymentMethod, receiptId?: string) => {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try {
      const result = await savePayment({ data: { estimateId, status: selected ? "completed" : status, note, method: selected, receiptId, approvalNumber: selected === "card" ? approval : undefined } });
      if (!result.ok) { toast.error("확인 실패", { description: result.error }); return; }
      cancel(); onSaved?.(); window.dispatchEvent(new Event("jimpick:payment-updated"));
      toast.success("결제 확인을 저장했습니다");
    } catch (error) { toast.error("저장 실패", { description: error instanceof Error ? error.message : "다시 시도해 주세요." }); }
    finally { locked.current = false; setBusy(false); }
  };
  return <section className="mt-2 rounded-lg bg-muted p-3 text-foreground" aria-label="결제 상태">
    <Button variant="ghost" className="w-full justify-between px-0 text-xs" onClick={() => setOpen(!open)}><span>결제 상태 · {label}</span><span>{open ? "닫기" : "열기"}</span></Button>
    <div className="mt-1 text-xs text-muted-foreground">총 {won(total)} · 예약금 {won(row.depositPaid)} · 잔금 {won(row.balancePaid)} · 남은 금액 <b>{won(remain)}</b></div>
    {open && <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">{PAYMENT_STATUS_CHOICES.map((s) => <Button key={s} variant={status === s ? "staff" : "outline"} disabled={busy || (s === "completed" && status === "completed")} onClick={() => { if (s === "completed") { setAskComplete(true); setMethod(null); } else { cancel(); setStatus(s); } }}>{PAYMENT_STATUS_LABEL[s]}</Button>)}</div>
      {askComplete && <div className="space-y-3 border-t border-border pt-3" aria-label="결제완료 확인">
        {!method ? <div className="grid grid-cols-2 gap-2">{PAYMENT_METHODS.map((m) => <Button key={m} variant="outline" onClick={() => setMethod(m)}>{m === "bank_transfer" ? "계좌이체" : `${PAYMENT_METHOD_LABEL[m]} 결제`}</Button>)}<Button variant="ghost" onClick={cancel}>취소</Button></div> : <>
          {method === "cash" && <><p className="text-sm font-bold">잔금 {won(remain)}을 현금으로 받으셨나요?</p><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={busy} onClick={cancel}>취소</Button><Button variant="staff" disabled={busy} onClick={() => void run("cash")}>{busy ? "저장 중…" : "현금으로 받았어요"}</Button></div></>}
          {method === "bank_transfer" && <><p className="text-sm font-bold">계좌이체 · 잔금 {won(remain)}</p>{receipts.length === 0 && <p className="text-sm text-muted-foreground">확인할 잔금 입금 기록이 없습니다.</p>}<Button variant="outline" disabled={busy} onClick={() => window.dispatchEvent(new CustomEvent("jimpick:open-bank-receipts", { detail: estimateId }))}>잔금 입금 기록 추가</Button>{receipts.map((r) => <div key={r.id} className="space-y-1 border-b border-border py-2 text-sm"><div>{r.depositorName || "이름 미확인"} · {won(r.amount)}</div><div className="text-xs text-muted-foreground">입금 시각 {r.depositedAt ? new Date(r.depositedAt).toLocaleString("ko-KR") : "기록 없음"}</div><Button variant="staff" disabled={busy || !r.id} onClick={() => void run("bank_transfer", r.id)}>계좌이체 확인</Button></div>)}<Button variant="outline" disabled={busy} onClick={cancel}>취소</Button></>}
          {method === "card" && <><p className="text-sm font-bold">결제금액 {won(remain)} · 결제수단: 카드</p><label className="block text-xs" htmlFor={`approval-${estimateId}`}>승인번호 (선택)</label><input id={`approval-${estimateId}`} value={approval} maxLength={80} onChange={(e) => setApproval(e.target.value)} className="w-full rounded-md border border-input bg-background p-2 text-sm"/><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={busy} onClick={cancel}>취소</Button><Button variant="staff" disabled={busy} onClick={() => void run("card")}>{busy ? "저장 중…" : "카드 결제 확인"}</Button></div></>}
        </>}
      </div>}
      <label className="block text-xs" htmlFor={`note-${estimateId}`}>결제 메모</label><textarea id={`note-${estimateId}`} rows={2} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className="w-full rounded-md border border-input bg-background p-2 text-sm"/>
      {row.paymentConfirmedAt && <div className="text-xs text-muted-foreground">마지막 확인 {new Date(row.paymentConfirmedAt).toLocaleString("ko-KR")} · 업체 담당자</div>}
      {!askComplete && status !== "completed" && <Button variant="staff" className="w-full" disabled={busy} onClick={() => void run()}>결제 상태 저장</Button>}
    </div>}
  </section>;
}