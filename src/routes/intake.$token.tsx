import { createFileRoute } from "@tanstack/react-router";
import { IntakePage } from "@/components/jimpick/IntakePage";

export const Route = createFileRoute("/intake/$token")({
  head: () => ({
    meta: [
      { title: "이사 사전정보 입력 | JIMPICK 짐픽" },
      { name: "description", content: "방문견적 전에 이사 날짜, 주소와 큰 가구·가전을 간단히 입력하는 고객 전용 보안 링크입니다." },
      { property: "og:title", content: "이사 사전정보 입력 | JIMPICK 짐픽" },
      { property: "og:description", content: "이사 날짜, 주소와 큰 가구·가전만 간단히 선택해 주세요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "color-scheme", content: "light only" },
    ],
  }),
  component: IntakeRoute,
});

function IntakeRoute() {
  const { token } = Route.useParams();
  return <IntakePage token={token} />;
}
