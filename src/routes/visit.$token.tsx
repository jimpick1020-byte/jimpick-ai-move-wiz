import { createFileRoute } from "@tanstack/react-router";
import { VisitConfirmPage } from "@/components/jimpick/VisitConfirmPage";
import preview from "@/assets/message-previews/visit-preview-v2.webp.asset.json";
import { publicUrl } from "@/lib/app-url";

export const Route = createFileRoute("/visit/$token")({
  head: () => ({
    meta: [
      { title: "방문견적 일정 확인 | 견적잇" },
      { name: "description", content: "방문 날짜와 시간을 확인해 주세요." },
      { property: "og:title", content: "방문견적 일정 확인" },
      { property: "og:description", content: "방문 날짜와 시간을 확인해 주세요." },
      { property: "og:image", content: publicUrl(preview.url) },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: publicUrl(preview.url) },
      { name: "twitter:title", content: "방문견적 일정 확인" },
      { name: "twitter:description", content: "방문 날짜와 시간을 확인해 주세요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
