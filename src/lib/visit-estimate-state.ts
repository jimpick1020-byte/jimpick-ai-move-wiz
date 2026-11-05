import type { Estimate, Screen } from "./jimpick";

const STEPS = new Set(["step1", "step2", "step3", "step4", "scan", "step6", "plan", "options", "result"]);
export function visitResumeScreen(e: Pick<Estimate, "status" | "lastWritingScreen">): Screen {
  if (e.status === "완료") return "result";
  return e.lastWritingScreen && STEPS.has(e.lastWritingScreen) ? e.lastWritingScreen as Screen : "step1";
}
export function linkedLocalEstimate(request: { id: string; estimate_id: string; source_estimate_id: string | null }, draft: Estimate, estimates: Estimate[]): Estimate | undefined {
  const ids = new Set([request.estimate_id, request.source_estimate_id].filter(Boolean));
  const matches = [draft, ...estimates].filter(e => ids.has(e.id) || e.intakeRequestId === request.id);
  const unique = [...new Map(matches.map(e => [e.id, e])).values()];
  if (unique.length > 1) throw new Error("연결된 견적이 여러 개입니다. 견적 내역에서 확인해 주세요.");
  // Current draft is authoritative for edits not yet flushed to the server.
  return matches.find(e => e.id === draft.id) ?? unique[0];
}
export function areaOnlyPatch(key: string): Pick<Estimate, "sizeTab"> { return { sizeTab: key }; }