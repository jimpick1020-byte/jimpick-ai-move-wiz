import type { Estimate } from './jimpick';

/** Only a successful explicit sheet save can replace an existing history row. */
export function mergeSavedSheet(current: Estimate, incoming: Estimate): Estimate {
  if (current.id !== incoming.id) return current;
  if ((incoming.sheetSavedRevision ?? 0) < (current.sheetSavedRevision ?? 0)) return current;
  if ((incoming.sheetSavedRevision ?? 0) > (current.sheetSavedRevision ?? 0)) return incoming;
  // Legacy server-backed sheets still repair the card's stored amount without replacing edits.
  return incoming.total === current.total ? current : { ...current, total: incoming.total };
}