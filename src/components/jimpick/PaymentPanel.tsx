import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { setPaymentState, confirmOwnerBankBalance, PAYMENT_STATUS_CHOICES, PAYMENT_STATUS_LABEL, normalizePaymentStatus, type PaymentStatus } from "@/lib/payment.functions";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS, completedPaymentLabel, normalizePaymentMethod, paymentSummaryParts, remainingPayment, type PaymentMethod } from "@/lib/payment-method";
import { pendingBalanceReceipts, pendingReceipt } from "@/lib/payment-review";
import { updateEstimateTotal, type TermsStatusRow } from "@/lib/terms.functions";

type ReceiptRow = NonNullable<TermsStatusRow["paymentReceipts"]>[number];

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
  const confirmBank = useServerFn(confirmOwnerBankBalance);
  const updateTotal = useServerFn(updateEstimateTotal);
  const [finalTotals, setFinalTotals] = useState<Record<string, string>>({});
  const remain = remainingPayment(total, row.depositPaid, row.balancePaid);
  const summary = paymentSummaryParts(total, row.depositPaid, row.balancePaid);
  const receipts = pendingBalanceReceipts(row.paymentReceipts ?? [])
    .sort((a, b) => Number(b.amount === remain) - Number(a.amount === remain));
  const pending = (row.paymentReceipts ?? []).filter(pendingReceipt);
  const balancePendingKey = receipts.map((r) => r.id).join(",");
  useEffect(() => {
    const stored = normalizePaymentStatus(row.paymentStatus);
    setNote(row.paymentNote ?? "");
    // 잔금 입금 신고가 대기 중이면 결제완료·계좌이체를 미리 선택해 둡니다 (확인 버튼은 사장님이 직접 누릅니다).
    if (balancePendingKey && stored !== "completed") { setStatus("completed"); setAskComplete(true); setMethod("bank_transfer"); setOpen(true); }
    else { setStatus(stored); setAskComplete(false); setMethod(null); }
  }, [estimateId, row.paymentStatus, row.paymentNote, balancePendingKey]);
  const label = pending.length ? "계좌이체 확인 필요" : status === "completed" ? completedPaymentLabel(row.paymentMethod) : `${PAYMENT_METHOD_LABEL[normalizePaymentMethod(row.paymentMethod)]} · ${PAYMENT_STATUS_LABEL[status]}`;
  const cancel = () => { setAskComplete(false); setMethod(null); };
  const confirmDirectBank = async () => {
    if (locked.current || remain <= 0) return;
    locked.current = true; setBusy(true);
    try {
      const result = await confirmBank({ data: { estimateId, expectedAmount: remain, ownerReviewed: true } });
      if (!result.ok) { toast.error("확인 실패", { description: result.error }); return; }
      cancel(); onSaved?.(); window.dispatchEvent(new Event("jimpick:payment-updated"));
      toast.success("잔금 입금 확인 완료");
    } catch (error) { toast.error("확인 실패", { description: error instanceof Error ? error.message : "다시 시도해 주세요." }); }
    finally { locked.current = false; setBusy(false); }
  };
  // 예정 잔금보다 많이 입금된 경우: 사장님이 추가요금을 반영한 최종 계약금액을 확인한 뒤에만 결제완료합니다.
  // 입금액만으로 계약금액을 자동 변경하지 않습니다.
  const confirmOverpaid = async (r: ReceiptRow) => {
    if (locked.current || !r.id) return;
    const finalTotal = Number(String(finalTotals[r.id] ?? total + (r.amount - remain)).replace(/[^0-9]/g, ""));
    if (!finalTotal || finalTotal <= 0) { toast.error("최종 계약금액을 입력해 주세요."); return; }
    const receivedSum = row.depositPaid + r.amount;
    if (finalTotal < receivedSum) { toast.error("최종 계약금액이 실제 받은 금액보다 적습니다.", { description: `받은 금액 합계 ${won(receivedSum)} 이상이어야 합니다.` }); return; }
    locked.current = true; setBusy(true);
    try {
      const t = await updateTotal({ data: { estimateId, total: finalTotal } });
      if (!t.ok) { toast.error("금액 저장 실패", { description: t.error ?? "" }); return; }
      const result = await savePayment({ data: { estimateId, status: "completed", note, method: "bank_transfer", receiptId: r.id } });
      if (!result.ok) { toast.error("확인 실패", { description: result.error }); return; }
      cancel(); onSaved?.(); window.dispatchEvent(new Event("jimpick:payment-updated"));
      toast.success("최종 계약금액을 반영하고 결제완료했습니다");
    } catch (error) { toast.error("확인 실패", { description: error instanceof Error ? error.message : "다시 시도해 주세요." }); }
    finally { locked.current = false; setBusy(false); }
  };
  const run = async (selected?: PaymentMethod, receiptId?: string, successMsg = "결제 확인을 저장했습니다") => {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try {
      const result = await savePayment({ data: { estimateId, status: selected ? "completed" : status, note, method: selected, receiptId, approvalNumber: selected === "card" ? approval : undefined } });
      if (!result.ok) { toast.error("확인 실패", { description: result.error }); return; }
      cancel(); onSaved?.(); window.dispatchEvent(new Event("jimpick:payment-updated"));
      toast.success(successMsg);
    } catch (error) { toast.error("저장 실패", { description: error instanceof Error ? error.message : "다시 시도해 주세요." }); }
    finally { locked.current = false; setBusy(false); }
  };
  return <section className="mt-2 rounded-lg bg-muted p-3 text-foreground" aria-label="결제 상태">
    <Button variant="ghost" className="w-full justify-between px-0 text-xs" onClick={() => setOpen(!open)}><span>결제 상태 · {label}</span><span>{open ? "닫기" : "열기"}</span></Button>
    <div className="mt-1 text-xs text-muted-foreground">총 {won(summary.total)} · 예약금 {won(summary.deposit)} · 잔금 <b>{won(summary.balance)}</b></div>
    {open && <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">{PAYMENT_STATUS_CHOICES.map((s) => <Button key={s} aria-pressed={status === s} variant={status === s ? "staff" : "outline"} disabled={busy || (s === "completed" && status === "completed")} onClick={() => { if (s === "completed") { setAskComplete(true); setMethod(null); } else { cancel(); setStatus(s); } }}>{status === s && <Check aria-hidden="true" className="size-4 shrink-0" />}{PAYMENT_STATUS_LABEL[s]}</Button>)}</div>
      {askComplete && <div className="space-y-3 border-t border-border pt-3" aria-label="결제완료 확인">
        {!method ? <div className="grid grid-cols-2 gap-2">{PAYMENT_METHODS.map((m) => <Button key={m} variant="outline" onClick={() => setMethod(m)}>{m === "bank_transfer" ? "계좌이체" : `${PAYMENT_METHOD_LABEL[m]} 결제`}</Button>)}<Button variant="ghost" onClick={cancel}>취소</Button></div> : <>
          {method === "cash" && <><p className="text-sm font-bold">잔금 {won(remain)}을 현금으로 받으셨나요?</p><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={busy} onClick={cancel}>취소</Button><Button variant="staff" disabled={busy} onClick={() => void run("cash")}>{busy ? "저장 중…" : "현금으로 받았어요"}</Button></div></>}
          {method === "bank_transfer" && <><p className="text-sm font-bold">계좌이체 · 잔금 {won(remain)}</p>{receipts.length === 0 && <><p className="text-sm text-muted-foreground">잔금 입금 문자 확인해주세요.</p><p className="text-xs text-muted-foreground">실제 계좌에 {won(remain)}이 입금된 것을 확인하셨나요?</p><Button variant="staff" disabled={busy || remain <= 0} onClick={() => void confirmDirectBank()}>{busy ? "처리 중…" : "잔금 입금 확인"}</Button></>}{receipts.map((r) => {
            const diff = r.amount - remain;
            return (
              <div key={r.id} className="space-y-1 border-b border-border py-2 text-sm">
                <div className="font-bold">{r.depositorName || "이름 미확인"} · {won(r.amount)}</div>
                {diff === 0 ? (
                  <div className="text-xs text-muted-foreground">예정 잔금과 일치합니다.</div>
                ) : (
                  <div className="text-xs font-semibold text-[#B45309]">예정 잔금 {won(remain)} / 실제 입금 {won(r.amount)} / 차액 {diff > 0 ? "+" : "-"}{won(Math.abs(diff))}</div>
                )}
                <div className="text-xs text-muted-foreground">입금 시각 {r.depositedAt ? new Date(r.depositedAt).toLocaleString("ko-KR") : "기록 없음"}</div>
                {diff === 0 && <Button variant="staff" disabled={busy || !r.id} onClick={() => void run("bank_transfer", r.id)}>잔금 입금 확인</Button>}
                {diff > 0 && <>
                  <p className="text-xs text-muted-foreground">예정 잔금보다 많이 입금되었습니다. 추가요금을 반영한 최종 계약금액을 확인해 주세요.</p>
                  <label className="block text-xs" htmlFor={`final-${r.id}`}>최종 계약금액 (원)</label>
                  <input id={`final-${r.id}`} inputMode="numeric" value={finalTotals[r.id ?? ""] ?? String(total + diff)} onChange={(e) => setFinalTotals((m) => ({ ...m, [r.id ?? ""]: e.target.value }))} className="w-full rounded-md border border-input bg-background p-2 text-sm" />
                  <Button variant="staff" disabled={busy || !r.id} onClick={() => void confirmOverpaid(r)}>{busy ? "처리 중…" : "최종 금액 반영 후 결제완료"}</Button>
                </>}
                {diff < 0 && <>
                  <p className="text-xs text-muted-foreground">잔금보다 적게 입금되었습니다. 확인하면 일부결제로 저장되고 남은 금액은 계속 받을 수 있습니다.</p>
                  <Button variant="staff" disabled={busy || !r.id} onClick={() => void run("bank_transfer", r.id, "부분 입금을 확인했습니다 (일부결제)")}>{busy ? "처리 중…" : "부분 입금 확인"}</Button>
                </>}
              </div>
            );
          })}<Button variant="outline" disabled={busy} onClick={cancel}>취소</Button></>}
          {method === "card" && <><p className="text-sm font-bold">결제금액 {won(remain)} · 결제수단: 카드</p><label className="block text-xs" htmlFor={`approval-${estimateId}`}>승인번호 (선택)</label><input id={`approval-${estimateId}`} value={approval} maxLength={80} onChange={(e) => setApproval(e.target.value)} className="w-full rounded-md border border-input bg-background p-2 text-sm"/><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={busy} onClick={cancel}>취소</Button><Button variant="staff" disabled={busy} onClick={() => void run("card")}>{busy ? "저장 중…" : "카드 결제 확인"}</Button></div></>}
        </>}
      </div>}
      <label className="block text-xs" htmlFor={`note-${estimateId}`}>결제 메모</label><textarea id={`note-${estimateId}`} rows={2} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className="w-full rounded-md border border-input bg-background p-2 text-sm"/>
      {row.paymentConfirmedAt && <div className="text-xs text-muted-foreground">마지막 확인 {new Date(row.paymentConfirmedAt).toLocaleString("ko-KR")} · 업체 담당자</div>}
      {!askComplete && status !== "completed" && <Button variant="staff" className="w-full" disabled={busy} onClick={() => void run()}>결제 상태 저장</Button>}
    </div>}
  </section>;
}