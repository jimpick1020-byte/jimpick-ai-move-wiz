import { createFileRoute } from "@tanstack/react-router";
import { VisitConfirmPage } from "@/components/jimpick/VisitConfirmPage";

export const Route = createFileRoute("/visit/$token")({
  head: () => ({
    meta: [
      { title: "방문견적 일정 확인 | JIMPICK 짐픽" },
      { name: "description", content: "이사업체 방문견적 날짜·시간·주소를 확인하는 고객 전용 링크입니다." },
      { property: "og:title", content: "방문견적 일정 확인 | JIMPICK 짐픽" },
      { property: "og:description", content: "방문 날짜와 시간을 확인하고 「확인했습니다」를 눌러 주세요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "color-scheme", content: "light only" },
    ],
  }),
  component: VisitRoute,
});

function VisitRoute() {
  const { token } = Route.useParams();
  return <VisitConfirmPage token={token} />;
}
