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
  const [balanceInput, setBalanceInput] = useState(row.balancePaid ? String(row.balancePaid) : "");

  // 화면 입력값이 아니라 서버에 저장된 실제 금액으로만 판단합니다.
  const deposit = row.depositPaid;
  const balanceNum = row.balancePaid;
  const remain = Math.max(0, total - deposit - balanceNum);
  const canComplete = total > 0 && remain === 0;

  const run = async (data: { estimateId: string; status: PaymentStatus; note?: string; balancePaid?: number }, okMsg: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await setPaymentState({ data });
      if (r.ok) {
        toast.success(okMsg);
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

  const save = () => void run({ estimateId, status, note }, "결제 상태를 저장했습니다");
  const saveBalance = () => {
    const n = Math.floor(Number(balanceInput.replace(/[^0-9]/g, "")) || 0);
    const cur = normalizePaymentStatus(row.paymentStatus);
    const next: PaymentStatus = cur === "refunded" || cur === "canceled" ? cur : n > 0 ? "partial" : deposit > 0 ? "deposit_paid" : "unpaid";
    void run({ estimateId, status: next, note, balancePaid: n }, n > 0 ? "잔금 입금을 저장했습니다" : "잔금 기록을 지웠습니다");
  };
  // 잔금을 대신 채우지 않습니다. 실제 저장된 금액이 총액과 같을 때만 결제 완료로 저장합니다.
  const complete = () => void run({ estimateId, status: "completed", note }, "결제 완료 · 완료 보관함으로 옮겼습니다");
  const onSaveClick = save;

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
        총 {won(total)} · 예약금 {won(deposit)} · 잔금 {won(balanceNum)} · 남은 금액 <b>{won(remain)}</b>
      </div>
      {balanceNum > 0 && (
        <div className="mt-1 inline-block rounded-full bg-[#E4F4EC] px-2 py-0.5 text-[11px] font-black text-[#2F7A5E]">
          잔금 입금 {won(balanceNum)}
        </div>
      )}
      <div className="mt-2 space-y-1.5">
        <div className="flex gap-1.5">
          <input
            inputMode="numeric"
            aria-label="받은 잔금"
            value={balanceInput ? Number(balanceInput.replace(/[^0-9]/g, "") || 0).toLocaleString("ko-KR") : ""}
            onChange={(e) => setBalanceInput(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="실제 받은 잔금 (원)"
            className="min-w-0 flex-1 rounded-xl border border-[#E5E7EB] bg-white px-2.5 py-2 text-[13px] outline-none focus:border-[#3578C8]"
          />
          <button
            onClick={saveBalance}
            disabled={busy}
            className="shrink-0 rounded-xl bg-[#3578C8] px-3 text-[12.5px] font-bold text-white disabled:opacity-50"
          >
            잔금 입금 저장
          </button>
        </div>
        <button
          onClick={() => canComplete && setAskComplete(true)}
          disabled={busy || !canComplete}
          className="w-full rounded-xl bg-[#3E9B78] py-2.5 text-[13px] font-bold text-white disabled:bg-[#D1D5DB] disabled:text-[#6B7280]"
        >
          확인 완료
        </button>
        {!canComplete && (
          <div className="text-[12px] font-bold text-[#D95C5C]">
            {total > 0 ? `잔금 ${won(remain)}이 부족해 확인 완료를 할 수 없습니다.` : "견적 총액이 없어 확인 완료를 할 수 없습니다."}
          </div>
        )}
        {askComplete && canComplete && (
          <div className="rounded-xl border border-[#3E9B78] bg-white p-2.5">
            <div className="text-[13px] font-bold text-[#25282D]">결제 완료로 확인할까요?</div>
            <div className="mt-1 text-[12px] text-[#6B7280]">
              총 {won(total)} · 예약금 {won(deposit)} · 잔금 {won(balanceNum)} 입금을 확인합니다.
              확인하면 견적 내역에서 빠지고 완료 보관함에 보관됩니다.
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setAskComplete(false)}
                className="rounded-xl bg-white py-2 text-[12.5px] font-bold text-[#6B7280] ring-1 ring-[#E5E7EB]"
              >
                취소
              </button>
              <button
                onClick={complete}
                disabled={busy}
                className="rounded-xl bg-[#3E9B78] py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
              >
                {busy ? "저장 중…" : "확인"}
              </button>
            </div>
          </div>
        )}
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            {PAYMENT_STATUS_CHOICES.filter((s) => s !== "completed").map((s) => (
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

          <button
            onClick={onSaveClick}
            disabled={busy}
            className="w-full rounded-xl bg-[#3578C8] py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "저장 중…" : "결제 상태 저장"}
          </button>

        </div>
      )}
    </div>
  );
}
