/**
 * 고객 입금 확인 요청 칸 (사장님용).
 *
 * 고객이 견적서에서 「입금했습니다」를 누르면 여기에 나타납니다.
 * 고객이 눌렀다는 것만으로는 금액이 반영되지 않습니다.
 * 사장님이 통장을 보고 「확인하기 → 입금 확인 완료」를 눌러야
 * 예약금이 실제로 저장되고 남은 금액이 다시 계산됩니다.
 */
import { useState } from "react";
import { toast } from "sonner";
import { confirmDeposit } from "@/lib/deposit.functions";
import type { TermsStatusRow } from "@/lib/terms.functions";

const won = (n: number) => `${Number(n || 0).toLocaleString("ko-KR")}원`;

export function DepositClaimBox({
  row,
  onSaved,
}: {
  row: TermsStatusRow;
  onSaved?: () => void;
}) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  const claimId = row.depositClaimId;
  const confirmedDeposit = row.depositPaid;

  // 확인이 끝난 경우 — 실제 저장된 금액을 그대로 보여 줍니다
  if (!claimId) {
    if (confirmedDeposit > 0) {
      return (
        <div className="mt-2 rounded-xl bg-[#E4F4EC] p-2.5">
          <div className="text-[12.5px] font-bold text-[#2F7A5E]">
            예약금 입금 {won(confirmedDeposit)} 확인 완료
          </div>
          {row.paymentConfirmedAt && (
            <div className="mt-0.5 text-[12px] text-[#6B7280]">
              확인 {new Date(row.paymentConfirmedAt).toLocaleString("ko-KR")} · 확인 담당자 사장님
            </div>
          )}
        </div>
      );
    }
    return null;
  }

  const doConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await confirmDeposit({ data: { id: claimId, note: "고객 입금 알림 · 통장 확인" } });
      if (r.ok) {
        toast.success(`예약금 ${won(r.paid ?? 0)} 확인 완료`);
        setAsk(false);
        onSaved?.();
        window.dispatchEvent(new Event("jimpick:payment-updated"));
      } else {
        toast.error("입금 확인을 저장하지 못했습니다", { description: r.error ?? "다시 시도해 주세요" });
      }
    } catch (e) {
      toast.error("입금 확인을 저장하지 못했습니다", {
        description: e instanceof Error ? e.message : "통신 상태를 확인해 주세요",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-2.5">
      <div className="text-[13px] font-black text-[#B45309]">고객 입금 확인 요청</div>
      <div className="mt-1 text-[12.5px] font-semibold text-[#8A6D1B]">
        {won(row.depositClaimAmount)} · 통장 확인이 필요합니다
      </div>
      {row.depositClaimedAt && (
        <div className="mt-0.5 text-[12px] text-[#6B7280]">
          고객 알림 {new Date(row.depositClaimedAt).toLocaleString("ko-KR")}
        </div>
      )}
      <div className="mt-1 text-[12px] text-[#6B7280]">
        확인된 예약금 {won(confirmedDeposit)} · 남은 금액 {won(Math.max(0, row.total - confirmedDeposit - row.balancePaid))}
      </div>

      {!ask ? (
        <button
          type="button"
          onClick={() => setAsk(true)}
          className="mt-2 w-full rounded-xl bg-[#B45309] py-2.5 text-[13px] font-bold text-white"
        >
          확인하기
        </button>
      ) : (
        <div className="mt-2 rounded-xl border border-[#FDE68A] bg-white p-2.5">
          <div className="text-[13px] font-bold text-[#25282D]">실제 계좌 입금을 확인하셨습니까?</div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setAsk(false)}
              disabled={busy}
              className="rounded-xl bg-white py-2 text-[12.5px] font-bold text-[#6B7280] ring-1 ring-[#E5E7EB] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void doConfirm()}
              disabled={busy}
              className="rounded-xl bg-[#3E9B78] py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
            >
              {busy ? "저장 중…" : "입금 확인 완료"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
