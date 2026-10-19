/**
 * 예약금 입금 확인 칸 (사장님용).
 *
 * 고객이 「입금했습니다」를 누르면 기록이 만들어지고,
 * 사장님은 기록별로 확인합니다. 확인 시 문자 발송이나 견적 금액 변경은 하지 않습니다.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  confirmDeposit,
  rejectDeposit,
  listDeposits,
  type DepositRow,
} from "@/lib/deposit.functions";
import { pendingReceipt } from "@/lib/payment-review";
import { Button } from "@/components/ui/button";

const won = (n: number) => `${Number(n || 0).toLocaleString("ko-KR")}원`;

export function DepositPanel({
  estimateId,
  onSaved,
}: {
  estimateId: string;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [working, setWorking] = useState<string | null>(null);

  const load = () => {
    listDeposits({ data: { estimateId } })
      .then((r) => {
        if (r.ok) setRows(r.rows);
      })
      .catch(() => {});
  };
  useEffect(() => {
    let alive = true;
    listDeposits({ data: { estimateId } })
      .then((r) => {
        if (alive && r.ok) setRows(r.rows);
      })
      .catch(() => {});
    const refresh = () => {
      listDeposits({ data: { estimateId } }).then((r) => { if (alive && r.ok) setRows(r.rows); }).catch(() => {});
    };
    window.addEventListener("jimpick:payment-updated", refresh);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 15000);
    return () => {
      alive = false;
      window.removeEventListener("jimpick:payment-updated", refresh);
      window.clearInterval(timer);
    };
  }, [estimateId]);

  const paid = rows.filter((r) => r.status === "confirmed").reduce((s, r) => s + r.amount, 0);
  const pending = rows.filter(pendingReceipt);
  const doConfirm = async (id: string) => {
    if (working) return;
    setWorking(id);
    try {
      const r = await confirmDeposit({ data: { id } });
      if (r.ok) {
        setRows((old) => old.map((row) => row.id === id ? { ...row, status: "confirmed", confirmedAt: new Date().toISOString() } : row));
        toast.success(`입금 ${won(r.paid ?? 0)} 확인 완료`);
        onSaved?.();
        window.dispatchEvent(new Event("jimpick:payment-updated"));
      } else toast.error("확인 실패", { description: r.error ?? "" });
    } catch (error) {
      toast.error("확인 실패", { description: error instanceof Error ? error.message : "다시 시도해 주세요" });
    } finally {
      confirmLock.current = false;
      setWorking(null);
      load();
    }
  };

  const doReject = async (id: string) => {
    if (working) return;
    setWorking(id);
    try {
      const r = await rejectDeposit({ data: { id } });
      if (r.ok) toast.success("우리 고객 입금이 아닌 것으로 처리했습니다");
      else toast.error("처리 실패", { description: r.error ?? "" });
    } finally {
      setWorking(null);
      load();
      window.dispatchEvent(new Event("jimpick:payment-updated"));
    }
  };

  return (
    <div className="mt-2 rounded-xl bg-[#F7F8F5] p-2.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-[12.5px] font-bold text-[#6B7280]"
      >
        <span>
          계좌 입금 기록{" "}
          {paid > 0 ? (
            <span className="text-[#3E9B78]">{won(paid)} 확인 완료</span>
          ) : (
            <span className="text-[#6B7280]">미확인</span>
          )}
          {pending.length > 0 && (
            <span className="ml-1 text-[#B45309]">· 확인 대기 {pending.length}건</span>
          )}
        </span>
        <span className="text-[#6B7280]">{open ? "닫기" : "열기"}</span>
      </button>

      {(open || pending.length > 0) && (
        <div className="mt-2 space-y-2">
          {depositPaid <= 0 && <>
          <textarea
            aria-label="은행 입금알림 문자"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={
              "은행 입금알림 문자를 그대로 붙여넣어 주세요\n예) [Web발신] 국민 09/10 22:30 입금 100,000 김호영"
            }
            className="w-full rounded-xl border border-[#E5E7EB] bg-white p-2.5 text-[13px] leading-relaxed outline-none focus:border-[#3578C8]"
          />
          {preview && (
            <div className="rounded-xl bg-white p-2.5 text-[12.5px] text-[#6B7280]">
              <div>
                읽은 입금자: <b>{preview.depositorName || "못 읽음"}</b> · 금액{" "}
                <b>{preview.amount > 0 ? won(preview.amount) : "못 읽음"}</b>
              </div>
              <div className="mt-0.5 text-[#6B7280]">
                견적서 고객명: {customerName || "없음"}
                {preview.depositorName && customerName && preview.depositorName !== customerName
                  ? " · 이름이 달라 확인 대기로 남습니다"
                  : ""}
              </div>
            </div>
          )}
          <Button
            onClick={() => void submit()}
            disabled={busy || !text.trim()}
            variant="staff"
            className="w-full"
          >
            {busy ? "저장 중…" : "예약금 입금 기록 저장"}
          </Button>
          </>}

          {rows.length > 0 && (
            <div className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.id} className="rounded-xl bg-white p-2.5 text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">
                      {r.depositorName || "이름 없음"} · {won(r.amount)}{r.paymentKind === "balance" ? " · 잔금" : " · 예약금"}
                    </span>
                    <span
                      className={
                        r.status === "confirmed"
                          ? "font-bold text-[#3E9B78]"
                          : r.status === "rejected"
                            ? "font-bold text-[#6B7280]"
                            : "font-bold text-[#B45309]"
                      }
                    >
                      {r.status === "confirmed"
                        ? "확인 완료"
                        : r.status === "rejected"
                          ? "제외"
                          : "확인 대기"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[#6B7280]">
                    입금 시각 {new Date(r.depositedAt ?? r.createdAt).toLocaleString("ko-KR")}
                    {r.status === "pending_review" && !r.nameMatched
                      ? ` · 고객명(${r.customerName || "없음"})과 다릅니다`
                      : ""}
                  </div>
                  {r.confirmedAt && r.status === "confirmed" && <div className="mt-1 text-xs text-muted-foreground">확인 {new Date(r.confirmedAt).toLocaleString("ko-KR")} · 확인 담당자 {r.confirmedBy ? "업체 담당자" : "기록 없음"}</div>}
                  {r.notifyError && r.status === "confirmed" && (
                    <div className="mt-0.5 font-semibold text-[#D95C5C]">
                      고객 문자 실패: {r.notifyError}
                    </div>
                  )}
                  {pendingReceipt(r) && (
                    <div className="mt-2 flex gap-2">
                      <Button onClick={() => void doConfirm(r.id)} disabled={working !== null} variant="outline" className="flex-1">
                        {working === r.id ? "처리 중…" : r.paymentKind === "balance" ? "잔금 입금 확인" : "예약금 입금 확인"}
                      </Button>
                      <button
                        onClick={() => void doReject(r.id)}
                        disabled={working === r.id}
                        className="flex-1 rounded-xl bg-white py-2 font-bold text-[#6B7280] ring-1 ring-[#E5E7EB] disabled:opacity-50"
                      >
                        아님
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
