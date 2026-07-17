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
  Step5,
  Step6,
  AIRecognition,
  OptionsScreen,
  Result,
  History,
  Customers,
  SettingsScreen,
} from "@/components/jimpick/screens";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JIMPICK 7.0 — AI 이사 견적 앱" },
      { name: "description", content: "AI로 더 쉽고 정확한 이사 견적. 방별 품목, 차량, 옵션, 보관료까지 한 번에 계산합니다." },
      { property: "og:title", content: "JIMPICK 7.0 — AI 이사 견적 앱" },
      { property: "og:description", content: "AI 사진 인식과 자동 계산으로 견적을 5분 안에 완성하세요." },
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
    case "step5": return <Step5 />;
    case "step6": return <Step6 />;
    case "ai": return <AIRecognition />;
    case "options": return <OptionsScreen />;
    case "result": return <Result />;
    case "history": return <History />;
    case "customers": return <Customers />;
    case "settings": return <SettingsScreen />;
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
