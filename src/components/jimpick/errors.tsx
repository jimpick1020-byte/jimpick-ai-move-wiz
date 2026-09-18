/**
 * 오류 관리 화면 — 내 업체에서 발생한 오류 기록만 보여 줍니다(서버에서 업체별로 분리).
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/jimpick";
import { MobileShell, TopBar, Card } from "@/components/jimpick/ui";
import { listAppErrors, resolveAppError, type ErrorLogRow } from "@/lib/error-log.functions";
import { withRetry } from "@/lib/retry";

const SCREEN_LABEL: Record<string, string> = {
  step1: "1단계 고객 정보",
  step2: "2단계 품목",
  step3: "3단계 작업 조건",
  step4: "4단계 인원·차량",
  step6: "견적 상세",
  result: "견적 결과",
  history: "견적 내역",
  customers: "고객 관리",
  settings: "설정",
  subscription: "구독 · 결제",
  home: "홈",
};

const RECOVERY_LABEL: Record<string, string> = {
  none: "복구 안 됨",
  retried: "자동 재시도 성공",
  restored: "저장 상태로 복구",
  manual: "직접 해결 표시",
};

const when = (v: string) =>
  new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });

export function ErrorLogScreen() {
  const { setScreen } = useApp();
  const [rows, setRows] = useState<ErrorLogRow[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    const r = await withRetry(() => listAppErrors());
    if (r.ok) setRows(r.data ?? []);
    else {
      setRows([]);
      setError(r.error ?? "오류 기록을 읽지 못했습니다");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onResolve = async (row: ErrorLogRow) => {
    setBusyId(row.id);
    const r = await withRetry(() => resolveAppError({ data: { id: row.id, recovery: "manual" } }));
    setBusyId(null);
    if (r.ok && r.data?.ok) {
      setRows((prev) =>
        prev
          ? prev.map((x) =>
              x.id === row.id
                ? { ...x, resolved: true, recovery: "manual", resolvedAt: new Date().toISOString() }
                : x,
            )
          : prev,
      );
    } else {
      setError(r.error ?? "해결 표시를 저장하지 못했습니다");
    }
  };

  const unresolved = rows?.filter((r) => !r.resolved).length ?? 0;

  return (
    <MobileShell>
      <TopBar title="오류 관리" onBack={() => setScreen("settings")} />
      <div className="flex-1 space-y-3 overflow-auto p-4 pb-24">
        <Card className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-[#25282D]">최근 오류 기록</div>
          <div
            className={`text-xs font-bold ${unresolved > 0 ? "text-[#D95C5C]" : "text-[#3E9B78]"}`}
          >
            {unresolved > 0 ? `해결되지 않은 오류 ${unresolved}건` : "해결되지 않은 오류 없음"}
          </div>
        </Card>

        {error && <Card className="text-xs text-[#D95C5C] break-keep">{error}</Card>}
        {rows === null && (
          <div className="py-10 text-center text-sm text-[#6B7280]">불러오는 중…</div>
        )}
        {rows?.length === 0 && !error && (
          <div className="py-10 text-center text-sm text-[#6B7280]">기록된 오류가 없습니다.</div>
        )}

        {rows?.map((r) => (
          <Card
            key={r.id}
            className={`space-y-2 ${r.resolved ? "" : "border border-[#FECACA] bg-[#FBEAEA]"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div
                  className={`text-[15px] font-bold ${r.resolved ? "text-[#25282D]" : "text-[#D95C5C]"}`}
                >
                  {SCREEN_LABEL[r.screen] ?? r.screen}
                </div>
                <div className="truncate text-xs font-bold text-[#3578C8]">
                  {r.companyName || "업체명 미입력"}
                </div>
                <div className="text-xs text-[#6B7280]">{when(r.occurredAt)}</div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  r.resolved ? "bg-[#E7F3EE] text-[#3E9B78]" : "bg-[#FBEAEA] text-[#D95C5C]"
                }`}
              >
                {r.resolved ? "해결됨" : "미해결"}
              </span>
            </div>
            <div className="rounded-xl bg-white px-2.5 py-2 text-xs leading-5 text-[#6B7280] break-all">
              {r.message}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
              <span>복구 결과: {RECOVERY_LABEL[r.recovery] ?? r.recovery}</span>
              <span>재시도 {r.attempts}회</span>
            </div>
            {!r.resolved && (
              <button
                type="button"
                onClick={() => void onResolve(r)}
                disabled={busyId === r.id}
                className="w-full rounded-xl bg-[#3578C8] py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {busyId === r.id ? "저장 중…" : "해결됨으로 표시"}
              </button>
            )}
          </Card>
        ))}
      </div>
    </MobileShell>
  );
}
