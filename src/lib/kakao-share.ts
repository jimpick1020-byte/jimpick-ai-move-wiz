/**
 * 카카오톡 공유 공통 모듈 — 관리자·업체 사장님이 같은 코드를 씁니다.
 *
 *  - 카카오 JavaScript SDK는 앱에서 한 번만 불러오고 한 번만 초기화합니다.
 *  - JavaScript 키는 화면용 VITE_KAKAO_JAVASCRIPT_KEY, 없으면 서버가 돌려주는
 *    공개용 JavaScript 키(getKakaoJsKey)를 씁니다. REST·Admin 키는 쓰지 않습니다.
 *  - 실패 원인을 구분해서 알려 줍니다(키 없음 / 도메인 미등록 / 로딩 실패 / 차단 …).
 *  - 공유창이 열린 것과 「전송 완료」는 다릅니다. 열림만 알려 줍니다.
 */
import { getKakaoJsKey } from "./kakao.functions";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Kakao?: any;
  }
}

export type KakaoShareCode =
  | "no_js_key"
  | "sdk_load_failed"
  | "sdk_missing"
  | "domain_not_registered"
  | "share_blocked"
  | "link_failed"
  | "canceled"
  | "network"
  | "forbidden"
  | "session_expired"
  | "deleted"
  | "unknown";

export const KAKAO_SHARE_MESSAGE: Record<KakaoShareCode, string> = {
  no_js_key: "카카오 JavaScript 키 설정이 필요합니다.",
  sdk_load_failed: "카카오 SDK 로딩에 실패했습니다. 통신 상태를 확인해 주세요.",
  sdk_missing: "카카오톡 공유를 사용할 수 없는 환경입니다.",
  domain_not_registered: "카카오 개발자 콘솔에 이 운영 도메인을 등록해야 합니다.",
  share_blocked: "카카오 공유창이 차단되었습니다. 브라우저 설정을 확인해 주세요.",
  link_failed: "공유 링크를 만들지 못했습니다.",
  canceled: "공유를 취소했습니다.",
  network: "네트워크 오류가 발생했습니다.",
  forbidden: "접근 권한이 없습니다.",
  session_expired: "로그인이 만료되었습니다. 다시 로그인해 주세요.",
  deleted: "삭제되었거나 만료된 견적서입니다.",
  unknown: "공유하지 못했습니다.",
};

export type ShareMethod = "kakao" | "web_share" | "copy_link";

export interface KakaoShareOutcome {
  ok: boolean;
  method: ShareMethod;
  code?: KakaoShareCode;
  error?: string;
}

let sdkPromise: Promise<{ ok: true } | { ok: false; code: KakaoShareCode }> | null = null;

/** SDK가 이미 준비돼 있는지 (사용자 클릭 순간 동기적으로 확인) */
export function kakaoReady(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.Kakao?.isInitialized?.() &&
    !!window.Kakao?.Share?.sendDefault
  );
}

/** SDK 로드 + 1회 초기화. 실패 원인을 코드로 돌려줍니다. */
export async function ensureKakaoSdk(): Promise<
  { ok: true } | { ok: false; code: KakaoShareCode }
