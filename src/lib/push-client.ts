/** 이 휴대폰에서 사장님 알림(웹 표준 푸시)을 켭니다. 반드시 버튼을 눌렀을 때 부릅니다. */
import { savePushSubscription } from "./notifications.functions";

export const VAPID_PUBLIC_KEY = "BGVnNKqqIoIwI-02XKWtB9yyIHSbS0da2wQmWSkOTm-fwYfumke-OjMyFy0D3lw6s29wZrtwMgHf8Wk9nri0I9Y";

export type PushState = "on" | "off" | "denied" | "unsupported" | "open-in-app";

function keyBytes(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function appWorker(): Promise<ServiceWorkerRegistration | null> {
  const regs = await navigator.serviceWorker.getRegistrations();
  return regs.find((r) => (r.active?.scriptURL ?? "").includes("/sw.js")) ?? null;
}

export async function currentPushState(): Promise<PushState> {
  if (!supported()) return "unsupported";
  if (window.self !== window.top) return "open-in-app";
  if (Notification.permission === "denied") return "denied";
  const reg = await appWorker();
  if (!reg) return "open-in-app";
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

export async function enablePush(): Promise<PushState> {
  if (!supported()) return "unsupported";
  if (window.self !== window.top) return "open-in-app";
  const reg = await appWorker();
  // 미리보기 화면에는 서비스워커를 두지 않으므로 게시된 앱(홈 화면 앱)에서만 켤 수 있습니다.
  if (!reg) return "open-in-app";
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) as BufferSource,
  }));
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return "off";
  const saved = await savePushSubscription({ data: { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth } });
  return saved.ok ? "on" : "off";
}
