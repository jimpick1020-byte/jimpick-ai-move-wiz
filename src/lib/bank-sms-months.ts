/** Group receipt timestamps by the Korean calendar, independently of the device timezone. */
export function groupBankSmsMonths<T extends { receivedAt: string }>(rows: readonly T[]) {
  const groups = new Map<string, { key: string; year: number; month: number; rows: T[] }>();
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" });
  for (const row of [...rows].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))) {
    const date = new Date(row.receivedAt);
    if (!Number.isFinite(date.getTime())) continue;
    const parts = formatter.formatToParts(date);
    const year = Number(parts.find((p) => p.type === "year")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const group = groups.get(key) ?? { key, year, month, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export function bankSmsMonthIsOpen(key: string, latestKey: string | undefined, overrides: Record<string, boolean>) {
  return overrides[key] ?? key === latestKey;
}