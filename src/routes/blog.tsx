import { createFileRoute } from "@tanstack/react-router";
import { BlogApp } from "@/components/blog/BlogApp";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "AI 부동산 블로그 자동 작성" },
      {
        name: "description",
        content: "사진 한 장으로 끝내는 스마트 홍보 시스템. 사진 분석부터 네이버 블로그 홍보글 작성까지 AI가 대신합니다.",
      },
      { property: "og:title", content: "AI 부동산 블로그 자동 작성" },
      { property: "og:description", content: "사진 찍고 정보만 입력하세요. 매물 분석부터 블로그 홍보글까지 AI가 대신합니다." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: BlogApp,
});
