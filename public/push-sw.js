/* 견적잇 사장님 알림 — 앱이 닫혀 있어도 휴대폰 알림을 표시합니다. (서비스워커에 함께 불러옵니다) */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: "견적잇 알림", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "견적잇 알림";
  const url = (data.url || "/") + (data.id ? ((data.url || "/").includes("?") ? "&" : "?") + "nid=" + encodeURIComponent(data.id) : "");
  const tasks = [self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/app-icon-192.png",
    badge: "/app-icon-192.png",
    tag: data.tag || data.id || undefined,
    data: { url },
  })];
  // 아이콘 숫자 배지는 지원하는 환경(아이폰 홈 화면 앱, PC 크롬 등)에서만 표시됩니다.
  if (typeof data.unread === "number" && self.navigator && "setAppBadge" in self.navigator) {
    tasks.push(data.unread > 0 ? self.navigator.setAppBadge(data.unread).catch(() => {}) : self.navigator.clearAppBadge().catch(() => {}));
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const win of wins) {
      if (new URL(win.url).origin === self.location.origin) {
        try { await win.focus(); await win.navigate(target); return; } catch (e) { /* 새 창으로 엽니다 */ }
      }
    }
    await self.clients.openWindow(target);
  })());
});
