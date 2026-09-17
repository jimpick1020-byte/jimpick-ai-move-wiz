/**
 * 이사 전날 안내 문자 상태 칸 (사장님용).
 *
 * 예약이 확정되면 이사 전날 18시(한국시간)에 서버가 스스로 보냅니다.
 * 여기서는 실제 저장된 상태만 보여 주고, 실패한 건만 다시 보내도록 되돌립니다.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  listMoveReminders,
  retryMoveReminder,
  REMINDER_STATUS_LABEL,
  type MoveReminderRow,
} from "@/lib/reminder.functions";

const COLOR: Record<string, string> = {
  scheduled: "text-[#25282D]",
  sending: "text-[#B45309]",
  success: "text-[#3E9B78]",
  failed: "text-[#D95C5C]",
  canceled: "text-[#6B7280]",
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "";

export function ReminderPanel({ estimateId }: { estimateId: string }) {
  const [rows, setRows] = useState<MoveReminderRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await listMoveReminders({ data: { estimateId } });
      setRows(r.rows);
    } catch {
      /* 못 읽어도 다른 화면은 그대로 씁니다 */
    } finally {
      setLoaded(true);
    }
  }, [estimateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await retryMoveReminder({ data: { id } });
      if (r.ok) {
        toast.success("다시 발송하도록 예약했습니다");
        await load();
      } else {
        toast.error("다시 발송할 수 없습니다", { description: r.error ?? "" });
      }
    } catch (e) {
      toast.error("다시 발송할 수 없습니다", { description: e instanceof Error ? e.message : "" });
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="mt-3 rounded-2xl border border-[#E5E7EB] p-3">
      <div className="text-sm font-bold text-[#25282D]">이사 전날 안내 문자</div>
      {rows.length === 0 ? (
        <div className="mt-1 text-xs text-[#6B7280]">
          예약이 확정되면 이사 전날 오후 6시에 보낼 안내 문자가 자동으로 예약됩니다.
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl bg-[#F9FAFB] p-2.5 text-xs">
              <div className={`text-sm font-bold ${COLOR[r.status] ?? "text-[#25282D]"}`}>
                {REMINDER_STATUS_LABEL[r.status] ?? r.status}
              </div>
              <div className="mt-0.5 text-[#6B7280] break-words">
                이사일 {r.moveDate}
                {r.startTime ? ` · ${r.startTime}` : ""}
              </div>
              <div className="text-[#6B7280] break-words">발송 예정 {when(r.scheduledAt)}</div>
              {r.sentAt && <div className="text-[#6B7280] break-words">발송 {when(r.sentAt)}</div>}
              {r.aligoMessageId && (
                <div className="text-[#6B7280] break-words">발송번호 {r.aligoMessageId}</div>
              )}
              {r.errorReason && (
                <div className="mt-1 text-[#D95C5C] break-words">{r.errorReason}</div>
              )}
              {r.retryCount > 0 && <div className="text-[#6B7280]">다시 시도 {r.retryCount}회</div>}
              {r.status === "failed" && (
                <button
                  onClick={() => retry(r.id)}
                  disabled={busy}
                  className="mt-2 w-full py-2 rounded-xl bg-[#F7F8F5] text-[#25282D] text-sm font-semibold disabled:opacity-60"
                >
                  다시 발송
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
