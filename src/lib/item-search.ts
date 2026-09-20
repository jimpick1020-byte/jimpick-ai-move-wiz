/**
 * 품목 검색·여러 품목 입력을 돕는 작은 도구 모음.
 *
 * - 쉼표·줄바꿈·가운데점으로 적은 여러 품목 이름을 나눕니다.
 * - 공백·대소문자 차이를 무시하고, 한글 초성 검색(ㄴㅈㄱ → 냉장고)도 됩니다.
 */

/** 검색 비교용으로 다듬은 글자 (공백·기호 제거, 소문자) */
export function searchNorm(raw: string): string {
  return (raw || "").toLowerCase().replace(/[\s·・.,()[\]{}/\\_-]/g, "");
}

const CHO = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

/** 한글 이름의 초성만 뽑습니다 (냉장고 → ㄴㅈㄱ) */
export function chosungOf(raw: string): string {
  let out = "";
  for (const ch of searchNorm(raw)) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) out += CHO[Math.floor((code - 0xac00) / 588)];
    else out += ch;
  }
  return out;
}

/** 검색어가 초성만으로 되어 있는지 (ㄴㅈㄱ 처럼) */
export function isChosungQuery(q: string): boolean {
  const s = searchNorm(q);
  return s.length > 0 && [...s].every((c) => CHO.includes(c));
}

/**
 * 품목 한 건이 검색어에 걸리는지 확인합니다.
 * 품목명·별칭·그룹명을 함께 살펴보고, 초성 검색도 지원합니다.
 */
export function matchesQuery(query: string, ...fields: (string | undefined)[]): boolean {
  const q = searchNorm(query);
  if (!q) return true;
  const cho = isChosungQuery(query);
  return fields.some((f) => {
    if (!f) return false;
    return cho ? chosungOf(f).includes(q) : searchNorm(f).includes(q);
  });
}

/**
 * 「만들 품목 이름」 입력을 여러 품목으로 나눕니다.
 * 쉼표·줄바꿈·가운데점으로 나누고, 앞뒤 공백을 지우고, 빈 이름과 중복은 뺍니다.
 */
export function splitItemNames(raw: string, limit = 12): string[] {
  const parts = (raw || "")
    .split(/[,\n·・;]+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of parts) {
    const key = searchNorm(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}
