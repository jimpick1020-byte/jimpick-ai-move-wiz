/**
 * 이사 전날 안내 문자 현황판.
 *
 * 최고관리자는 모든 업체, 일반 사장님은 자기 업체 기록만 보입니다.
 * 저장된 실제 발송 결과만 보여 주고, 여기서 새로 보내지는 않습니다.
 */
import { useCallback, useEffect, useState } from "react";
import { Card } from "./ui";
import {
  listReminderDashboard,
  REMINDER_STATUS_LABEL,
  type MoveReminderRow,
} from "@/lib/reminder.functions";

type Filter = "all" | "today" | "processing" | "delivered" | "viewed" | "failed" | "unknown";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "today", label: "오늘 발송" },
  { key: "processing", label: "처리 중" },
  { key: "delivered", label: "전달 완료" },
  { key: "viewed", label: "고객 확인" },
  { key: "failed", label: "실패" },
  { key: "unknown", label: "확인 필요" },
];

const COLOR: Record<string, string> = {
  delivered: "text-[#3E9B78]",
  accepted: "text-[#2F6FED]",
  success: "text-[#2F6FED]",
  failed: "text-[#D95C5C]",
  unknown: "text-[#B45309]",
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "";

export function ReminderBoard() {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<MoveReminderRow[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [runs, setRuns] = useState<
    { job: string; ranAt: string; picked: number; sent: number; failed: number; note: string | null }[]
  >([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await listReminderDashboard({ data: { filter, search: search.trim() || undefined } });
      setRows(r.rows);
      setIsAdmin(r.isAdmin);
      setRuns(r.lastRuns);
      setError(r.ok ? "" : "현황을 읽지 못했습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "현황을 읽지 못했습니다.");
      setRows([]);
    }
  }, [filter, search]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <Card className="space-y-3">
      <div className="text-sm font-bold text-[#25282D]">이사 전날 안내 문자 현황</div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === f.key ? "bg-[#25282D] text-white" : "bg-[#F3F4F6] text-[#4B5563]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="고객 이름 또는 번호 뒤 4자리"
        className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
      />

      {error && <div className="text-xs text-[#D95C5C] break-keep">{error}</div>}
      {rows === null && <div className="py-6 text-center text-sm text-[#6B7280]">불러오는 중…</div>}
      {rows?.length === 0 && (
        <div className="py-6 text-center text-sm text-[#6B7280]">해당하는 기록이 없습니다.</div>
      )}

      <div className="space-y-2">
        {rows?.map((r) => (
          <div key={r.id} className="rounded-xl bg-[#F9FAFB] p-2.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#25282D] break-words">
                  {r.customerName || "고객"} · 이사일 {r.moveDate}
                </div>
                {isAdmin && r.companyName && (
                  <div className="text-[#6B7280] break-words">업체 {r.companyName}</div>
                )}
              </div>
              <div className={`text-xs font-bold ${COLOR[r.status] ?? "text-[#25282D]"}`}>
                {REMINDER_STATUS_LABEL[r.status] ?? r.status}
              </div>
            </div>
            <div className="mt-1 text-[#6B7280] break-words">발송 예정 {when(r.scheduledAt)}</div>
            {r.toMasked && <div className="text-[#6B7280]">받는 번호 {r.toMasked}</div>}
            {r.acceptedAt && <div className="text-[#6B7280]">접수 {when(r.acceptedAt)}</div>}
            {r.deliveredAt && <div className="text-[#3E9B78]">전달 {when(r.deliveredAt)}</div>}
            {r.customerViewedAt && (
              <div className="text-[#3E9B78]">
                고객 확인 {when(r.customerViewedAt)}
                {r.viewCount > 1 ? ` · ${r.viewCount}회` : ""}
              </div>
            )}
            {r.errorReason && <div className="mt-1 text-[#D95C5C] break-words">{r.errorReason}</div>}
            {r.contractDeleted && <div className="text-[#6B7280]">삭제된 계약의 보관 기록</div>}
          </div>
        ))}
      </div>

      {isAdmin && runs.length > 0 && (
        <div className="rounded-xl border border-[#E5E7EB] p-2.5 text-xs text-[#6B7280]">
          <div className="font-semibold text-[#25282D]">자동 작업 실행 기록</div>
          {runs.map((r, i) => (
            <div key={`${r.job}-${i}`} className="mt-1 break-words">
              {when(r.ranAt)} · {r.job} · 대상 {r.picked} · 발송 {r.sent} · 실패 {r.failed}
              {r.note ? ` · ${r.note}` : ""}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
