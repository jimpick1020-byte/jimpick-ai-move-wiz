/** Highlight only the exact selected estimate while its stored stage is waiting. */
export function isWaitingHistoryTarget(targetId: string | null, estimateId: string, stage: string): boolean {
  return Boolean(targetId && targetId === estimateId && stage === "deposit_waiting");
}