import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useApp, type Estimate } from "./jimpick";
import { resumeIntakeEstimate, type IntakeRow } from "./intake.functions";
import { saveEstimateDraft } from "./draft-sync.functions";
import { nextRevision } from "./use-draft-autosave";
import { seedSecondHouse, switchHouse, type HouseId } from "./house-workspace";
import { linkedLocalEstimate, visitResumeScreen } from "./visit-estimate-state";

export function useVisitEstimate() {
  const app = useApp();
  const current = useRef(app); current.current = app;
  const lock = useRef(false);
  const [opening, setOpening] = useState(false);
  const resume = useServerFn(resumeIntakeEstimate);
  const save = useServerFn(saveEstimateDraft);
  const openVisit = async (row: IntakeRow, house?: HouseId) => {
    if (lock.current) return;
    lock.current = true; setOpening(true);
    try {
      const { draft, estimates } = current.current;
      const local = linkedLocalEstimate(row, draft, estimates);
      if (local) {
        const saved = await save({ data: { estimateId: local.id, payload: JSON.stringify(local), revision: nextRevision() } });
        if (!saved.ok || saved.stale) throw new Error(saved.error || "작성 내용을 저장하지 못했습니다. 다시 시도해 주세요.");
      }
      const result = await resume({ data: { requestId: row.id } });
      if (!result.ok || !result.payload) throw new Error(result.error || "연결된 견적을 불러오지 못했습니다.");
      let loaded = JSON.parse(result.payload) as Estimate;
      if (row.second_token_hash && house) {
        const second = (row.second_submission && Object.keys(row.second_submission).length ? row.second_submission : row.second_draft) as never;
        loaded = switchHouse(seedSecondHouse(loaded, second, row.id), house);
        const stored = await save({ data: { estimateId: loaded.id, payload: JSON.stringify(loaded), revision: nextRevision() } });
        if (!stored.ok || stored.stale) throw new Error(stored.error || "선택한 집을 저장하지 못했습니다. 다시 시도해 주세요.");
      }
      current.current.patchDraft(() => loaded);
      current.current.setScreen(visitResumeScreen(loaded));
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "견적을 불러오지 못했습니다."); }
    finally { lock.current = false; setOpening(false); }
  };
  const hasLinked = (row: IntakeRow) => {
    try { return !!linkedLocalEstimate(row, app.draft, app.estimates)?.intakeOwnerStartedAt; } catch { return true; }
  };
  return { openVisit, opening, hasLinked };
}