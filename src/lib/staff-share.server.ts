/**
 * 직원용 공유 링크 — 서버 전용 도우미.
 * 토큰 원문은 저장하지 않고 SHA-256 해시만 데이터베이스에 남깁니다.
 */

/** 추측하기 어려운 무작위 토큰 (32바이트 → 64자리 16진수) */
export function makeStaffToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 토큰 → SHA-256 해시 (데이터베이스에 저장하는 값) */
export async function hashStaffToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 기본 유효기간 — 이사 완료일 다음 날 23:59 (날짜를 모르면 7일 뒤) */
export function defaultExpiry(moveDate?: string | null): Date {
  const base = moveDate ? new Date(`${moveDate}T00:00:00+09:00`) : null;
  if (base && !Number.isNaN(base.getTime())) {
    // 이사 다음 날 끝까지 (한국 시간 기준)
    return new Date(base.getTime() + 2 * 24 * 60 * 60 * 1000 - 60 * 1000);
  }
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}
