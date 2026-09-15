/**
 * 카드 등록을 마치고 토스에서 돌아오는 화면.
 *
 * 주소에 담겨 오는 authKey·customerKey 로 서버에서 자동결제 카드를 등록하고
 * 첫 달 요금을 실제로 결제합니다. 토스가 승인한 경우에만 성공으로 보여 줍니다.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { authHeader } from "@/lib/auth";
import { registerTossBilling } from "@/lib/toss.functions";

export const Route = createFileRoute("/billing/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "카드 등록 확인 — JIMPICK" },
      { name: "description", content: "JIMPICK 업체 구독 자동결제 카드 등록 결과를 확인합니다." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "카드 등록 확인 — JIMPICK" },
      { property: "og:description", content: "JIMPICK 업체 구독 자동결제 카드 등록 결과입니다." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingCallbackPage,
});

const won = (n: number) => `${Number(n || 0).toLocaleString("ko-KR")}원`;

function BillingCallbackPage() {
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("결제를 확인하고 있습니다…");
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const q = new URLSearchParams(window.location.search);
      const authKey = q.get("authKey");
      const customerKey = q.get("customerKey");
      const failMessage = q.get("message");

      if (!authKey || !customerKey) {
        if (!alive) return;
        setState("error");
        setMessage(failMessage?.trim() || "카드 등록이 취소되었습니다.");
        return;
      }

      const headers = await authHeader();
      if (!headers) {
        if (!alive) return;
        setState("error");
        setMessage("로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.");
        return;
      }

      try {
        const r = await registerTossBilling({ data: { authKey, customerKey }, headers });
        if (!alive) return;
        if (r.ok) {
          setState("done");
          setAmount(r.amount ?? 0);
          setMessage(
            r.duplicate
              ? "이미 결제가 완료되어 구독이 이용 중입니다. 중복 결제되지 않았습니다."
              : "결제가 완료되어 업체 구독이 시작되었습니다.",
          );
        } else {
          setState("error");
          setMessage(r.error ?? "결제에 실패했습니다.");
        }

      } catch (e) {
        if (!alive) return;
        setState("error");
        setMessage(e instanceof Error ? e.message : "결제에 실패했습니다.");
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-[#F7F9FC] flex items-center justify-center p-5">
      <div className="w-full max-w-[420px] rounded-3xl bg-white p-6 shadow-[0_10px_30px_rgba(7,81,216,0.08)]">
        <div className="text-[13px] font-bold tracking-wide text-[#0751D8]">JIMPICK</div>
        <h1 className="mt-2 text-[19px] font-extrabold text-[#111827]">
          {state === "loading" ? "결제 확인 중" : state === "done" ? "구독이 시작되었습니다" : "결제하지 못했습니다"}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#4B5563]">{message}</p>
        {state === "done" && amount > 0 && (
          <div className="mt-3 rounded-2xl bg-[#EDF2FB] p-3 text-[14px] font-bold text-[#0751D8]">
            결제 금액 {won(amount)} · 매월 자동 결제
          </div>
        )}
        <Link
          to="/"
          className="mt-5 block w-full rounded-2xl py-3 text-center text-[15px] font-bold text-white"
          style={{ background: "linear-gradient(180deg, #4A94FF 0%, #0751D8 100%)" }}
        >
          앱으로 돌아가기
        </Link>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
