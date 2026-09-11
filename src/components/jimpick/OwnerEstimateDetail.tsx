/**
 * 사장님(관리자) 전용 — 예약확정 알림 문자의 「관리자 링크」로 여는 고객 한 건 상세.
 *
 * 보안
 *  - 로그인한 본인 견적만 열립니다. 서버가 user_id 로 거르고 RLS 도 함께 막으므로,
 *    주소의 견적번호를 남의 것으로 바꿔도 상세가 열리지 않습니다.
 *  - 주소에 토큰을 넣지 않습니다(관리자 로그인·권한으로만 확인). 문자 API·서비스 키는
 *    프런트엔드에 전혀 내려오지 않습니다.
 *
 * 화면은 고객 화면과 같은 EstimateSheet 부품을 그대로 재사용합니다(중복 구현 없음).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { ShieldCheck, Lock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getOwnerEstimateDetail, type OwnerEstimateDetail as Detail } from "@/lib/terms.functions";
import { won, type Estimate } from "@/lib/jimpick";
import { EstimateSheet, type SheetRoom } from "./EstimateSheet";

function shell(children: React.ReactNode) {
  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-white">
      <header className="flex h-[88px] w-full items-center justify-center bg-[#0864DC]">
        <span className="text-[30px] font-black tracking-tight text-white">JIMPICK</span>
        <span className="ml-2 text-[16px] font-bold text-white/95">관리자</span>
      </header>
      <div className="mx-auto w-full max-w-[430px] px-4 pb-12">{children}</div>
    </div>
  );
}

export function OwnerEstimateDetail() {
  const { id } = useParams({ from: "/manage/$id" });
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);

  const load = useCallback(
    async () => {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setAuthed(false);
        setLoading(false);
        return;
      }
      setAuthed(true);
      try {
        const r = await getOwnerEstimateDetail({ data: { estimateId: id } });
        setDetail(r);
      } catch {
        setDetail({ ok: false, error: "견적서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." });
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /** 보낼 때 담아 둔 견적서 원본을 고객 화면과 똑같이 복원합니다 */
  const sheet = useMemo(() => {
    const raw = detail?.ok ? detail.sheetSnapshot : null;
    if (!raw) return null;
    try {
      const v = JSON.parse(raw) as {
        draft?: Estimate;
        rooms?: SheetRoom[];
        parts?: { label: string; amount: number }[];
        total?: number;
      };
      if (!v?.draft || !Array.isArray(v.rooms)) return null;
      return {
        draft: v.draft,
        rooms: v.rooms,
        parts: Array.isArray(v.parts) ? v.parts : [],
        total: typeof v.total === "number" ? v.total : (detail?.total ?? 0),
      };
    } catch {
      return null;
    }
  }, [detail]);

  if (loading) {
    return shell(
      <div className="py-24 text-center text-[16px] font-semibold text-[#6B7280]">
        불러오는 중...
      </div>,
    );
  }

  if (authed === false) {
    return shell(
      <div className="mt-10 rounded-[14px] border border-[#DCE8FA] bg-white p-6 text-center">
        <Lock className="mx-auto h-8 w-8 text-[#0864DC]" />
        <div className="mt-3 text-[18px] font-black text-[#111827]">관리자 로그인이 필요합니다</div>
        <div className="mt-2 text-[15px] text-[#6B7280]">
          이 견적서는 담당 사장님만 볼 수 있습니다. 로그인 후 이 링크를 다시 열어 주세요.
        </div>
        <a
          href={`/?next=${encodeURIComponent(`/manage/${id}`)}`}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#0864DC] py-3.5 text-[17px] font-black text-white"
        >
          로그인하러 가기
        </a>
      </div>,
    );
  }

  if (!detail?.ok) {
    return shell(
      <div className="mt-10 rounded-[14px] border border-[#FECACA] bg-[#FFF1F2] p-6 text-center">
        <div className="text-[17px] font-black text-[#B42318]">
          {detail?.error ?? "이 견적서를 볼 권한이 없거나 찾을 수 없습니다."}
        </div>
        <button
          onClick={() => void load()}
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#0864DC] bg-white px-4 py-2.5 text-[15px] font-black text-[#0864DC]"
        >
          <RefreshCw className="h-4 w-4" /> 다시 시도
        </button>
      </div>,
    );
  }

  const total = detail.total ?? 0;
  const deposit = detail.depositPaid ?? 0;
  const balance = detail.balanceDue ?? Math.max(0, total - deposit);
  const confirmed = Boolean(detail.acceptedAt);

  return shell(
    <div className="pt-4">
      {/* 예약 확정 상태 */}
      <div
        className={`rounded-[14px] border p-4 ${
          confirmed ? "border-[#BFE7CE] bg-[#F1FBF4]" : "border-[#FDE68A] bg-[#FFFBEB]"
        }`}
      >
        <div
          className={`inline-flex items-center gap-2 text-[17px] font-black ${
            confirmed ? "text-[#12A150]" : "text-[#B45309]"
          }`}
        >
          <ShieldCheck className="h-5 w-5" />
          {confirmed ? "고객이 예약을 확정했습니다" : "아직 동의하지 않았습니다"}
        </div>
        <div className="mt-2 space-y-1 text-[15px]">
          <div className="flex justify-between">
            <span className="text-[#6B7280]">고객명</span>
            <span className="font-bold text-[#111827]">{detail.customerName || "-"}</span>
          </div>
          {detail.contactPhone && (
            <div className="flex justify-between">
              <span className="text-[#6B7280]">연락처</span>
              <a
                href={`tel:${detail.contactPhone.replace(/-/g, "")}`}
                className="font-bold text-[#0864DC] underline"
              >
                {detail.contactPhone}
              </a>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[#6B7280]">견적번호</span>
            <span className="font-bold text-[#111827]">{detail.sheetNo || detail.estimateId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6B7280]">견적서 차수</span>
            <span className="font-bold text-[#111827]">{detail.sheetVersion ?? 1}차</span>
          </div>
          {confirmed && detail.acceptedAt && (
            <div className="flex justify-between">
              <span className="text-[#6B7280]">동의 일시</span>
              <span className="font-bold text-[#111827]">
                {new Date(detail.acceptedAt).toLocaleString("ko-KR")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 예약금 · 잔금 */}
      {total > 0 && (
        <div className="mt-3 rounded-[14px] border border-[#DCE8FA] bg-white p-4">
          <div className="flex items-center justify-between text-[16px]">
            <span className="text-[#4B5563]">총 견적금액</span>
            <span className="font-bold tabular-nums">{won(total)}</span>
          </div>
          <div className="flex items-center justify-between text-[16px]">
            <span className="text-[#4B5563]">
              예약금{deposit > 0 ? " (입금완료)" : ""}
            </span>
            <span
              className={`font-bold tabular-nums ${deposit > 0 ? "text-[#12A150]" : "text-[#111827]"}`}
            >
              {won(deposit)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-[#EDF0F5] pt-2">
            <span className="text-[17px] font-black">잔금</span>
            <span className="text-[20px] font-black tabular-nums text-[#0864DC]">{won(balance)}</span>
          </div>
        </div>
      )}

      {/* 견적서 상세 — 고객 화면과 동일한 부품 재사용 */}
      {sheet && (
        <div className="mt-3 overflow-hidden rounded-[14px]">
          <EstimateSheet
            draft={sheet.draft}
            rooms={sheet.rooms}
            parts={sheet.parts}
            total={sheet.total}
            paidDeposit={deposit}
            companyPhone={detail.contactPhone ?? undefined}
            acceptedAt={detail.acceptedAt ?? null}
            acceptedSheetVersion={detail.acceptedSheetVersion ?? null}
            acceptedTermsVersion={detail.acceptedTermsVersion ?? null}
          />
        </div>
      )}
    </div>,
  );
}
