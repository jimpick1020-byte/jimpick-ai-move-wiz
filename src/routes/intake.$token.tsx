import { createFileRoute } from "@tanstack/react-router";
import { IntakePage } from "@/components/jimpick/IntakePage";
import preview from "@/assets/message-previews/intake-preview-v2.webp.asset.json";
import { publicUrl } from "@/lib/app-url";

export const Route = createFileRoute("/intake/$token")({
  head: () => ({
    meta: [
      { title: "이사 사전정보 입력 | JIMPICK 짐픽" },
      { name: "description", content: "방문견적 전에 이사 날짜, 주소와 큰 가구·가전을 간단히 입력하는 고객 전용 보안 링크입니다." },
      { property: "og:title", content: "이사 사전정보 입력" },
      { property: "og:description", content: "방문 전 이사 날짜, 주소, 작업 조건, 평수를 입력해 주세요." },
      { property: "og:image", content: publicUrl(preview.url) },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: publicUrl(preview.url) },
      { name: "twitter:title", content: "이사 사전정보 입력" },
      { name: "twitter:description", content: "방문 전 이사 날짜, 주소, 작업 조건, 평수를 입력해 주세요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
