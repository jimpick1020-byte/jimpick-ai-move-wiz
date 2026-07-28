import { createFileRoute } from "@tanstack/react-router";
import { SharePage } from "@/components/jimpick/SharePage";

export const Route = createFileRoute("/share/$id")({
  head: () => ({
    meta: [
      { title: "JIMPICK 고객용 견적서" },
      { name: "description", content: "JIMPICK에서 전달드린 이사 견적서입니다." },
      { property: "og:title", content: "JIMPICK 고객용 견적서" },
      { property: "og:description", content: "AI 이사 견적 상세 내역을 확인하세요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SharePage,
});
