/**
 * 입력 중 자동 하이픈. 화면에는 하이픈을 보이고, 저장·API용 숫자 원본은 digitsOnly()로 얻습니다.
 */
import type React from "react";

export const digitsOnly = (v: string) => (v || "").replace(/\D/g, "");

/** 휴대전화·일반전화(지역번호 길이 반영) */
export function formatTel(v: string): string {
  const d = digitsOnly(v).slice(0, 12);
  if (!d) return "";
  // 대표번호 1588-0000
  if (/^1[5-9]/.test(d)) return d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4, 8)}`;
  const area = d.startsWith("02") ? 2 : 3;
  if (d.length <= area) return d;
  const rest = d.slice(area);
  const rest11 = d.length === 11 || (area === 2 && d.length === 10);
  if (rest.length <= 3) return `${d.slice(0, area)}-${rest}`;
  if (rest.length <= 7 && !rest11) {
    const mid = rest.length <= 7 && rest.length > 4 ? rest.length - 4 : rest.length;
    return rest.length <= 4
      ? `${d.slice(0, area)}-${rest}`
      : `${d.slice(0, area)}-${rest.slice(0, mid)}-${rest.slice(mid)}`;
  }
  return `${d.slice(0, area)}-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
}

/** 사업자등록번호 123-45-67890 */
export function formatBizNo(v: string): string {
  const d = digitsOnly(v).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** 은행별 확인된 계좌 형식 (자리수가 정확히 맞을 때만 적용) */
const BANK_FORMATS: [RegExp, number[]][] = [
  [/국민|KB/i, [6, 2, 6]],
  [/신한/, [3, 3, 6]],
  [/우리/, [4, 3, 6]],
  [/하나/, [3, 6, 5]],
  [/농협|NH/i, [3, 4, 4, 2]],
  [/기업|IBK/i, [3, 6, 2, 3]],
  [/카카오/, [4, 2, 7]],
  [/토스/, [4, 4, 4]],
];

/** 계좌번호: 은행 형식을 알고 자리수가 맞으면 그 형식, 아니면 사용자가 넣은 하이픈 유지 */
export function formatAccount(v: string, bank: string): string {
  const kept = (v || "").replace(/[^0-9-]/g, "").replace(/-{2,}/g, "-").slice(0, 30);
  const d = digitsOnly(kept);
  const fmt = BANK_FORMATS.find(([re]) => re.test(bank || ""))?.[1];
  if (!fmt || fmt.reduce((a, b) => a + b, 0) !== d.length) return kept;
  const out: string[] = [];
  let i = 0;
  for (const n of fmt) {
    out.push(d.slice(i, i + n));
    i += n;
  }
  return out.join("-");
}

/**
 * 커서 위치를 지키며 포맷합니다. 커서 앞 숫자 개수를 세어, 포맷 후 같은 숫자 뒤에 커서를 둡니다.
 * 사용: onChange={(e) => onFormatted(e, formatTel, setValue)}
 */
export function onFormatted(
  e: React.ChangeEvent<HTMLInputElement>,
  fmt: (v: string) => string,
  set: (v: string) => void,
) {
  const el = e.target;
  const raw = el.value;
  const caret = el.selectionStart ?? raw.length;
  const digitsBefore = digitsOnly(raw.slice(0, caret)).length;
  const next = fmt(raw);
  set(next);
  requestAnimationFrame(() => {
    if (document.activeElement !== el) return;
    let pos = 0;
    let seen = 0;
    while (pos < next.length && seen < digitsBefore) {
      if (/\d/.test(next[pos])) seen++;
      pos++;
    }
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      /* noop */
    }
  });
}
