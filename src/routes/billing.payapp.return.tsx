import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { getPayappTest } from "@/lib/payapp.functions";
import { recoverAuthSession } from "@/lib/auth-recovery";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/billing/payapp/return")({
  head: () => ({ meta: [
    { title: "페이앱 구독 시험 확인 — 견적잇" },
    { name: "description", content: "견적잇 페이앱 무청구 구독 시험 결과 확인." },
    { property: "og:title", content: "페이앱 구독 시험 확인 — 견적잇" },
    { property: "og:description", content: "실제 청구 없는 견적잇 구독 시험 결과를 확인합니다." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: PayappReturn,
});

function PayappReturn() {
  const readTest = useServerFn(getPayappTest);
  const [message, setMessage] = useState("저장된 시험 결과 확인 중…");
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await recoverAuthSession(supabase.auth);
        const result = await readTest();
        if (!alive) return;
        const state = result.state;
        setMessage(state
          ? `저장된 모의 승인 ${state.events.length}회 · 모의 합계 ${state.simulatedTotal.toLocaleString("ko-KR")}원 · ${state.status === "canceled" ? "해지됨" : state.status === "active" ? "갱신됨" : "등록됨"}`
          : "저장된 구독 시험이 없습니다.");
      } catch {
        if (alive) setMessage("저장된 시험 결과를 확인하지 못했습니다. 견적잇으로 돌아가 로그인 후 다시 확인해 주세요.");
      }
    })();
    return () => { alive = false; };
  }, [readTest]);
  return <main className="min-h-dvh bg-background px-5 py-16 text-foreground">
    <div className="mx-auto max-w-md space-y-5">
      <p className="font-bold text-primary">견적잇</p>
      <h1 className="text-2xl font-bold">페이앱 구독 테스트</h1>
      <p className="font-semibold">실제 청구 없음</p>
      <p role="status" className="text-sm leading-6">{message}</p>
      <p className="text-sm leading-6 text-muted-foreground">이 화면에 돌아온 것만으로 결제 완료나 유료 이용권이 적용되지 않습니다. 가입 후 10일 무료 체험 · 이후 월 30,000원, 체험 종료 후 별도 동의가 필요합니다.</p>
      <Button asChild className="w-full"><Link to="/">견적잇으로 돌아가기</Link></Button>
    </div>
  </main>;
}