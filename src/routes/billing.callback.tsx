/**
 * 카드 등록을 마치고 토스에서 돌아오는 화면.
 *
 * 주소에 담겨 오는 authKey·customerKey 로 서버에서 자동결제 카드를 등록하고
 * 첫 달 요금을 실제로 결제합니다. 토스가 승인한 경우에만 성공으로 보여 줍니다.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/billing/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "카드 등록 확인 — 견적잇" },
      { name: "description", content: "견적잇 업체 구독 자동결제 카드 등록 결과를 확인합니다." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "카드 등록 확인 — 견적잇" },
      { property: "og:description", content: "견적잇 업체 구독 자동결제 카드 등록 결과입니다." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingCallbackPage,
});

function BillingCallbackPage() {
  return <main className="min-h-dvh bg-background px-5 py-16 text-foreground">
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-2xl font-bold">구독 결제 안내</h1>
      <p>토스 카드 등록 경로는 종료되었습니다. 이 주소를 열어도 카드 등록이나 청구는 실행되지 않습니다.</p>
      <Button asChild className="w-full"><Link to="/billing/payapp/return">페이앱 결제 상태 확인</Link></Button>
      <Button asChild variant="outline" className="w-full"><Link to="/">견적잇으로 돌아가기</Link></Button>
    </div>
  </main>;
}
