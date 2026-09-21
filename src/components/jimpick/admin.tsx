/**
 * 업체 계정 관리 — JIMPICK 서비스 최고관리자 전용 화면.
 *
 * 화면에서 메뉴를 숨기는 것과 별개로, 목록을 읽는 서버 기능이 최고관리자만 허용합니다.
 * 관리자가 아니면 서버가 거부하고 이 화면은 아무 정보도 보여 주지 않습니다.
 */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/jimpick";
import { MobileShell, TopBar, Card } from "@/components/jimpick/ui";
import {
  listCompanyAccounts,
  deleteCompanyAccount,
  type CompanyAccount,
} from "@/lib/admin.functions";
import {
  updateExperimentalFeatures,
  type ExperimentalFeatures,
} from "@/lib/experimental-features.functions";
import {
  refreshExperimentalFeatures,
  useExperimentalFeatures,
} from "@/lib/use-experimental-features";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  trialing: "무료체험 중",
  active: "구독 이용 중",
  past_due: "결제 실패 (연체)",
  canceled: "구독 해지",
  expired: "체험 종료",
};

const STATUS_STYLE: Record<string, string> = {
  trialing: "bg-[#EFF6FF] text-[#25282D]",
  active: "bg-[#E7F3EE] text-[#3E9B78]",
  past_due: "bg-[#FEF3C7] text-[#92400E]",
  canceled: "bg-[#F3F4F6] text-[#6B7280]",
  expired: "bg-[#FBEAEA] text-[#D95C5C]",
};

const day = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";

/** 최근 3일 안에 가입한 업체는 "신규" 표시를 붙입니다 */
const NEW_SIGNUP_MS = 3 * 24 * 3600_000;
const isNewSignup = (v: string | null) =>
  v !== null && Date.now() - new Date(v).getTime() < NEW_SIGNUP_MS;

const EXPERIMENT_LABELS: { key: keyof Omit<ExperimentalFeatures, "isSuperAdmin">; label: string }[] = [
  { key: "voiceItemInput", label: "음성 품목입력 시험 기능" },
];

export function ExperimentalFeatureSettings() {
  const { features, loaded } = useExperimentalFeatures();
  const [saving, setSaving] = useState(false);
  if (!loaded || !features.isSuperAdmin) return null;

  const toggle = async (key: keyof Omit<ExperimentalFeatures, "isSuperAdmin">) => {
    if (saving) return;
    setSaving(true);
    try {
      await updateExperimentalFeatures({
        data: {
          voiceItemInput: key === "voiceItemInput" ? !features.voiceItemInput : features.voiceItemInput,
        },
      });
      await refreshExperimentalFeatures();
      toast.success("시험 기능 설정을 저장했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "설정을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div>
        <div className="font-bold">최고관리자 시험 기능</div>
        <div className="mt-1 text-xs text-[#6B7280]">모두 기본 OFF이며 일반 업체 계정에는 표시되지 않습니다.</div>
      </div>
      {EXPERIMENT_LABELS.map(({ key, label }) => {
        const on = features[key];
        return (
          <button
            key={key}
            type="button"
            role="switch"
            aria-checked={on}
            disabled={saving}
            onClick={() => void toggle(key)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 text-left disabled:opacity-60"
          >
            <span className="text-sm font-bold text-[#25282D]">{label}</span>
            <span className={`relative h-7 w-12 shrink-0 rounded-full ${on ? "bg-[#3578C8]" : "bg-[#D1D5DB]"}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
            </span>
          </button>
        );
      })}
    </Card>
  );
}

export function AdminAccountsScreen() {
  const { setScreen } = useApp();
  const [rows, setRows] = useState<CompanyAccount[] | null>(null);
  const [error, setError] = useState("");
  // 삭제 확인을 기다리는 업체(한 번 더 물어보기)와 삭제 진행 중인 업체
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  /** 구독으로 이용 중인 업체는 삭제 버튼을 보여주지 않습니다 */
  const canDelete = (r: CompanyAccount) =>
    r.role !== "super_admin" &&
    r.subscriptionStatus !== "active" &&
    r.subscriptionStatus !== "past_due";

  const onDelete = async (r: CompanyAccount) => {
    setDeletingId(r.userId);
    setDeleteError("");
    try {
      await deleteCompanyAccount({ data: { userId: r.userId } });
      setRows((prev) => (prev ? prev.filter((x) => x.userId !== r.userId) : prev));
      setConfirmingId(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "삭제하지 못했습니다");
    } finally {
      setDeletingId(null);
    }
  };

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
          <Card className="text-sm leading-6 text-[#D95C5C] break-keep">
            관리자만 볼 수 있는 화면입니다.
            <div className="mt-1 text-xs text-[#6B7280] break-all">{error}</div>
          </Card>
        )}
        {deleteError && <Card className="text-xs text-[#D95C5C] break-keep">{deleteError}</Card>}
        {!error && <ReminderBoard />}
        {!error && rows === null && (
          <div className="py-10 text-center text-sm text-[#6B7280]">불러오는 중…</div>
        )}
        {rows && rows.length > 0 && (
          <Card className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold text-[#25282D]">최근 가입 업체</div>
            <div className="text-xs text-[#6B7280]">
              3일 안에 가입한 업체 {rows.filter((r) => isNewSignup(r.joinedAt)).length}곳 · 최근
              가입 순으로 표시
            </div>
          </Card>
        )}
        {rows?.length === 0 && (
          <div className="py-10 text-center text-sm text-[#6B7280]">
            등록된 업체 계정이 없습니다.
          </div>
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
                    <span className="shrink-0 rounded-full bg-[#E7F3EE] px-1.5 py-0.5 text-[10px] font-bold text-[#3E9B78]">
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
                  STATUS_STYLE[r.subscriptionStatus] ?? "bg-[#F3F4F6] text-[#6B7280]"
                }`}
              >
                {STATUS_LABEL[r.subscriptionStatus] ?? r.subscriptionStatus}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-xs text-[#6B7280]">
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
              <div className="rounded-xl bg-[#FBEAEA] px-2.5 py-2 text-[11px] text-[#D95C5C]">
                해지 예약됨 · {day(r.periodEnd)} 이후 결제되지 않습니다
              </div>
            )}
            {canDelete(r) && confirmingId !== r.userId && (
              <button
                type="button"
                onClick={() => {
                  setConfirmingId(r.userId);
                  setDeleteError("");
                }}
                className="w-full rounded-xl border border-[#FECACA] py-2 text-xs font-bold text-[#D95C5C]"
              >
                업체 삭제
              </button>
            )}
            {canDelete(r) && confirmingId === r.userId && (
              <div className="space-y-2 rounded-xl bg-[#FBEAEA] px-2.5 py-2">
                <p className="text-[11px] leading-5 text-[#D95C5C] break-keep">
                  정말 삭제할까요? {r.companyName || "이 업체"}의 로그인 계정과 서버에 저장된
                  데이터가 모두 삭제되며 되돌릴 수 없습니다.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    disabled={deletingId === r.userId}
                    className="flex-1 rounded-xl bg-white py-2 text-xs font-bold text-[#6B7280]"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(r)}
                    disabled={deletingId === r.userId}
                    className="flex-1 rounded-xl bg-[#D95C5C] py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {deletingId === r.userId ? "삭제 중…" : "삭제합니다"}
                  </button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </MobileShell>
  );
}
