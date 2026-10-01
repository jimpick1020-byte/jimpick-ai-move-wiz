/**
 * 견적 내역 정렬·월별 묶음 — 실제 이사 날짜(move_date) 기준, 한국시간(Asia/Seoul).
 * 문자열 비교가 아니라 날짜 값(연·월·일 숫자)으로 변환해 비교합니다.
 */
export interface SortableEstimate {
  moveDate?: string | null;
  moveTime?: string | null;
  createdAt?: number | null;
}

/** "2026-10-13", "2026.10.13", "2026/10/13 09:00" 등 → 날짜 값(UTC 자정 ms). 잘못된 날짜면 null */
export function parseMoveDate(raw?: string | null): number | null {
  const m = String(raw ?? "").trim().match(/^(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return t;
}

/** "09:30", "오후 2시" 등 → 분. 없으면 맨 뒤로 */
export function parseMoveTime(raw?: string | null): number {
  const s = String(raw ?? "").trim();
  const m = s.match(/(\d{1,2})\s*[:시]\s*(\d{1,2})?/);
  if (!m) return 24 * 60 + 1;
  let h = +m[1];
  if (/오후|PM/i.test(s) && h < 12) h += 12;
  if (/오전|AM/i.test(s) && h === 12) h = 0;
  return h * 60 + (m[2] ? +m[2] : 0);
}

/** move_date ASC → 시작시간 ASC → created_at ASC */
export function compareByMoveDateAsc(a: SortableEstimate, b: SortableEstimate): number {
  const da = parseMoveDate(a.moveDate), db = parseMoveDate(b.moveDate);
  if (da !== db) return (da ?? Infinity) - (db ?? Infinity);
  const ta = parseMoveTime(a.moveTime), tb = parseMoveTime(b.moveTime);
  if (ta !== tb) return ta - tb;
  return (a.createdAt ?? 0) - (b.createdAt ?? 0);
}

/** 한국시간 기준 현재 연·월 키 "YYYY-MM" */
export function seoulMonthKey(now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}`;
}

export interface MonthGroup<T> {
  key: string; // "2026-10" 또는 "undated"
  title: string; // "2026년 10월" 또는 "이사 날짜 미정"
  items: T[];
}

/** 월별 그룹 (날짜순) + 맨 아래 "이사 날짜 미정"(created_at DESC) */
export function groupByMoveMonth<T extends SortableEstimate>(list: readonly T[]): MonthGroup<T>[] {
  const dated: T[] = [], undated: T[] = [];
  for (const e of list) (parseMoveDate(e.moveDate) === null ? undated : dated).push(e);
  dated.sort(compareByMoveDateAsc);
  undated.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const groups: MonthGroup<T>[] = [];
  for (const e of dated) {
    const d = new Date(parseMoveDate(e.moveDate)!);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, title: `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월`, items: [] };
      groups.push(g);
    }
    g.items.push(e);
  }
  if (undated.length) groups.push({ key: "undated", title: "이사 날짜 미정", items: undated });
  return groups;
}

/** 기본 펼침: 현재 월 + 현재 월 이후 가장 가까운 달 (한국시간) */
export function defaultOpenMonths(groups: readonly MonthGroup<unknown>[], now = new Date()): Set<string> {
  const cur = seoulMonthKey(now);
  const open = new Set<string>();
  if (groups.some((g) => g.key === cur)) open.add(cur);
  const next = groups.find((g) => g.key !== "undated" && g.key > cur);
  if (next) open.add(next.key);
  return open;
}

/** "10월 13일" 표기 */
export function shortMoveDate(raw?: string | null): string {
  const t = parseMoveDate(raw);
  if (t === null) return "";
  const d = new Date(t);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}
