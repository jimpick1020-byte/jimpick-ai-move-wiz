/**
 * 업체 계정 관리 — JIMPICK 서비스 최고관리자 전용 화면.
 *
 * 화면에서 메뉴를 숨기는 것과 별개로, 목록을 읽는 서버 기능이 최고관리자만 허용합니다.
 * 관리자가 아니면 서버가 거부하고 이 화면은 아무 정보도 보여 주지 않습니다.
 */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/jimpick";
import { MobileShell, TopBar, Card } from "@/components/jimpick/ui";
import { listCompanyAccounts, type CompanyAccount } from "@/lib/admin.functions";

const STATUS_LABEL: Record<string, string> = {
  trialing: "무료체험 중",
  active: "구독 이용 중",
  past_due: "결제 실패 (연체)",
  canceled: "구독 해지",
  expired: "체험 종료",
};

const STATUS_STYLE: Record<string, string> = {
  trialing: "bg-[#EFF6FF] text-[#0751D8]",
  active: "bg-[#DCFCE7] text-[#166534]",
  past_due: "bg-[#FEF3C7] text-[#92400E]",
  canceled: "bg-[#F3F4F6] text-[#4B5563]",
  expired: "bg-[#FEF2F2] text-[#B42318]",
};

const day = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";

/** 최근 3일 안에 가입한 업체는 "신규" 표시를 붙입니다 */
const NEW_SIGNUP_MS = 3 * 24 * 3600_000;
const isNewSignup = (v: string | null) =>
  v !== null && Date.now() - new Date(v).getTime() < NEW_SIGNUP_MS;

export function AdminAccountsScreen() {
  const { setScreen } = useApp();
  const [rows, setRows] = useState<CompanyAccount[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const list = await listCompanyAccounts();
        if (alive) setRows(list);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "목록을 읽지 못했습니다");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <MobileShell>
      <TopBar title="업체 계정 관리" onBack={() => setScreen("home")} />
      <div className="flex-1 space-y-3 overflow-auto p-4 pb-24">
        {error && (
          <Card className="text-sm leading-6 text-[#B42318] break-keep">
            관리자만 볼 수 있는 화면입니다.
            <div className="mt-1 text-xs text-[#6B7280] break-all">{error}</div>
          </Card>
        )}
        {!error && rows === null && (
          <div className="py-10 text-center text-sm text-[#6B7280]">불러오는 중…</div>
        )}
        {rows && rows.length > 0 && (
          <Card className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold text-[#111827]">최근 가입 업체</div>
            <div className="text-xs text-[#6B7280]">
              3일 안에 가입한 업체 {rows.filter((r) => isNewSignup(r.joinedAt)).length}곳 · 최근 가입 순으로 표시
            </div>
          </Card>
        )}
        {rows?.length === 0 && (
          <div className="py-10 text-center text-sm text-[#6B7280]">등록된 업체 계정이 없습니다.</div>
        )}
        {rows?.map((r) => (
          <Card key={r.userId} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-bold">
                    {r.companyName || "업체명 미입력"}
                  </span>
                  {isNewSignup(r.joinedAt) && (
                    <span className="shrink-0 rounded-full bg-[#DCFCE7] px-1.5 py-0.5 text-[10px] font-bold text-[#166534]">
                      신규
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-[#6B7280]">
                  {r.ownerName || "대표자 미입력"}
                  {r.email ? ` · ${r.email}` : ""}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  STATUS_STYLE[r.subscriptionStatus] ?? "bg-[#F3F4F6] text-[#4B5563]"
                }`}
              >
                {STATUS_LABEL[r.subscriptionStatus] ?? r.subscriptionStatus}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-xs text-[#374151]">
              <div className="text-[#6B7280]">가입일</div>
              <div className="text-right">{day(r.joinedAt)}</div>
              <div className="text-[#6B7280]">체험 시작</div>
              <div className="text-right">{day(r.trialStartedAt)}</div>
              <div className="text-[#6B7280]">체험 종료</div>
              <div className="text-right">{day(r.trialEndsAt)}</div>
              <div className="text-[#6B7280]">이용기간 종료</div>
              <div className="text-right">{day(r.periodEnd)}</div>
              <div className="text-[#6B7280]">결제 상태</div>
              <div className="text-right">
                {r.paymentStatus === "paid"
                  ? `결제 완료 (${day(r.lastPaidAt)})`
                  : r.paymentStatus === "failed"
                    ? "결제 실패"
                    : "결제 없음"}
              </div>
              <div className="text-[#6B7280]">문자 사용량</div>
              <div className="text-right">
                {r.smsSent}건 발송 / 전체 {r.smsTotal}건
              </div>
              <div className="text-[#6B7280]">계정 상태</div>
              <div className="text-right">{r.active ? "사용 중" : "정지"}</div>
              <div className="text-[#6B7280]">권한</div>
              <div className="text-right">
                {r.role === "super_admin" ? "서비스 관리자" : "구독 업체"}
              </div>
            </div>
            {r.cancelAtPeriodEnd && (
              <div className="rounded-xl bg-[#FEF2F2] px-2.5 py-2 text-[11px] text-[#B42318]">
                해지 예약됨 · {day(r.periodEnd)} 이후 결제되지 않습니다
              </div>
            )}
          </Card>
        ))}
      </div>
    </MobileShell>
  );
}
