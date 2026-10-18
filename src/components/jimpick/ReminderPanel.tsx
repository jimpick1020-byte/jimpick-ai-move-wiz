/**
 * 이사 전날 안내 문자 상태 칸 (사장님용).
 *
 * 예약이 확정되면 이사 전날 18시(한국시간)에 서버가 스스로 보냅니다.
 * 여기서는 실제 저장된 상태만 보여 주고, 실패·확인 필요 건만 다시 보냅니다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  listMoveReminders,
  retryMoveReminder,
  previewMoveReminder,
  REMINDER_STATUS_LABEL,
  type MoveReminderRow,
} from "@/lib/reminder.functions";

const COLOR: Record<string, string> = {
  scheduled: "text-[#25282D]",
  processing: "text-[#B45309]",
  sending: "text-[#B45309]",
  accepted: "text-[#2F6FED]",
  success: "text-[#2F6FED]",
  delivered: "text-[#3E9B78]",
  failed: "text-[#D95C5C]",
  canceled: "text-[#6B7280]",
  cancelled: "text-[#6B7280]",
  unknown: "text-[#B45309]",
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "";

export function ReminderPanel({ estimateId }: { estimateId: string }) {
  const [rows, setRows] = useState<MoveReminderRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<MoveReminderRow | null>(null);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const previewFn = useServerFn(previewMoveReminder);
  const retryFn = useServerFn(retryMoveReminder);

  const openPreview = async (row: MoveReminderRow) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await previewFn({ data: { id: row.id } });
      if (!result.ok || !result.message) {
        toast.error(result.error ?? "문자 내용을 불러오지 못했습니다");
        return;
      }
      setMessage(result.message);
      setSelected(row);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "문자 내용을 불러오지 못했습니다");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

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

  const retry = async (row: MoveReminderRow) => {
    if (lock.current) return;
    const already = ["accepted", "delivered", "success"].includes(row.status);
    lock.current = true;
    setBusy(true);
    try {
      const r = await retryFn({ data: { id: row.id, confirmResend: already } });
      if (r.ok) {
        toast.success("문자업체가 안내 문자를 접수했습니다");
        setSelected(null);
        await load();
      } else {
        toast.error("다시 보낼 수 없습니다", { description: r.error ?? "" });
      }
    } catch (e) {
      toast.error("다시 보낼 수 없습니다", { description: e instanceof Error ? e.message : "" });
    } finally {
      lock.current = false;
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
              {r.toMasked && <div className="text-[#6B7280] break-words">받는 번호 {r.toMasked}</div>}
              {r.acceptedAt && (
                <div className="text-[#6B7280] break-words">문자업체 접수 {when(r.acceptedAt)}</div>
              )}
              {r.deliveredAt && (
                <div className="text-[#3E9B78] break-words">통신사 전달 {when(r.deliveredAt)}</div>
              )}
              {r.customerViewedAt ? (
                <div className="text-[#3E9B78] break-words">
                  고객 확인 {when(r.customerViewedAt)}
                  {r.viewCount > 1 ? ` · ${r.viewCount}회` : ""}
                </div>
              ) : (
                <div className="text-[#6B7280]">고객 확인 기록 없음</div>
              )}
              {r.messageType && (
                <div className="text-[#6B7280]">
                  문자 종류 {r.messageType}
                  {r.providerMessageId ? ` · 발송번호 ${r.providerMessageId}` : ""}
                </div>
              )}
              {r.lastCheckedAt && (
                <div className="text-[#6B7280] break-words">결과 확인 {when(r.lastCheckedAt)}</div>
              )}
              {r.errorReason && (
                <div className="mt-1 text-[#D95C5C] break-words">{r.errorReason}</div>
              )}
              {r.missedReason && (
                <div className="mt-1 text-[#B45309] break-words">{r.missedReason}</div>
              )}
              {r.retryCount > 0 && <div className="text-[#6B7280]">다시 시도 {r.retryCount}회</div>}
              {r.contractDeleted && (
                <div className="text-[#6B7280]">삭제된 계약의 기록입니다(보관용)</div>
              )}
              {["failed", "unknown", "scheduled", "accepted", "delivered", "success"].includes(
                r.status,
              ) && (
                <Button variant="secondary"
                  onClick={() => openPreview(r)}
                  disabled={busy}
                  className="mt-2 w-full"
                >
                  {r.status === "failed" || r.status === "unknown" ? "다시 발송" : "한 번 더 발송"}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open && !busy) setSelected(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[85dvh] overflow-y-auto rounded-lg text-foreground">
          <DialogTitle>이사 전날 안내 문자 확인</DialogTitle>
          <DialogDescription>
            {selected?.customerName} · {selected?.toMasked}
            {selected && ["accepted", "delivered", "success"].includes(selected.status)
              ? " · 이미 보낸 문자입니다. 다시 발송하면 문자 요금이 추가됩니다."
              : " · 아래 내용을 확인한 후 발송해 주세요."}
          </DialogDescription>
          <div className="max-h-[45dvh] overflow-y-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted p-3 text-sm leading-relaxed">{message}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>취소</Button>
            <Button variant="staff" disabled={busy || !message} onClick={() => { if (selected) void retry(selected); }}>
              {busy ? "발송 처리 중…" : "이 내용으로 발송"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
