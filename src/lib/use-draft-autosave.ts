/**
 * 작성 중인 견적을 잠시 뒤 자동으로 저장합니다.
 *
 *  · 입력을 멈춘 뒤 1.5초 지나면 저장합니다 (타이핑 중에는 보내지 않습니다).
 *  · "저장 중 / 저장 완료 / 저장 실패"를 화면에 보여 주기 위한 상태를 돌려줍니다.
 *  · 실패해도 입력값은 그대로 두고, 인터넷이 돌아오면 다시 저장합니다.
 *  · 저장 요청이 겹쳐도 오래된 값이 최신 값을 덮어쓰지 않도록 순번을 올려 보냅니다.
 */
import { useEffect, useRef, useState } from "react";
import { saveEstimateDraft } from "./draft-sync.functions";

export type DraftSaveState = "idle" | "saving" | "saved" | "error" | "offline";

const REV_KEY = "jimpick.draft.revision";

function nextRevision(): number {
  let rev = 0;
  try {
    rev = Number(localStorage.getItem(REV_KEY) || 0) || 0;
  } catch {
    /* 저장할 수 없는 브라우저는 시간값을 씁니다 */
  }
  const next = Math.max(rev + 1, Math.floor(Date.now() / 1000));
  try {
    localStorage.setItem(REV_KEY, String(next));
  } catch {
    /* 무시 */
  }
  return next;
}

export function useDraftAutosave(enabled: boolean, estimateId: string, payload: string) {
  const [state, setState] = useState<DraftSaveState>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const lastSent = useRef<string>("");
  const pending = useRef<string | null>(null);
  const inFlight = useRef(false);

  const flush = async (id: string, body: string) => {
    if (inFlight.current) {
      pending.current = body;
      return;
    }
    inFlight.current = true;
    setState("saving");
    try {
      const r = await saveEstimateDraft({
        data: { estimateId: id, payload: body, revision: nextRevision() },
      });
      if (r.ok) {
        lastSent.current = body;
        setSavedAt(Date.now());
        setState("saved");
      } else {
        setState("error");
      }
    } catch {
      setState(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
    } finally {
      inFlight.current = false;
      const queued = pending.current;
      pending.current = null;
      if (queued && queued !== lastSent.current) void flush(id, queued);
    }
  };

  useEffect(() => {
    if (!enabled || !estimateId || !payload || payload === lastSent.current) return;
    const t = window.setTimeout(() => void flush(estimateId, payload), 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, estimateId, payload]);

  // 인터넷이 돌아오면 저장하지 못한 값을 다시 보냅니다.
  useEffect(() => {
    if (!enabled) return;
    const onOnline = () => {
      if (payload && payload !== lastSent.current && estimateId) void flush(estimateId, payload);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, estimateId, payload]);

  return { state, savedAt };
}
