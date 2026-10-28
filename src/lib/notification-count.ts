/** 미확인 알림 건수 — 읽음 표시가 없는 알림만, 같은 ID는 한 번만 셉니다 */
export function unreadNotificationCount(items: Array<{ id: string; readAt: string | null }>): number {
  return new Set(items.filter((n) => !n.readAt).map((n) => n.id)).size;
}
