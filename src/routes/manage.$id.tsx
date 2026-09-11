import { createFileRoute } from "@tanstack/react-router";
import { OwnerEstimateDetail } from "@/components/jimpick/OwnerEstimateDetail";

export const Route = createFileRoute("/manage/$id")({
  head: () => ({
    meta: [
      { title: "JIMPICK 관리자 — 고객 견적 상세" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerEstimateDetail,
});
