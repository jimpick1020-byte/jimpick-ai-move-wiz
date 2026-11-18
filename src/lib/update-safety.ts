/** Update restarts must not interrupt unsaved work or an in-flight operation. */
const blockers = new Set<() => boolean>();

export function protectAppUpdate(blocked: () => boolean): () => void {
  blockers.add(blocked);
  return () => { blockers.delete(blocked); };
}

export function appUpdateBlocked(): boolean {
  return [...blockers].some(blocked => blocked());
}

/** Explicit update application is idempotent; failed protection does not consume it. */
export function createUpdateRestart(blocked: () => boolean, restart: () => void) {
  let applied = false;
  return () => {
    if (applied || blocked()) return false;
    applied = true;
    restart();
    return true;
  };
}