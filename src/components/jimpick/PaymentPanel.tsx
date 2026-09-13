/**
 * 예약금·잔금 상태 칸 (사장님용).
 *
 * 자동으로 금액을 바꾸지 않습니다. 사장님이 직접 확인한 값만 저장합니다.
 * 예약금은 「예약금 입금」 칸에서 확인한 금액을 그대로 보여 줍니다.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  setPaymentState,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  type PaymentStatus,
} from "@/lib/payment.functions";
import type { TermsStatusRow } from "@/lib/terms.functions";

const won = (n: number) => `${Number(n || 0).toLocaleString("ko-KR")}원`;

export function PaymentPanel({
  estimateId,
  total,
  row,
  onSaved,
}: {
  estimateId: string;
  total: number;
  row: TermsStatusRow;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>(
    (PAYMENT_STATUSES as readonly string[]).includes(row.paymentStatus)
      ? (row.paymentStatus as PaymentStatus)
      : "unpaid",
  );
  const [balance, setBalance] = useState(String(row.balancePaid || ""));
  const [note, setNote] = useState(row.paymentNote ?? "");
  const [busy, setBusy] = useState(false);

  const deposit = row.depositPaid;
  const balanceNum = Number(String(balance).replace(/[^\d]/g, "")) || 0;
  const remain = Math.max(0, total - deposit - balanceNum);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await setPaymentState({
        data: { estimateId, status, balancePaid: balanceNum, note },
      });
      if (r.ok) {
        toast.success("결제 상태를 저장했습니다");
        onSaved?.();
      } else {
        toast.error("저장 실패", { description: r.error ?? "다시 시도해 주세요" });
      }
    } catch (e) {
      toast.error("저장 실패", { description: e instanceof Error ? e.message : "" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl bg-[#F7F9FC] p-2.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-[12.5px] font-bold text-[#334155]"
      >
        <span>
          결제 상태{" "}
          <span
            className={
              status === "completed"
                ? "text-[#15803D]"
                : status === "canceled" || status === "refunded"
                  ? "text-[#B91C1C]"
                  : status === "unpaid"
                    ? "text-[#6B7280]"
                    : "text-[#0751D8]"
            }
          >
            {PAYMENT_STATUS_LABEL[status]}
          </span>
        </span>
        <span className="text-[#6B7280]">{open ? "닫기" : "열기"}</span>
      </button>

      <div className="mt-1 text-[12px] text-[#334155]">
        총 {won(total)} · 예약금 {won(deposit)} · 잔금 {won(row.balancePaid)} · 남은 금액{" "}
        <b>{won(Math.max(0, total - deposit - row.balancePaid))}</b>
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            {PAYMENT_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-xl py-2 text-[12.5px] font-bold ${
                  status === s
                    ? "bg-[#0751D8] text-white"
                    : "bg-white text-[#334155] ring-1 ring-[#E5E7EB]"
                }`}
              >
                {PAYMENT_STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <label className="block text-[12.5px] font-bold text-[#334155]" htmlFor={`bal-${estimateId}`}>
            확인한 잔금 (원)
          </label>
          <input
            id={`bal-${estimateId}`}
            name="balancePaid"
            inputMode="numeric"
            value={balance}
            onChange={(e) => setBalance(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
            className="w-full rounded-xl border border-[#DCE8FA] bg-white p-2.5 text-[13px] outline-none focus:border-[#0751D8]"
          />
          <div className="text-[12px] text-[#6B7280]">
            입력한 잔금 {won(balanceNum)} · 남은 금액 {won(remain)}
          </div>

          <label className="block text-[12.5px] font-bold text-[#334155]" htmlFor={`note-${estimateId}`}>
            결제 메모
          </label>
          <textarea
            id={`note-${estimateId}`}
            name="paymentNote"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예) 이사 당일 현금으로 잔금 받음"
            className="w-full rounded-xl border border-[#DCE8FA] bg-white p-2.5 text-[13px] outline-none focus:border-[#0751D8]"
          />

          {row.paymentConfirmedAt && (
            <div className="text-[12px] text-[#6B7280]">
              마지막 확인 {new Date(row.paymentConfirmedAt).toLocaleString("ko-KR")} · 확인 담당자 사장님
            </div>
          )}

          <button
            onClick={() => void save()}
            disabled={busy}
            className="w-full rounded-xl bg-[#0751D8] py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "저장 중…" : "결제 상태 저장"}
          </button>
        </div>
      )}
    </div>
  );
}
