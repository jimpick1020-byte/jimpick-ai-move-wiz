/**
 * 계약 삭제 확인창 — 달력과 견적 내역에서 같은 창을 씁니다.
 *
 * 삭제 중에는 버튼을 잠가 중복 요청을 막고, 실패하면 실제 오류 내용을 보여 줍니다.
 */
import { DELETE_CONFIRM_TEXT } from "@/lib/estimate-delete.functions";

export function DeleteContractDialog({
  open,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div
        className="absolute inset-0 bg-[#25282D]/45"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div className="relative w-full max-w-[340px] rounded-3xl bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.3)]">
        <div className="text-center text-[15.5px] font-black leading-relaxed text-[#25282D]">
          {DELETE_CONFIRM_TEXT}
        </div>
        {error && (
          <div className="mt-3 rounded-xl bg-[#FBEAEA] px-3 py-2.5 text-[12.5px] font-bold leading-relaxed text-[#D95C5C]">
            {error}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-[#E5E7EB] bg-white py-3 text-[14px] font-black text-[#6B7280] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 rounded-2xl bg-[#D95C5C] py-3 text-[14px] font-black text-white disabled:opacity-50"
          >
            {busy ? "삭제 중…" : "함께 삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
