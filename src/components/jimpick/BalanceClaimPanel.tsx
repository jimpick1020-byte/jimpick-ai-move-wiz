import { useEffect, useId, useRef, useState } from "react";

export type BalanceClaimState = "form" | "pending" | "hidden";

/**
 * 고객 잔금 입금 신고 칸. 체크·화면 열기만으로는 아무것도 저장하지 않으며,
 * 저장 성공 응답 뒤에만 상위에서 state가 "pending"으로 바뀝니다.
 */
export function BalanceClaimPanel({
  state,
  amount,
  resetKey,
  onSubmit,
}: {
  state: BalanceClaimState;
  amount: number;
  /** 링크·금액·단계가 바뀌면 다시 확인하도록 체크를 풉니다 */
  resetKey: string;
  onSubmit: (amount: number) => Promise<{ ok: boolean; error?: string }>;
}) {
  const id = useId();
  const lock = useRef(false);
  const [checked, setChecked] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setChecked(false);
    setError(null);
  }, [resetKey]);

  if (state === "hidden") return null;
  if (state === "pending") {
    return (
      <div className="rounded-[14px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3.5" data-balance-claim="pending">
        <div className="text-center text-[15.5px] font-bold leading-snug text-[#1D4ED8]">잔금 입금 확인 대기</div>
        <div className="mt-1 text-center text-[14px] font-semibold text-[#3B5B8F]">업체 확인 후 결제가 완료됩니다.</div>
      </div>
    );
  }
  const submit = async () => {
    if (lock.current || !checked) return;
    lock.current = true;
    setClaiming(true);
    setError(null);
    try {
      const r = await onSubmit(amount);
      if (!r.ok) {
        setChecked(false);
        setError(r.error ?? "알리지 못했습니다. 금액을 다시 확인해 주세요.");
      }
    } catch {
      setChecked(false);
      setError("알리지 못했습니다. 금액을 다시 확인한 뒤 다시 시도해 주세요.");
    } finally {
      lock.current = false;
      setClaiming(false);
    }
  };
  return (
    <div className="rounded-[14px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3.5" data-balance-claim="form">
      <label htmlFor={id} className="flex items-center gap-2.5 py-1 text-[16px] font-bold text-[#1E3A8A]">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            setChecked(e.target.checked);
            setError(null);
          }}
          className="h-5 w-5 shrink-0 accent-[#2F80ED]"
        />
        실제로 잔금을 입금했습니다
      </label>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!checked || claiming}
        className="mt-2 w-full rounded-[14px] bg-[#2F80ED] py-3.5 text-[17px] font-black text-white disabled:bg-[#93C5FD]"
      >
        {claiming ? "알리는 중…" : "잔금 입금했습니다"}
      </button>
      <div className="mt-1.5 text-center text-[14px] font-semibold text-[#3B5B8F]">업체 확인 후 결제가 완료됩니다.</div>
      {error && <div className="mt-2 rounded-[12px] bg-[#FBEAEA] p-2.5 text-[15px] font-bold text-[#D95C5C]">{error}</div>}
    </div>
  );
}
