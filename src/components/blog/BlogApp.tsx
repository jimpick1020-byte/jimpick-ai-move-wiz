/*
 * AI 부동산 블로그 자동 작성 — 앱 셸 (헤더 + 하단 내비 + 화면 라우팅)
 * 화이트 + 퍼플, 모바일 우선. 기존 짐픽 앱과 완전히 분리된 독립 앱입니다.
 */
import { Toaster } from "@/components/ui/sonner";
import { Home, Plus, Clock, CheckCircle2, Settings } from "lucide-react";
import { BlogProvider, useBlog, type Screen } from "./context";
import { EditorScreen } from "./EditorScreen";
import { PreviewScreen } from "./PreviewScreen";
import { CompleteScreen } from "./CompleteScreen";
import { HomeScreen, ListScreen, SettingsScreen, SubscriptionScreen } from "./MenuScreens";

function Header() {
  const { go, screen } = useBlog();
  return (
    <header className="sticky top-0 z-30 border-b border-violet-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <button onClick={() => go("home")} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white">
            <Home size={18} />
          </div>
          <div className="text-left leading-none">
            <p className="text-[15px] font-extrabold text-slate-800">AI 부동산 블로그</p>
            <p className="mt-0.5 text-[11px] text-violet-500">스마트 홍보 시스템</p>
          </div>
        </button>
        {screen !== "editor" && (
          <button
            onClick={() => go("subscription")}
            className="rounded-full border border-violet-200 px-3 py-1.5 text-[12px] font-bold text-violet-600"
          >
            요금제
          </button>
        )}
      </div>
    </header>
  );
}

// 하단 메뉴는 심플하게: 홈 / 작성중 / 새 매물 / 완료 / 설정
// (짐픽의 견적/고객/통계 메뉴는 가져오지 않습니다)
const NAV: { screen: Screen; label: string; icon: typeof Home; action?: "new" }[] = [
  { screen: "home", label: "홈", icon: Home },
  { screen: "drafts", label: "작성중", icon: Clock },
  { screen: "editor", label: "새 매물", icon: Plus, action: "new" },
  { screen: "done", label: "완료", icon: CheckCircle2 },
  { screen: "settings", label: "설정", icon: Settings },
];

function BottomNav() {
  const { screen, go, startNew } = useBlog();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-violet-100 bg-white/95 backdrop-blur">
      <div className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {NAV.map((n) => {
          const active = screen === n.screen && !n.action;
          if (n.action === "new") {
            return (
              <button
                key={n.label}
                onClick={startNew}
                className="flex flex-col items-center gap-0.5 py-1.5"
              >
                <span className="-mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-300">
                  <n.icon size={24} />
                </span>
                <span className="text-[10px] font-bold text-violet-600">{n.label}</span>
              </button>
            );
          }
          return (
            <button
              key={n.label}
              onClick={() => go(n.screen)}
              className={`flex flex-col items-center gap-0.5 py-2.5 ${
                active ? "text-violet-600" : "text-slate-400"
              }`}
            >
              <n.icon size={21} />
              <span className="text-[10px] font-semibold">{n.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ScreenRouter() {
  const { screen, editorStep } = useBlog();
  switch (screen) {
    case "home":
      return <HomeScreen />;
    case "editor":
      if (editorStep === "preview") return <PreviewScreen />;
      if (editorStep === "complete") return <CompleteScreen />;
      return <EditorScreen />;
    case "drafts":
      return <ListScreen filter="draft" />;
    case "done":
      return <ListScreen filter="done" />;
    case "blogs":
      return <ListScreen filter="all" />;
    case "settings":
      return <SettingsScreen />;
    case "subscription":
      return <SubscriptionScreen />;
    default:
      return <HomeScreen />;
  }
}

function Shell() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/60 to-white text-slate-900">
      <Header />
      <main className="mx-auto max-w-md px-4 pb-24 pt-4">
        <ScreenRouter />
      </main>
      <BottomNav />
      <Toaster position="top-center" />
    </div>
  );
}

export function BlogApp() {
  return (
    <BlogProvider>
      <Shell />
    </BlogProvider>
  );
}
