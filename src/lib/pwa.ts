/**
 * 휴대폰 홈 화면에 설치한 짐픽 앱을 최신 버전으로 유지합니다.
 *
 * - 미리보기·개발 화면에서는 절대 등록하지 않습니다 (오래된 화면이 남는 문제 방지).
 * - 새 버전이 준비되면 한 번만 새로고침합니다 (무한 새로고침 방지).
 * - 작성 중인 견적은 이미 기기에 임시저장되므로 새로고침 뒤 그대로 복원됩니다.
 * - 저장 중·문자 발송 중이면 새로고침을 미룹니다.
 */

const SW_URL = "/sw.js";
/** 이번 방문에서 이미 한 번 새로고침했는지 (무한 새로고침 방지) */
const RELOADED_KEY = "jimpick_sw_reloaded";

/** 이 화면에서 서비스워커를 써도 되는지 */
function allowed(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!import.meta.env.PROD) return false;
  if (window.self !== window.top) return false;
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return false;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return false;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return false;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return false;
  if (new URL(window.location.href).searchParams.get("sw") === "off") return false;
  return true;
}

/** 이 화면에서 쓰면 안 되는 경우 남아 있는 등록을 지웁니다 */
async function unregisterAll() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").includes(SW_URL))
        .map((r) => r.unregister()),
    );
  } catch {
    /* 지우지 못해도 화면은 그대로 씁니다 */
  }
}

/**
 * 저장되지 않은 작업이 진행 중인지 — 문자 발송·저장 중에는 새로고침을 미룹니다.
 * 화면 코드에서 window.__jimpickBusy 를 켜고 끕니다.
 */
function busy(): boolean {
  return Boolean((window as unknown as { __jimpickBusy?: boolean }).__jimpickBusy);
}

/** 새 버전이 활성화되면 한 번만 새로고침합니다 */
function reloadOnce() {
  try {
    if (sessionStorage.getItem(RELOADED_KEY) === "1") return;
    sessionStorage.setItem(RELOADED_KEY, "1");
  } catch {
    return; // 표시를 남길 수 없으면 새로고침하지 않습니다 (반복 방지)
  }
  const go = () => window.location.reload();
  if (!busy()) {
    go();
    return;
  }
  // 저장·발송이 끝날 때까지 기다립니다 (최대 2분)
  let waited = 0;
  const timer = window.setInterval(() => {
    waited += 1000;
    if (!busy() || waited > 120_000) {
      window.clearInterval(timer);
      go();
    }
  }, 1000);
}

export function registerPwa() {
  if (!allowed()) {
    void unregisterAll();
    return;
  }

  const onControllerChange = () => reloadOnce();

  void navigator.serviceWorker
    .register(SW_URL, { scope: "/" })
    .then((reg) => {
      // 첫 설치일 때는 새로고침하지 않습니다
      if (!navigator.serviceWorker.controller) {
        try {
          sessionStorage.setItem(RELOADED_KEY, "1");
        } catch {
          /* 무시 */
        }
      }
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      // 앱을 실행할 때, 그리고 다시 화면으로 돌아올 때 새 버전을 확인합니다
      const check = () => {
        if (document.visibilityState === "visible") void reg.update().catch(() => {});
      };
      check();
      document.addEventListener("visibilitychange", check);
    })
    .catch(() => {
      /* 등록 실패해도 앱은 정상 동작합니다 */
    });
}
