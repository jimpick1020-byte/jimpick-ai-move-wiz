import type { Estimate } from './jimpick';
import { editedSheet } from './sheet-edit';

/** Final completion uses the same calculation/snapshot as an explicit sheet save. */
export function finalSavedEstimate(draft: Estimate, revision: number): Estimate {
  return { ...editedSheet(draft, {}), status: '완료', sheetSavedRevision: revision };
}

/** Only a successful final or explicit sheet save can replace a history row. */
export function mergeSavedSheet(current: Estimate, incoming: Estimate): Estimate {
  if (current.id !== incoming.id) return current;
  if ((incoming.sheetSavedRevision ?? 0) < (current.sheetSavedRevision ?? 0)) return current;
  if ((incoming.sheetSavedRevision ?? 0) > (current.sheetSavedRevision ?? 0)) return incoming;
  // Legacy server-backed sheets still repair the card's stored amount without replacing edits.
  return incoming.total === current.total ? current : { ...current, total: incoming.total };
}