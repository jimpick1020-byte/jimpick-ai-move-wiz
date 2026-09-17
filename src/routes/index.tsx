import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { JimpickProvider, useApp } from "@/lib/jimpick";
import {
  Splash,
  Login,
  HomeScreen,
  Step1,
  Step2,
  Step3,
  Step4,
  Step6,
  AIRecognition,
  OptionsScreen,
  Result,
  History,
  Customers,
  SettingsScreen,
  StatsScreen,
} from "@/components/jimpick/screens";

import { SignupScreen, SubscriptionScreen } from "@/components/jimpick/account";
import { AdminAccountsScreen } from "@/components/jimpick/admin";
import { ForgotPasswordScreen } from "@/components/jimpick/password";
import { AuthLoadingScreen } from "@/components/jimpick/AuthUi";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JIMPICK 7.0 — AI 이사 견적 앱" },
      { name: "description", content: "AI로 더 쉽고 정확한 이사 견적. 방별 품목, 차량, 옵션, 보관료까지 한 번에 계산합니다." },
      { property: "og:title", content: "JIMPICK 7.0 — AI 이사 견적 앱" },
      { property: "og:description", content: "AI로 더 쉽고 정확한 이사 견적. 방별 품목, 차량, 옵션, 보관료까지 한 번에 계산합니다." },
    ],
  }),
  component: Index,
});

function Screens() {
  const { screen, authChecking, retryAuthCheck } = useApp();
  if (authChecking) return <AuthLoadingScreen onRetry={retryAuthCheck} />;
  switch (screen) {
    case "splash": return <Splash />;
    case "login": return <Login />;
    case "home": return <HomeScreen />;
    case "step1": return <Step1 />;
    case "step2": return <Step2 />;
    case "step3": return <Step3 />;
    case "step4": return <Step4 />;
    case "step6": return <Step6 />;
    case "plan": return <OptionsScreen />;
    case "ai": return <AIRecognition />;
    case "options": return <OptionsScreen />;
    case "result": return <Result />;
    case "history": return <History />;
    case "customers": return <Customers />;
    case "signup": return <SignupScreen />;
    case "forgot": return <ForgotPasswordScreen />;
    case "subscription": return <SubscriptionScreen />;
    case "settings": return <SettingsScreen />;
    case "stats": return <StatsScreen />;
    case "adminAccounts": return <AdminAccountsScreen />;
    case "errorLogs": return <ErrorLogScreen />;
    default: return <Splash />;
  }
}

function Router() {
  const { screen, loggedIn } = useApp();

  // 화면에서 잡히지 않은 오류(통신 실패 등)도 기록합니다. 개인정보는 서버에서 지웁니다.
  useEffect(() => {
    if (!loggedIn) return;
    let last = 0;
    const record = (message: string) => {
      // 같은 오류가 쏟아질 때 기록이 넘치지 않도록 5초에 한 번만 남깁니다.
      if (Date.now() - last < 5000) return;
      last = Date.now();
      void logAppError({
        data: { screen, kind: "runtime", message: message.slice(0, 500), recovery: "none", attempts: 0 },
      }).catch(() => {});
    };
    const onError = (e: ErrorEvent) => record(e.message || "화면 오류");
    const onReject = (e: PromiseRejectionEvent) =>
      record(e.reason instanceof Error ? e.reason.message : String(e.reason ?? "처리되지 않은 오류"));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, [screen, loggedIn]);

  return (
    <JimpickErrorBoundary screen={screen}>
      <Screens />
    </JimpickErrorBoundary>
  );
}

function Index() {
  return (
    <JimpickProvider>
      <Router />
      <Toaster position="top-center" />
    </JimpickProvider>
  );
}

