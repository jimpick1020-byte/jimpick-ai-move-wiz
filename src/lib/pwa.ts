/**
 * 휴대폰 홈 화면에 설치한 짐픽 앱을 최신 버전으로 유지합니다.
 *
 * - 미리보기·개발 화면에서는 절대 등록하지 않습니다 (오래된 화면이 남는 문제 방지).
 * - 새 버전은 사용자가 적용할 때만 재시작합니다.
 * - 편집·저장·실패한 입력이 있으면 적용하지 않습니다. 시간제한으로 강제 재시작하지 않습니다.
 */
import { toast } from "sonner";
import { appUpdateBlocked, createUpdateRestart } from "./update-safety";
import { isPreviewHost } from "./preview-host";

const SW_URL = "/sw.js";
const CACHE_VERSION = "v9-ai-access";
let registered = false;

async function cleanupOldCaches() {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.allSettled(
      names
        .filter((name) => name.startsWith("jimpick-") && !name.includes(CACHE_VERSION))
        .map((name) => caches.delete(name)),
    );
  } catch {
    /* 캐시 정리에 실패해도 앱 데이터나 로그인 상태는 건드리지 않습니다 */
  }
}

/** 이 화면에서 서비스워커를 써도 되는지 */
function allowed(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!import.meta.env.PROD) return false;
  if (window.self !== window.top) return false;
  const h = window.location.hostname;
  if (isPreviewHost(h)) return false;
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
  return appUpdateBlocked() || Boolean((window as unknown as { __jimpickBusy?: boolean }).__jimpickBusy) ||
    Boolean(document.querySelector('.jp-sheet-inline'));
}

export function registerPwa() {
  if (!allowed()) {
    void unregisterAll();
    return;
  }
  if (registered) return;
  registered = true;

  void cleanupOldCaches();
  const restart = createUpdateRestart(busy, () => window.location.reload());
  let applying = false;
  let activated = false;
  let registration: ServiceWorkerRegistration | undefined;
  const offerUpdate = () => toast.info("새 버전이 준비되었습니다", {
    id: "jimpick-app-update", duration: Infinity,
    action: { label: "적용", onClick: () => {
      if (busy()) { toast.info("작성·저장을 마친 뒤 새 버전을 적용해 주세요."); offerUpdate(); return; }
      if (applying) return;
      if (registration?.waiting && !activated) {
        applying = true;
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      } else restart();
    } },
  });
  const onControllerChange = () => {
    activated = true;
    if (applying && restart()) return;
    applying = false;
    offerUpdate();
  };

  void navigator.serviceWorker
    .register(`${SW_URL}?v=${CACHE_VERSION}`, { scope: "/", updateViaCache: "none" })
    .then((reg) => {
      registration = reg;
      // First installation is not an update and needs no restart.
      let installed = Boolean(navigator.serviceWorker.controller);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!installed) { installed = true; return; }
        onControllerChange();
      });

      /** Keep checking for updates, but retain the active screen until explicit application. */
      const activateWaiting = () => {
        if (reg.waiting) { activated = false; offerUpdate(); }
      };

      // 앱을 실행할 때, 다시 화면으로 돌아올 때, 그리고 켜 둔 동안 주기적으로 새 버전을 확인합니다
      const check = () => {
        if (document.visibilityState !== "visible") return;
        void reg
          .update()
          .then(activateWaiting)
          .catch(() => {});
      };
      check();
      activateWaiting();
      reg.addEventListener("updatefound", () => {
        reg.installing?.addEventListener("statechange", () => {
          if (reg.waiting) activateWaiting();
        });
      });
      document.addEventListener("visibilitychange", check);
      // 홈 화면 앱은 화면을 오래 켜 두는 경우가 많아 30분마다 한 번 더 확인합니다
      window.setInterval(check, 30 * 60 * 1000);
    })
    .catch(() => {
      registered = false;
      /* 등록 실패해도 앱은 정상 동작합니다 */
    });
}
