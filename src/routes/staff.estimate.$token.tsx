import { createFileRoute } from "@tanstack/react-router";
import { StaffSheet } from "@/components/jimpick/StaffSheet";

export const Route = createFileRoute("/staff/estimate/$token")({
  head: () => ({
    meta: [
      { title: "JIMPICK 직원용 작업 지시서" },
      {
        name: "description",
        content: "짐픽 직원용 이사 작업 지시서 — 현장 정보만 담긴 보안 링크입니다.",
      },
      { property: "og:title", content: "JIMPICK 직원용 작업 지시서" },
      { property: "og:description", content: "현장 작업에 필요한 이사 정보를 확인하세요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: StaffSheet,
});
