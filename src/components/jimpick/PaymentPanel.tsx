/**
 * 예약금·잔금 상태 칸 (사장님용).
 *
 * 자동으로 금액을 바꾸지 않습니다. 사장님이 직접 확인한 값만 저장합니다.
 * 예약금은 「예약금 입금」 칸에서 확인한 금액을 그대로 보여 줍니다.
 * 「결제완료」는 실제 확인된 금액이 총액과 맞을 때만, 확인창을 거쳐 저장됩니다.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  setPaymentState,
  PAYMENT_STATUS_CHOICES,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_CLASS,
  normalizePaymentStatus,
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
  const [status, setStatus] = useState<PaymentStatus>(normalizePaymentStatus(row.paymentStatus));
  const [note, setNote] = useState(row.paymentNote ?? "");
  const [busy, setBusy] = useState(false);
  const [askComplete, setAskComplete] = useState(false);

  const deposit = row.depositPaid;
  const balanceNum = row.balancePaid;
  const remain = Math.max(0, total - deposit - balanceNum);
  const shortOfTotal = total > 0 && deposit + balanceNum < total;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await setPaymentState({
        data: { estimateId, status, note },
      });
      if (r.ok) {
        toast.success("결제 상태를 저장했습니다");
        setAskComplete(false);
        onSaved?.();
        // 서버 저장이 성공한 뒤에만 다른 화면(홈 견적 현황·견적 내역·완료 보관함)을 새로 읽게 합니다
        window.dispatchEvent(new Event("jimpick:payment-updated"));
      } else {
        toast.error("저장 실패", { description: r.error ?? "다시 시도해 주세요" });
      }
    } catch (e) {
      toast.error("저장 실패", { description: e instanceof Error ? e.message : "" });
    } finally {
      setBusy(false);
    }
  };

  const onSaveClick = () => {
    if (status === "completed") {
      if (shortOfTotal) {
        toast.error("결제완료로 저장할 수 없습니다", {
          description: `확인된 금액 ${won(deposit + balanceNum)} · 총액 ${won(total)}`,
        });
        return;
      }
      setAskComplete(true);
      return;
    }
    void save();
  };

  return (
    <div className="mt-2 rounded-xl bg-[#F7F8F5] p-2.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-[12.5px] font-bold text-[#6B7280]"
      >
        <span className="flex items-center gap-1.5">
          결제 상태
          <span
            className={`rounded-full px-1.5 py-[1px] text-[11px] font-black ${PAYMENT_STATUS_CLASS[status]}`}
          >
            {PAYMENT_STATUS_LABEL[status]}
          </span>
        </span>
        <span className="text-[#6B7280]">{open ? "닫기" : "열기"}</span>
      </button>

      <div className="mt-1 text-[12px] text-[#6B7280]">
        총 {won(total)} · 예약금 {won(deposit)} · 남은 금액{" "}
        <b>{won(Math.max(0, total - deposit - row.balancePaid))}</b>
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            {PAYMENT_STATUS_CHOICES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-xl py-2 text-[12.5px] font-bold ${
                  status === s
                    ? "bg-[#3578C8] text-white"
                    : "bg-white text-[#6B7280] ring-1 ring-[#E5E7EB]"
                }`}
              >
                {PAYMENT_STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="text-[12px] text-[#6B7280]">
            실제 남은 금액 {won(remain)}
          </div>

          <label
            className="block text-[12.5px] font-bold text-[#6B7280]"
            htmlFor={`note-${estimateId}`}
          >
            결제 메모
          </label>
          <textarea
            id={`note-${estimateId}`}
            name="paymentNote"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예) 이사 당일 현금으로 잔금 받음"
            className="w-full rounded-xl border border-[#E5E7EB] bg-white p-2.5 text-[13px] outline-none focus:border-[#3578C8]"
          />

          {row.paymentConfirmedAt && (
            <div className="text-[12px] text-[#6B7280]">
              마지막 확인 {new Date(row.paymentConfirmedAt).toLocaleString("ko-KR")} · 확인 담당자
              사장님
            </div>
          )}

          {status === "completed" && shortOfTotal && (
            <div className="rounded-xl bg-[#FEECEC] p-2 text-[12px] font-bold text-[#B91C1C]">
              확인된 금액 {won(deposit + balanceNum)}이 총액 {won(total)}보다 적습니다. 잔금을 먼저
              확인해 주세요.
            </div>
          )}

          <button
            onClick={onSaveClick}
            disabled={busy}
            className="w-full rounded-xl bg-[#3578C8] py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "저장 중…" : "결제 상태 저장"}
          </button>

          {askComplete && (
            <div className="rounded-xl border border-[#3E9B78] bg-white p-2.5">
              <div className="text-[13px] font-bold text-[#25282D]">결제완료로 저장할까요?</div>
              <div className="mt-1 text-[12px] text-[#6B7280]">
                총 {won(total)} · 예약금 {won(deposit)} · 잔금 {won(balanceNum)} 으로 확인합니다.
                저장하면 일반 견적내역에서 빠지고 완료 보관함에 안전하게 보존됩니다.
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setAskComplete(false)}
                  className="rounded-xl bg-white py-2 text-[12.5px] font-bold text-[#6B7280] ring-1 ring-[#E5E7EB]"
                >
                  취소
                </button>
                <button
                  onClick={() => void save()}
                  disabled={busy}
                  className="rounded-xl bg-[#3E9B78] py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
                >
                  {busy ? "저장 중…" : "결제완료 저장"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
