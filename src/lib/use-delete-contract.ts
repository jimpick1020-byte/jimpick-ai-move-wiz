/**
 * 계약 삭제 상태 관리 — 달력과 견적 내역이 같은 흐름을 씁니다.
 *
 *  - 확인창을 열고, 삭제 중에는 잠그고, 성공한 뒤에만 화면에서 지웁니다.
 *  - 실패하면 성공으로 표시하지 않고 실제 오류 내용을 확인창에 남깁니다.
 *  - 권한 오류면 "함께 삭제" 버튼을 잠급니다.
 */
import { useState } from "react";
import { deleteEstimateEverywhere } from "./estimate-delete.functions";

export function useDeleteContract(opts: {
  source: "calendar" | "history";
  /** 서버 삭제가 성공한 뒤에만 호출됩니다 */
  onDeleted: (estimateId: string) => void;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const ask = (estimateId: string) => {
    setError(null);
    setForbidden(false);
    setTarget(estimateId);
  };
  const cancel = () => {
    if (busy) return;
    setTarget(null);
    setError(null);
    setForbidden(false);
  };
  const confirm = async () => {
    if (!target || busy || forbidden) return;
    setBusy(true);
    setError(null);
    try {
      const r = await deleteEstimateEverywhere({
        data: { estimateId: target, source: opts.source },
      });
      if (!r.ok) {
        setError(r.error ?? "삭제하지 못했습니다.");
        if (r.forbidden) setForbidden(true);
        return;
      }
      const id = target;
      setTarget(null);
      opts.onDeleted(id);
    } catch (err) {
      console.error("[useDeleteContract]", err);
      setError("삭제하지 못했습니다. 통신 상태를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return { target, busy, error, forbidden, ask, cancel, confirm, open: target !== null };
}
