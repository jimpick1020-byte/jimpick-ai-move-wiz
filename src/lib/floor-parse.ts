/**
 * 상세주소에서 층수를 찾아 줍니다 (추측하지 않습니다).
 *
 * 예) "허브드 305호" → 3, "2919호" → 29, "5층" → 5, "지하 1층" → -1
 * 층·호 정보가 없으면 null을 돌려주고, 층수 칸은 비워 둡니다.
 */
export function parseFloorFromDetail(raw: string | null | undefined): number | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  // 「101동」처럼 동 번호는 층수가 아니므로 먼저 지웁니다
  const t = text.replace(/\d+\s*동/g, " ");

  // 지하 (지하 1층 / B1)
  const base = t.match(/지하\s*(\d{1,2})\s*층?/) ?? t.match(/\bB\s*(\d{1,2})\b/i);
  if (base) {
    const n = Number(base[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 10) return -n;
  }

  // 「5층」처럼 층이 직접 적혀 있는 경우
  const floor = t.match(/(\d{1,3})\s*층/);
  if (floor) {
    const n = Number(floor[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 100) return n;
  }

  // 「305호」, 「2919호」처럼 호수로 층을 알 수 있는 경우 (세 자리 이상만)
  const room = [...t.matchAll(/(\d{3,5})\s*호/g)].pop();
  if (room) {
    const n = Math.floor(Number(room[1]) / 100);
    if (Number.isFinite(n) && n >= 1 && n <= 100) return n;
  }

  return null;
}

/** 화면에 보여 줄 층수 문구 (지하는 「지하 1층」으로 표시) */
export function floorLabel(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n < 0 ? `지하 ${Math.abs(n)}층` : `${n}층`;
}
