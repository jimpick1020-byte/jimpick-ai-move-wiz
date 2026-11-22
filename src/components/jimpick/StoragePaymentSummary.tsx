import { storagePaymentPlan } from "@/lib/storage-payment";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
export function StoragePaymentSummary({ total, plannedDeposit, plannedInterim, depositPaid = 0, interimPaid = 0, balancePaid = 0 }: Parameters<typeof storagePaymentPlan>[0]) {
  const p = storagePaymentPlan({ total, plannedDeposit, plannedInterim: plannedInterim ?? 0, depositPaid, interimPaid, balancePaid });
  return <div className="space-y-1.5 text-sm text-foreground" aria-label="보관이사 납부 내역">
    <div className="flex justify-between gap-3"><span>{depositPaid > 0 ? "예약금 입금 완료" : "예정 예약금"}</span><strong>{won(depositPaid > 0 ? depositPaid : plannedDeposit)}</strong></div>
    {interimPaid > 0 && <div className="flex justify-between gap-3"><span>중도금 입금 완료</span><strong>{won(interimPaid)}</strong></div>}
    {p.interimDue > 0 && <div className="flex justify-between gap-3"><span>받을 중도금</span><strong>{won(p.interimDue)}</strong></div>}
    <p className="text-xs text-muted-foreground">중도금 · 출발지 작업 완료 후</p>
    {balancePaid > 0 && <div className="flex justify-between gap-3"><span>잔금 입금 완료</span><strong>{won(balancePaid)}</strong></div>}
    <div className="flex justify-between gap-3"><span>{p.interimDue > 0 || p.paid === 0 ? "예정 최종 잔금" : "남은 잔금"}</span><strong>{won(p.interimDue > 0 || p.paid === 0 ? Math.max(0, p.plannedFinal - balancePaid) : p.remaining)}</strong></div>
    <p className="text-xs text-muted-foreground">잔금 · 도착지 작업 완료 후</p>
    <div className="flex justify-between gap-3 border-t border-border pt-1.5"><span>실제 남은 전체 금액</span><strong>{won(p.remaining)}</strong></div>
    {p.overpaid > 0 && <div className="font-bold text-payment-review">초과입금 {won(p.overpaid)}</div>}
  </div>;
}