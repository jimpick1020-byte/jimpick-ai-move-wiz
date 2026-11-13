import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { getPayappSubscription } from "@/lib/payapp-live.functions";
import { getMyAccount } from "@/lib/subscription.functions";
import { recoverAuthSession } from "@/lib/auth-recovery";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/billing/payapp/return")({
  head: () => ({ meta: [
    { title: "페이앱 구독 결제 확인 — 견적잇" },
    { name: "description", content: "견적잇 페이앱 서버 확인 구독 결제 상태." },
    { property: "og:title", content: "페이앱 구독 결제 확인 — 견적잇" },
    { property: "og:description", content: "서버에서 확인한 견적잇 구독 결제 상태를 확인합니다." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: PayappReturn,
});

function PayappReturn() {
  const readSubscription = useServerFn(getPayappSubscription);
  const readAccount = useServerFn(getMyAccount);
  const [message, setMessage] = useState("서버에서 결제 확인 중…");
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const check = async () => {
      try {
        await recoverAuthSession(supabase.auth);
        const [result, account] = await Promise.all([readSubscription(), readAccount()]);
        if (!alive) return;
        const order = result.order;
        const sub = account.subscription;
        setMessage(order?.first_paid_at && sub?.payapp_order_id === order.id && sub?.plan === "pro" && sub.status === "active"
          ? `서버 결제 확인 완료 · 월 30,000원 · ${order.canceled_at ? "다음 자동청구 중단 · 이용기간 종료일" : "다음 결제 예정일"} ${new Date(sub.current_period_end).toLocaleDateString("ko-KR", {timeZone:"Asia/Seoul"})}`
          : order?.status === "pending" || order?.status === "creating" ? "결제 확인 중입니다. 아직 유료 구독으로 전환되지 않았습니다. 중복 결제를 시작하지 마세요."
          : order?.status === "canceled" || order?.status === "failed" ? "결제가 취소되었거나 승인되지 않았습니다. 남은 무료체험은 유지됩니다."
          : order?.status === "review" ? "결제 상태 확인이 필요합니다. 중복 결제를 시작하지 마세요."
          : "서버에서 확인된 구독 결제가 없습니다.");
        if ((order?.status === "pending" || order?.status === "creating") && attempts++ < 12) timer = setTimeout(() => void check(), 5000);
      } catch {
        if (alive) setMessage("결제 상태를 확인하지 못했습니다. 견적잇으로 돌아가 로그인 후 다시 확인해 주세요. 확인 전에는 중복 결제하지 마세요.");
      }
    };
    void check();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [readSubscription, readAccount]);
  return <main className="min-h-dvh bg-background px-5 py-16 text-foreground">
    <div className="mx-auto max-w-md space-y-5">
      <p className="font-bold text-primary">견적잇</p>
      <h1 className="text-2xl font-bold">페이앱 구독 결제 확인</h1>
      <p role="status" className="text-sm leading-6">{message}</p>
      <p className="text-sm leading-6 text-muted-foreground">이 화면에 돌아온 것만으로 결제 완료나 유료 이용권이 적용되지 않습니다. 가입 후 10일 무료 체험 · 월 30,000원. 체험 중 즉시 구독 또는 체험 종료 후 구독 모두 별도 동의와 서버 결제 성공 확인이 필요합니다.</p>
      <Button asChild className="w-full"><Link to="/">견적잇으로 돌아가기</Link></Button>
    </div>
  </main>;
}