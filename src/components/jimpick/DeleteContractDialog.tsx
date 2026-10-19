/**
 * 계약 삭제 확인창 — 달력과 견적 내역에서 같은 창을 씁니다.
 *
 * 삭제 중에는 버튼을 잠가 중복 요청을 막고, 실패하면 실제 오류 내용을 보여 줍니다.
 */
import { DELETE_CONFIRM_TEXT } from "@/lib/estimate-delete.functions";
import { Button } from "@/components/ui/button";

export function DeleteContractDialog({
  open,
  busy,
  error,
  onCancel,
  onConfirm,
  disabled = false,
  archiveItem,
}: {
  archiveItem?: { customerName: string; estimateId: string; moveDate: string; total: string };
  disabled?: boolean;
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
      <div role="dialog" aria-modal="true" aria-label={archiveItem ? "완료 보관함 삭제 확인" : "계약 삭제 확인"} className="relative w-full max-w-[340px] rounded-3xl bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.3)]">
        {archiveItem && <div className="mb-3 space-y-1 break-words text-foreground">
          <div className="text-[15px] font-bold">{archiveItem.customerName || "이름 없음"}</div>
          <div className="text-[13px] text-muted-foreground">{archiveItem.moveDate || "날짜 미정"} · {archiveItem.total}</div>
          <div className="text-[12px] text-muted-foreground">견적번호 {archiveItem.estimateId}</div>
        </div>}
        <div className="text-center text-[15.5px] font-black leading-relaxed text-[#25282D]">
          {archiveItem ? "이 견적을 완료 보관함에서 삭제하시겠습니까? 연결된 입금 문자와 결제 기록은 유지됩니다." : DELETE_CONFIRM_TEXT}
        </div>
        {error && (
          <div className="mt-3 rounded-xl bg-[#FBEAEA] px-3 py-2.5 text-[12.5px] font-bold leading-relaxed text-[#D95C5C]">
            {error}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="outline"
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-auto flex-1 rounded-2xl py-3 text-[14px] font-black"
          >
            취소
          </Button>
          <Button variant="destructive"
            type="button"
            disabled={busy || disabled}
            onClick={onConfirm}
            className="h-auto flex-1 rounded-2xl py-3 text-[14px] font-black"
          >
            {busy ? "삭제 중…" : archiveItem ? "삭제" : "함께 삭제"}
          </Button>
        </div>
      </div>
    </div>
  );
}
