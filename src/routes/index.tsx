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

function Router() {
  const { screen } = useApp();
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
    case "ai": return <OptionsScreen />;

    case "options": return <OptionsScreen />;
    case "result": return <Result />;
    case "history": return <History />;
    case "customers": return <Customers />;
    case "signup": return <SignupScreen />;
    case "subscription": return <SubscriptionScreen />;
    case "settings": return <SettingsScreen />;
    case "stats": return <StatsScreen />;
    default: return <Splash />;
  }
}

function Index() {
  return (
    <JimpickProvider>
      <Router />
      <Toaster position="top-center" />
    </JimpickProvider>
  );
}
