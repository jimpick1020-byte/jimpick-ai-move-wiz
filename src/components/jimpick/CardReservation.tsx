import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmCardReservation, prepareCardReservationSms } from "@/lib/card-reservation.functions";
import { createComposerGate, intakeSmsHref } from "@/lib/intake-sms";
import { hasSmsApp } from "@/lib/sms";
import type { TermsStatusRow } from "@/lib/terms.functions";

export function CardReservationChoice({ value, disabled, onChange }: { value: "bank_transfer" | "onsite_card"; disabled: boolean; onChange: (value: "bank_transfer" | "onsite_card") => void }) {
  return <div className="mt-4 space-y-2 text-foreground">
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="예약 결제 방식">
      <Button variant={value === "bank_transfer" ? "staff" : "outline"} className="min-h-11" disabled={disabled} aria-pressed={value === "bank_transfer"} onClick={() => onChange("bank_transfer")}>계좌이체</Button>
      <Button variant={value === "onsite_card" ? "staff" : "outline"} className="min-h-11" disabled={disabled} aria-pressed={value === "onsite_card"} onClick={() => onChange("onsite_card")}>현장 카드 결제</Button>
    </div>
    {value === "onsite_card" && <p className="text-base">예약금 없이 예약을 요청합니다. 이사 당일 견적 금액을 카드로 결제해 주세요.</p>}
  </div>;
}

export function CardReservationPanel({ row, onSaved }: { row: TermsStatusRow; onSaved?: () => void }) {
  const save = useServerFn(confirmCardReservation);
  const prepareSms = useServerFn(prepareCardReservationSms);
  const lock = useRef(false);
  const gate = useRef(createComposerGate());
  const [busy, setBusy] = useState(false);
  const [terminal, setTerminal] = useState(false);
  const completed = row.paymentStatus === "completed";
  const confirm = async (complete: boolean) => {
    if (lock.current || !row.termsId || (complete && !terminal)) return;
    lock.current = true; setBusy(true);
    try {
      const r = await save({ data: { termsId: row.termsId, complete, terminalConfirmed: complete && terminal } });
      if (!r.ok) { toast.error(r.error ?? "저장하지 못했습니다."); return; }
      setTerminal(false); onSaved?.(); window.dispatchEvent(new Event("jimpick:payment-updated"));
      toast.success(complete ? "카드 결제 완료를 확인했습니다" : "예약이 확정되었습니다");
    } catch { toast.error("저장하지 못했습니다. 다시 확인해 주세요."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="mt-2 space-y-2 rounded-lg bg-muted p-3 text-foreground" aria-label="현장 카드 예약">
    <p className="text-sm font-bold">{completed ? "결제 완료 · 남은 금액 0원" : `예약금 없음 · 현장 카드 결제 예정 ${row.total.toLocaleString("ko-KR")}원`}</p>
    <p className="text-sm">{completed ? "카드 결제 완료" : row.cardConfirmedAt ? "예약 확정 · 미결제" : "예약 확인 대기 · 미결제"}</p>
    {!row.cardConfirmedAt && !completed && <Button variant="staff" disabled={busy} onClick={() => void confirm(false)}>예약 확정</Button>}
    {row.cardConfirmedAt && !completed && <>
      <Button variant="outline" disabled={busy} onClick={async () => {
        if (!row.termsId) return;
        setBusy(true);
        try {
          await gate.current(async () => {
            const msg = await prepareSms({ data: { termsId: row.termsId ?? "" } });
            const href = intakeSmsHref(msg.phone, msg.body);
            if (!hasSmsApp()) { await navigator.clipboard.writeText(`${msg.phone}\n\n${msg.body}`); toast.info("받는 번호와 문자 내용을 복사했습니다"); return null; }
            return href;
          }, href => { window.location.href = href; });
        } catch { toast.error("문자 내용을 준비하지 못했습니다."); }
        finally { setBusy(false); }
      }}>예약 확정 문자 보내기</Button>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={terminal} disabled={busy} onChange={e => setTerminal(e.target.checked)} />현장 단말기의 카드 승인을 확인했습니다</label>
      <Button variant="staff" disabled={busy || !terminal} onClick={() => void confirm(true)}>카드 결제 완료</Button>
    </>}
  </section>;
}