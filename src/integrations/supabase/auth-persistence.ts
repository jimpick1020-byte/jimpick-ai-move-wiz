// 로그인 상태 유지(remember me) 저장소 라우팅.
//
// Supabase Auth 세션(access/refresh token)을 어디에 보관할지 결정합니다.
//  - "로그인 상태 유지" 체크 → 기존 저장소(localStorage / 프리뷰 브로커)에 보관
//    → 브라우저를 닫아도 유지되고, refresh token 으로 자동 갱신됩니다.
//  - 체크 안 함(공용 컴퓨터 등) → sessionStorage 에만 보관
//    → 탭/브라우저를 닫으면 세션이 사라집니다(일반 세션).
//
// 비밀번호 원문은 절대 저장하지 않습니다. 여기 담기는 값은 Supabase 가 관리하는
// 세션 토큰(JWT)뿐입니다.

const REMEMBER_KEY = "jimpick_auth_remember";

/** supabase-js 가 기대하는 storage 어댑터 형태 (값은 동기/Promise 모두 가능) */
type MaybePromise<T> = T | Promise<T>;
export interface AuthStorageLike {
  getItem: (key: string) => MaybePromise<string | null>;
  setItem: (key: string, value: string) => MaybePromise<void> | void;
  removeItem: (key: string) => MaybePromise<void> | void;
}

/**
 * 지금 "로그인 상태 유지"를 쓰는지.
 *
 * 선택 기록이 없는 기존 Google 세션도 영구 보관합니다.
 * 공용 기기에서 명시적으로 해제한 경우에만 탭 한정 저장을 사용합니다.
 */
export function isRememberMe(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * 로그인 직전에 호출합니다. 이 선택에 따라 다음에 저장되는 세션이
 * 기존 저장소(유지) 또는 sessionStorage(세션 한정)로 들어갑니다.
 */
export function setRememberMe(on: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, on ? "1" : "0");
  } catch {
    /* 저장을 못 해도 로그인 자체는 진행됩니다 */
  }
}

function safeSession(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function readTemporary(key: string): string | null {
  try { return safeSession()?.getItem(key) ?? null; } catch { return null; }
}

function clearTemporary(key: string): void {
  try { safeSession()?.removeItem(key); } catch { /* durable storage remains authoritative */ }
}

/**
 * 기존 저장소(base: localStorage 또는 Lovable 프리뷰 브로커)를 감싸,
 * "로그인 상태 유지" 선택에 따라 sessionStorage 로 우회시킵니다.
 *
 * - 유지 ON  : base 를 그대로 사용(브라우저 종료 후에도 세션 보존).
 * - 유지 OFF : 새 로그인은 sessionStorage 에 저장합니다. 기존 영구 세션은
 *             토큰 갱신만으로 삭제하지 않습니다.
 * removeItem(로그아웃)은 항상 양쪽을 모두 지워 세션을 완전히 제거합니다.
 */
export function rememberAwareAuthStorage(
  base: AuthStorageLike | undefined,
): AuthStorageLike | undefined {
  if (typeof window === "undefined") return base; // SSR: 저장소 없음

  // 이미 영구 보관된 세션은 이전 버전의 선택값이 0이어도 갱신 중 삭제하지 않습니다.
  const persistentKeys = new Set<string>();

  return {
    async getItem(key: string): Promise<string | null> {
      const temporary = readTemporary(key);
      if (!isRememberMe() && temporary != null) return temporary;
      const stored = base ? await base.getItem(key) : null;
      if (stored != null) {
        persistentKeys.add(key);
        return stored;
      }
      if (temporary != null && isRememberMe()) {
        await base?.setItem(key, temporary);
        persistentKeys.add(key);
        clearTemporary(key);
      }
      return temporary;
    },
    setItem(key: string, value: string): MaybePromise<void> | void {
      if (isRememberMe() || persistentKeys.has(key)) {
        persistentKeys.add(key);
        clearTemporary(key);
        return base?.setItem(key, value);
      }
      try {
        safeSession()?.setItem(key, value);
      } catch {
        /* noop */
      }
    },
    removeItem(key: string): MaybePromise<void> | void {
      persistentKeys.delete(key);
      // 로그아웃: 두 저장소 모두에서 세션을 완전히 지웁니다.
      try {
        safeSession()?.removeItem(key);
      } catch {
        /* noop */
      }
      return base?.removeItem(key);
    },
  };
}
