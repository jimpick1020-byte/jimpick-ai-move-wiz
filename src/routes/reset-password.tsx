import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { JimpickProvider } from "@/lib/jimpick";
import { ResetPasswordScreen } from "@/components/jimpick/password";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "비밀번호 재설정 — 견적잇" },
      { name: "description", content: "메일로 받은 링크로 견적잇 사장님 계정의 새 비밀번호를 정합니다." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "비밀번호 재설정 — 견적잇" },
      { property: "og:description", content: "메일로 받은 링크로 견적잇 계정 비밀번호를 새로 정합니다." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <JimpickProvider>
      <ResetPasswordScreen />
      <Toaster position="top-center" />
    </JimpickProvider>
  );
}
