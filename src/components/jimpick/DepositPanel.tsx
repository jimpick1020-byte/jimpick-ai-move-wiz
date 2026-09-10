/**
 * 예약금 입금 확인 칸 (사장님용).
 *
 * 은행에서 온 입금알림 문자를 그대로 붙여넣으면
 *  · 입금자 이름이 고객 이름과 같으면 → 바로 예약금으로 반영하고 고객에게 확인 문자를 보냅니다.
 *  · 이름이 다르면 → 절대 금액을 바꾸지 않고 「확인 대기」로 남겨, 사장님이 직접 확인합니다.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  registerDeposit,
  confirmDeposit,
  rejectDeposit,
  listDeposits,
  type DepositRow,
} from "@/lib/deposit.functions";
import { parseDepositSms } from "@/lib/deposit-parse";

const won = (n: number) => `${Number(n || 0).toLocaleString("ko-KR")}원`;

export function DepositPanel({
  estimateId,
  customerName,
  total,
}: {
  estimateId: string;
  customerName: string;
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [busy, setBusy] = useState(false);
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
    return () => {
      alive = false;
    };
  }, [estimateId]);

  const paid = rows.filter((r) => r.status === "confirmed").reduce((s, r) => s + r.amount, 0);
  const pending = rows.filter((r) => r.status === "pending_review");
  const preview = text.trim() ? parseDepositSms(text) : null;

  const submit = async () => {
    if (busy || !text.trim()) return;
    setBusy(true);
    try {
      const r = await registerDeposit({ data: { estimateId, text } });
      if (!r.ok) {
        toast.error("입금 기록 실패", { description: r.error ?? "다시 시도해 주세요" });
      } else if (r.needsReview) {
        toast.warning("입금자 이름이 고객 이름과 다릅니다", {
          description: "금액은 그대로 두었습니다. 직접 확인한 뒤 반영해 주세요.",
        });
        setText("");
      } else {
        toast.success(`예약금 ${won(r.paid ?? 0)} 반영 완료`, {
          description: r.smsError
            ? `고객 문자 실패: ${r.smsError}`
            : "고객에게 입금 확인 문자를 보냈습니다.",
        });
        setText("");
      }
    } finally {
      setBusy(false);
      load();
    }
  };

  const doConfirm = async (id: string) => {
    if (working) return;
    setWorking(id);
    try {
      const r = await confirmDeposit({ data: { id } });
      if (r.ok) {
        toast.success(`예약금 ${won(r.paid ?? 0)} 반영 완료`, {
          description: r.smsError ? `고객 문자 실패: ${r.smsError}` : "고객에게 안내 문자를 보냈습니다.",
        });
      } else toast.error("반영 실패", { description: r.error ?? "" });
    } finally {
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
    }
  };

  return (
    <div className="mt-2 rounded-xl bg-[#F7F9FC] p-2.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-[12.5px] font-bold text-[#334155]"
      >
        <span>
          예약금 입금{" "}
          {paid > 0 ? (
            <span className="text-[#15803D]">{won(paid)} 확인 완료</span>
          ) : (
            <span className="text-[#6B7280]">미확인</span>
          )}
          {pending.length > 0 && (
            <span className="ml-1 text-[#B45309]">· 확인 대기 {pending.length}건</span>
          )}
        </span>
        <span className="text-[#6B7280]">{open ? "닫기" : "열기"}</span>
      </button>

      {paid > 0 && (
        <div className="mt-1 text-[12px] font-semibold text-[#334155]">
          잔금 {won(Math.max(0, total - paid))} · 고객 견적서에도 함께 표시됩니다
        </div>
      )}

      {open && (
        <div className="mt-2 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={"은행 입금알림 문자를 그대로 붙여넣어 주세요\n예) [Web발신] 국민 09/10 22:30 입금 100,000 김호영"}
            className="w-full rounded-xl border border-[#DCE8FA] bg-white p-2.5 text-[13px] leading-relaxed outline-none focus:border-[#0751D8]"
          />
          {preview && (
            <div className="rounded-xl bg-white p-2.5 text-[12.5px] text-[#334155]">
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
          <button
            onClick={() => void submit()}
            disabled={busy || !text.trim()}
            className="w-full rounded-xl bg-[#0751D8] py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "확인 중…" : "입금 확인하기"}
          </button>

          {rows.length > 0 && (
            <div className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.id} className="rounded-xl bg-white p-2.5 text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">
                      {r.depositorName || "이름 없음"} · {won(r.amount)}
                    </span>
                    <span
                      className={
                        r.status === "confirmed"
                          ? "font-bold text-[#15803D]"
                          : r.status === "rejected"
                            ? "font-bold text-[#6B7280]"
                            : "font-bold text-[#B45309]"
                      }
                    >
                      {r.status === "confirmed"
                        ? "반영 완료"
                        : r.status === "rejected"
                          ? "제외"
                          : "확인 대기"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[#6B7280]">
                    {r.depositedAt ? new Date(r.depositedAt).toLocaleString("ko-KR") : ""}
                    {r.status === "pending_review" && !r.nameMatched
                      ? ` · 고객명(${r.customerName || "없음"})과 다릅니다`
                      : ""}
                  </div>
                  {r.notifyError && r.status === "confirmed" && (
                    <div className="mt-0.5 font-semibold text-[#B91C1C]">
                      고객 문자 실패: {r.notifyError}
                    </div>
                  )}
                  {r.status === "pending_review" && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => void doConfirm(r.id)}
                        disabled={working === r.id}
                        className="flex-1 rounded-xl bg-[#EEF4FF] py-2 font-bold text-[#0751D8] disabled:opacity-50"
                      >
                        {working === r.id ? "처리 중…" : "내 고객 입금 맞음 · 반영"}
                      </button>
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
