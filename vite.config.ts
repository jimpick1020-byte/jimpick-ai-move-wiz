// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        // 등록은 src/lib/pwa.ts 한 곳에서만 합니다
        injectRegister: null,
        // 미리보기·개발 화면에서는 서비스워커를 만들지 않습니다
        devOptions: { enabled: false },
        // 앱 이름·아이콘은 public/manifest.webmanifest 를 그대로 씁니다 (중복 생성 금지)
        manifest: false,
        filename: "sw.js",
        workbox: {
          // 파일명이 해시 처리된 정적 파일만 미리 담습니다
          globDirectory: ".vite/build/client",
          globPatterns: ["assets/**/*.{js,css,woff2}"],
          navigateFallback: undefined,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigationPreload: false,
          runtimeCaching: [
            {
              // HTML 화면은 항상 최신 버전을 먼저 확인합니다
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" &&
                !url.pathname.startsWith("/api/") &&
                !url.pathname.startsWith("/~oauth") &&
                !url.pathname.startsWith("/share/") &&
                !url.pathname.startsWith("/staff/") &&
                !url.pathname.startsWith("/reset-password"),
              handler: "NetworkFirst",
              options: {
                cacheName: "jimpick-html",
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 10 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              // 해시가 붙은 정적 파일만 캐시합니다
              urlPattern: ({ url, sameOrigin }) =>
                Boolean(sameOrigin) && /^\/assets\/.+\.[0-9a-zA-Z_-]{8,}\./.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "jimpick-assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
          // 고객정보·견적·문자발송·보안 토큰 요청은 절대 캐시하지 않습니다
          // (아래 목록에 없는 요청은 위 runtimeCaching 규칙에 걸리지 않으면 그대로 통과합니다)
        },
      }),
    ],
  },
});
