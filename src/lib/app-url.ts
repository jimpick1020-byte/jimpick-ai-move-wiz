/** 외부로 나가는 모든 링크의 기준 운영 주소 (미리보기 주소는 절대 쓰지 않습니다) */
export const PUBLIC_APP_URL = "https://jimpick-ai-move-wiz.lovable.app";

/** 운영 주소 기준 절대 링크 */
export function publicUrl(path: string): string {
  return `${PUBLIC_APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** 미리보기 주소·영수증 파라미터가 들어간 링크를 운영 주소로 바꿉니다 */
export function toPublicUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.delete("_lovable_receipt");
    const h = u.hostname;
    if (h.startsWith("id-preview") || h.startsWith("preview--") || h.endsWith("lovableproject.com")) {
      return `${PUBLIC_APP_URL}${u.pathname}${u.search}${u.hash}`;
    }
    return u.toString();
  } catch {
    return raw;
  }
}

/** 현재 주소창에서 _lovable_receipt 파라미터를 지웁니다 (새로고침 없음) */
export function stripReceiptParam(): void {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  if (!u.searchParams.has("_lovable_receipt")) return;
  u.searchParams.delete("_lovable_receipt");
  window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
}
