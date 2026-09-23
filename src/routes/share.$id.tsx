import { createFileRoute } from "@tanstack/react-router";
import { SharePage } from "@/components/jimpick/SharePage";
import { getSharePreview } from "@/lib/share-preview.functions";
import quoteImage from "@/assets/message-previews/quote.jpg.asset.json";
import depositImage from "@/assets/message-previews/deposit.jpg.asset.json";
import reminderImage from "@/assets/message-previews/reminder.jpg.asset.json";

type CardType = "quote" | "deposit" | "reminder";
const previews: Record<CardType, { title: string; description: string; image: string }> = {
  quote: { title: "JIMPICK 고객용 견적서", description: "고객님의 이사 견적서를 확인하세요.", image: quoteImage.url },
  deposit: { title: "JIMPICK 예약금 안내", description: "예약금과 예약 내용을 확인하세요.", image: depositImage.url },
  reminder: { title: "JIMPICK 이사 전날 안내", description: "내일 이사 일정과 준비사항을 확인하세요.", image: reminderImage.url },
};

export const Route = createFileRoute("/share/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    staff: typeof search.staff === "string" ? search.staff : undefined,
    t: typeof search.t === "string" ? search.t : undefined,
    // 이사 전날 안내 문자로 보낸 확인용 토큰
    rm: typeof search.rm === "string" ? search.rm : undefined,
    card: search.card === "deposit" || search.card === "reminder" ? search.card : undefined,
  }),
  loaderDeps: ({ search }) => ({ t: search.t, rm: search.rm, card: search.card, staff: search.staff }),
  loader: async ({ params, deps }) => {
    if (deps.staff || !deps.t || deps.t.length < 8 || deps.t.length > 80 || params.id.length > 120) {
      return { valid: false as const, card: "quote" as CardType, origin: "" };
    }
    const card = deps.card ?? (deps.rm ? "reminder" : "quote");
    try {
      const result = await getSharePreview({ data: {
        estimateId: params.id, token: deps.t, reminderToken: deps.rm, card,
      } });
      return { valid: result.valid, card, origin: "origin" in result ? result.origin : "" };
    } catch {
      return { valid: false as const, card, origin: "" };
    }
  },
  head: ({ loaderData, match }) => {
    const valid = loaderData?.valid === true;
    const preview = valid ? previews[loaderData.card] : null;
    // Do not put an invalid bearer token into OG metadata or a canonical URL.
    const origin = loaderData?.origin || (typeof window !== "undefined" ? window.location.origin : "");
    const href = valid && origin
      ? new URL(typeof window === "undefined" ? `${match.pathname}${match.searchStr}` : window.location.href, origin).href
      : undefined;
    const image = preview && origin && origin.startsWith("https://") ? new URL(preview.image, origin).href : undefined;
    const title = preview?.title ?? "JIMPICK 고객용 견적서";
    const description = preview?.description ?? "JIMPICK에서 전달드린 이사 견적서입니다.";
    return { meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: preview ? "summary_large_image" : "summary" },
      ...(href ? [{ property: "og:url", content: href }] : []),
      ...(image ? [{ property: "og:image", content: image }, { name: "twitter:image", content: image }] : []),
    ] };
  },
  component: SharePage,
});
