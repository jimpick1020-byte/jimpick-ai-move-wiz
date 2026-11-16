/**
 * 티맵 길안내 — 운전자 현재 위치(티맵이 결정) → 누른 주소 한 곳.
 * 공식 TMAP 앱 URL 스킴: tmap://route?goalname&goalx(경도)&goaly(위도), 좌표 없으면 tmap://search?name.
 * 상세주소(동·호수·공동현관)·전화·고객명은 절대 넣지 않습니다.
 */
export const TMAP_ANDROID_STORE = "https://play.google.com/store/apps/details?id=com.skt.tmap.ku";
export const TMAP_IOS_STORE = "https://apps.apple.com/kr/app/id431589174";

const ROAD = /^(.*?(?:로|길)\s?\d+(?:-\d+)?)(?=$|[\s,(])/;
const JIBUN = /^(.*?[가-힣](?:동|리|가)\s(?:산\s?)?\d+(?:-\d+)?)(?=$|[\s,(])/;
const PRIVATE = /\d+\s*(?:동|호|층)|현관|비번|비밀번호|#|\d{2,4}-\d{3,4}-\d{4}/;

/** 도로명/지번 기본 주소(+검색 결과 건물명)만 남기고 뒤의 상세는 제거합니다. */
export function baseAddress(raw?: string | null): string {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const m = text.match(ROAD) ?? text.match(JIBUN);
  if (!m) return PRIVATE.test(text) ? "" : text;
  const base = m[1].trim();
  const building = text.slice(m[0].length).match(/^\s*\(([^()]+)\)/)?.[1]?.trim();
  return building && !PRIVATE.test(building) ? `${base} (${building})` : base;
}

/** 대한민국 범위의 유효한 경도(x)·위도(y)만 인정합니다. 뒤바뀐 좌표는 거절. */
export function validCoord(x?: number | null, y?: number | null): { x: number; y: number } | null {
  const lon = Number(x), lat = Number(y);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lon < 124 || lon > 132.5 || lat < 33 || lat > 39.5) return null;
  return { x: lon, y: lat };
}

export function tmapUrl(address?: string | null, x?: number | null, y?: number | null): string | null {
  const name = baseAddress(address);
  if (!name) return null;
  const c = validCoord(x, y);
  const enc = encodeURIComponent(name);
  return c ? `tmap://route?goalname=${enc}&goalx=${c.x}&goaly=${c.y}` : `tmap://search?name=${enc}`;
}

export type NavPlatform = "android" | "ios" | "desktop";
export function navPlatform(ua: string): NavPlatform {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && /mobile/i.test(ua))) return "ios";
  return "desktop";
}