> {
  if (typeof window === "undefined") return { ok: false, code: "sdk_missing" };
  if (kakaoReady()) return { ok: true };
  if (sdkPromise) return sdkPromise;

  sdkPromise = (async (): Promise<{ ok: true } | { ok: false; code: KakaoShareCode }> => {
    let key = (import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY as string | undefined)?.trim() ?? "";
    if (!key) {
      try {
        key = ((await getKakaoJsKey()).key ?? "").trim();
      } catch {
        key = "";
      }
    }
    if (!key) return { ok: false, code: "no_js_key" };

    if (!window.Kakao) {
      let script = document.querySelector<HTMLScriptElement>("script[data-kakao-share-sdk]");
      if (!script) {
        script = document.createElement("script");
        script.dataset.kakaoShareSdk = "1";
        script.async = true;
        script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
        script.integrity =
          "sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4";
        script.crossOrigin = "anonymous";
        const done = new Promise<void>((resolve, reject) => {
          script!.onload = () => resolve();
          script!.onerror = () => reject(new Error("kakao sdk load failed"));
        });
        document.head.appendChild(script);
        try {
          await done;
        } catch {
          return { ok: false, code: "sdk_load_failed" };
        }
      } else {
        for (let i = 0; i < 40 && !window.Kakao; i++) await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!window.Kakao) return { ok: false, code: "sdk_load_failed" };

    try {
      // 중복 초기화 금지 — 초기화되지 않았을 때만 init 합니다.
      if (!window.Kakao.isInitialized()) window.Kakao.init(key);
    } catch (err) {
      console.error("[kakao-share] init 실패:", err);
      return { ok: false, code: "no_js_key" };
    }
    if (!window.Kakao?.Share?.sendDefault) return { ok: false, code: "sdk_missing" };
    return { ok: true };
  })();

  const r = await sdkPromise;
  if (!r.ok) sdkPromise = null; // 다음 시도에서 다시 준비할 수 있게 합니다
  return r;
}

/** 카카오 오류 메시지에서 도메인 미등록을 구분합니다 */
function codeFromKakaoError(err: unknown): KakaoShareCode {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/domain|사이트 도메인|not registered|4002/i.test(msg)) return "domain_not_registered";
  if (/popup|blocked/i.test(msg)) return "share_blocked";
  return "unknown";
}

/**
 * 준비된 SDK로 공유창을 엽니다 (사용자 클릭 흐름에서 바로 호출).
 * 실패하면 null 을 돌려주고, 호출한 쪽에서 대체 공유를 진행합니다.
 */
export function openKakaoShare(text: string, url: string): KakaoShareOutcome | null {
  if (!kakaoReady()) return null;
  try {
    window.Kakao.Share.sendDefault({
      objectType: "text",
      text,
      link: { mobileWebUrl: url, webUrl: url },
      buttonTitle: "견적서 확인",
    });
    return { ok: true, method: "kakao" };
  } catch (err) {
    console.error("[kakao-share] 공유창 열기 실패:", err);
    const code = codeFromKakaoError(err);
    return { ok: false, method: "kakao", code, error: KAKAO_SHARE_MESSAGE[code] };
  }
}

/** 시스템 공유 시트 — 카카오톡을 골라 보낼 수 있고 본문이 잘리지 않습니다 */
export async function openWebShare(
  text: string,
  title = "JIMPICK 이사 견적 안내",
): Promise<KakaoShareOutcome | null> {
  if (typeof navigator === "undefined" || !navigator.share) return null;
  try {
    await navigator.share({ title, text });
    return { ok: true, method: "web_share" };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError")
      return {
        ok: false,
        method: "web_share",
        code: "canceled",
        error: KAKAO_SHARE_MESSAGE.canceled,
      };
    return null;
  }
}

/** 링크 복사 (마지막 대체 수단) */
export async function copyShareLink(url: string): Promise<KakaoShareOutcome> {
  try {
    await navigator.clipboard.writeText(url);
    return { ok: true, method: "copy_link" };
  } catch {
    return {
      ok: false,
      method: "copy_link",
      code: "unknown",
      error: "카카오톡 공유와 링크 복사가 모두 되지 않았습니다.",
    };
  }
}

/**
 * 공통 공유 실행 — 카카오톡 → 기본 공유 → 링크 복사 순서.
 * 카카오 템플릿 한도(약 190자)를 넘는 본문은 잘리지 않도록 기본 공유를 먼저 씁니다.
 */
export async function shareTextToKakao(opts: {
  text: string;
  url: string;
  title?: string;
}): Promise<KakaoShareOutcome> {
  const { text, url } = opts;
  const tooLong = text.length > 190;

  if (tooLong) {
    const shared = await openWebShare(text, opts.title);
    if (shared) return shared;
  }

  const immediate = openKakaoShare(tooLong ? `${text.slice(0, 187)}…` : text, url);
  if (immediate?.ok) return immediate;

  const ready = await ensureKakaoSdk();
  if (ready.ok) {
    const opened = openKakaoShare(tooLong ? `${text.slice(0, 187)}…` : text, url);
    if (opened?.ok) return opened;
    if (opened && !opened.ok) {
      const alt = await openWebShare(text, opts.title);
      if (alt) return alt;
      return opened;
    }
  }

  const alt = await openWebShare(text, opts.title);
  if (alt) return alt;

  const copied = await copyShareLink(url);
  if (copied.ok) return copied;
  return {
    ...copied,
    code: ready.ok ? copied.code : ready.code,
    error: ready.ok ? copied.error : KAKAO_SHARE_MESSAGE[ready.code],
  };
}

