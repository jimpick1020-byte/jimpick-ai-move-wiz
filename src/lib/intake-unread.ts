/** Only unreviewed customer submissions count; visit scheduling is unrelated to reading. */
export function isUnreadIntake(row: { status: string; owner_seen_at: string | null; deleted_at?: string | null; estimate_completed_at?: string | null }): boolean {
  return ["submitted", "confirmed"].includes(row.status) && !row.owner_seen_at && !row.deleted_at && !row.estimate_completed_at;
}