/** 고객용 견적 안내 공유 문구 (개인정보는 지역까지만) */
export function buildCustomerShareText(v: {
  customerName: string;
  moveDate?: string | null;
  fromArea?: string;
  toArea?: string;
  total?: number;
  url: string;
  companyName?: string;
}): string {
  const lines = ["[JIMPICK 이사 견적 안내]", ""];
  if (v.customerName) lines.push(`고객: ${v.customerName} 고객님`);
  if (v.moveDate) lines.push(`이사 날짜: ${v.moveDate}`);
  if (v.fromArea || v.toArea)
    lines.push(`이사 구간: ${v.fromArea || "미정"} → ${v.toArea || "미정"}`);
  if (v.total && v.total > 0) lines.push(`총 견적금액: ${v.total.toLocaleString("ko-KR")}원`);
  if (v.companyName) lines.push(`업체: ${v.companyName}`);
  lines.push("", `견적서 확인: ${v.url}`);
  return lines.join("\n");
}

/**
 * 직원용 업무지시서 공유 — 카카오톡에 카드 한 개만 보냅니다.
 *
 * 중요: 카카오 개발자 콘솔에 등록되지 않은 도메인은 카카오가 카드의 링크·버튼을
 * 오류 없이 조용히 제거해 버립니다(받는 사람이 카드를 눌러도 아무 반응 없음).
 * 그래서 본문 텍스트 안에 주소를 그대로 넣습니다. 카카오톡은 텍스트 속 주소를
 * 자동으로 누를 수 있는 링크로 바꿔 주기 때문에 도메인 등록과 무관하게 열립니다.
 */
export function openKakaoLinkCard(card: {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  buttonTitle?: string;
}): KakaoShareOutcome | null {
  if (!kakaoReady()) return null;
  // 본문은 카카오 템플릿 한도(약 190자) 안으로 맞춥니다.
  const head = `${card.title}\n${card.description}`.slice(0, 140);
  const text = `${head}\n\n${card.url}`;
  try {
    window.Kakao.Share.sendDefault({
      objectType: "text",
      text,
      link: { mobileWebUrl: card.url, webUrl: card.url },
      buttonTitle: card.buttonTitle || "작업 지시서 보기",
    });
    return { ok: true, method: "kakao" };
  } catch (err) {
    console.error("[kakao-share] 링크 카드 공유 실패:", err);
    const code = codeFromKakaoError(err);
    return { ok: false, method: "kakao", code, error: KAKAO_SHARE_MESSAGE[code] };
  }
}

/** 링크 카드 공유 실행 — 카카오톡 카드 → 시스템 공유(링크) → 링크 복사 */
export async function shareLinkCardToKakao(card: {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  buttonTitle?: string;
}): Promise<KakaoShareOutcome> {
  const immediate = openKakaoLinkCard(card);
  if (immediate?.ok) return immediate;

  const ready = await ensureKakaoSdk();
  if (ready.ok) {
    const opened = openKakaoLinkCard(card);
    if (opened?.ok) return opened;
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      // 일부 공유 대상은 url 필드를 버리므로 본문에도 주소를 넣습니다.
      await navigator.share({ title: card.title, text: `${card.description}\n${card.url}`, url: card.url });
      return { ok: true, method: "web_share" };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError")
        return { ok: false, method: "web_share", code: "canceled", error: KAKAO_SHARE_MESSAGE.canceled };
    }
  }

  const copied = await copyShareLink(card.url);
  if (copied.ok) return copied;
  return {
    ...copied,
    code: ready.ok ? copied.code : ready.code,
    error: ready.ok ? copied.error : KAKAO_SHARE_MESSAGE[ready.code],
  };
}
