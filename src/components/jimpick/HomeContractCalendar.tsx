import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import KoreanLunarCalendar from "korean-lunar-calendar";
import { Button } from "@/components/ui/button";
import { normalizePaymentStatus } from "@/lib/payment.functions";
import { RESERVATION_STAGE_LABEL, reservationStageOf } from "@/lib/reservation-status";
import { cancelContract, type ReservationRow } from "@/lib/terms.functions";
import { toast } from "sonner";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function seoulToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function isKoreanMovingDay(year: number, month: number, day: number) {
  try {
    const calendar = new KoreanLunarCalendar();
    if (!calendar.setSolarDate(year, month, day)) return false;
    const lunarDay = calendar.getLunarCalendar().day;
    return lunarDay % 10 === 9 || lunarDay % 10 === 0;
  } catch {
    return false;
  }
}

function statusOf(booking: ReservationRow) {
  return RESERVATION_STAGE_LABEL[reservationStageOf(booking)];
}

function moveTimeOrder(value: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const match = value.match(/(오전|오후)?\s*(\d{1,2})(?:[:시]\s*(\d{1,2})?)?/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hour = Number(match[2]);
  const minute = Number(match[3] ?? 0);
  if (match[1] === "오후" && hour < 12) hour += 12;
  if (match[1] === "오전" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

export function HomeContractCalendar({
  bookings,
  companyName,
  onOpenBooking,
  onCancelled,
}: {
  bookings: Record<string, ReservationRow[]>;
  companyName: string;
  onOpenBooking: (booking: ReservationRow) => void;
  onCancelled: () => void;
}) {
  const [cancelTarget, setCancelTarget] = useState<ReservationRow | null>(null);
  const [cancelStep, setCancelStep] = useState<"confirm" | "completed">("confirm");
  const [cancelBusy, setCancelBusy] = useState(false);
  const askCancel = (booking: ReservationRow) => {
    setCancelStep(normalizePaymentStatus(booking.paymentStatus) === "completed" ? "completed" : "confirm");
    setCancelTarget(booking);
  };
  const doCancel = async () => {
    if (!cancelTarget || cancelBusy) return;
    setCancelBusy(true);
    try {
      const result = await cancelContract({ data: { termsId: cancelTarget.termsId } });
      if (!result.ok) {
        toast.error(result.error ?? "계약을 취소하지 못했습니다.");
        return;
      }
      toast.success("계약을 취소했습니다", {
        description: result.reminders ? `발송 전 전날 안내 문자 ${result.reminders}건도 취소했습니다.` : "견적서와 고객정보는 그대로 남아 있습니다.",
      });
      setCancelTarget(null);
      onCancelled();
    } catch {
      toast.error("계약을 취소하지 못했습니다. 통신 상태를 확인해 주세요.");
    } finally {
      setCancelBusy(false);
    }
  };
  const today = seoulToday();
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const [view, setView] = useState({ year: todayYear, month: todayMonth });
  const [selectedDate, setSelectedDate] = useState(today);

  const cells = useMemo(() => {
    const firstDay = new Date(Date.UTC(view.year, view.month - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate();
    const previousDays = new Date(Date.UTC(view.year, view.month - 1, 0)).getUTCDate();
    return Array.from({ length: 42 }, (_, index) => {
      const offset = index - firstDay + 1;
      let year = view.year;
      let month = view.month;
      let day = offset;
      let current = true;
      if (offset <= 0) {
        month -= 1;
        if (month === 0) {
          year -= 1;
          month = 12;
        }
        day = previousDays + offset;
        current = false;
      } else if (offset > days) {
        month += 1;
        if (month === 13) {
          year += 1;
          month = 1;
        }
        day = offset - days;
        current = false;
      }
      return {
        year,
        month,
        day,
        date: ymd(year, month, day),
        current,
        son: isKoreanMovingDay(year, month, day),
      };
    });
  }, [view]);

  const selectedBookings = useMemo(
    () => [...(bookings[selectedDate] ?? [])].sort((a, b) => moveTimeOrder(a.moveTime) - moveTimeOrder(b.moveTime)),
    [bookings, selectedDate],
  );
  const moveMonth = (delta: number) => {
    const next = new Date(Date.UTC(view.year, view.month - 1 + delta, 1));
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 });
  };
  const goToday = () => {
    setView({ year: todayYear, month: todayMonth });
    setSelectedDate(today);
  };

  return (
    <section className="overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-[#1671E8]" strokeWidth={2.2} />
          <h2 className="text-[18px] font-black text-[#111827]">계약 일정</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1 text-[11px] font-bold text-[#667085]">
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-[#1671E8]" />1건</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-[#F97316]" />2건 이상</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-[#4ED2BC]" />완료</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-[#FF6B68]" />손 없는 날</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-5">
        <Button type="button" variant="ghost" size="icon" onClick={() => moveMonth(-1)} aria-label="이전 달" className="h-9 w-9 text-[#111827]">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <button type="button" onClick={goToday} className="min-w-[112px] text-[18px] font-black text-[#111827]">
          {view.year}년 {view.month}월
        </button>
        <Button type="button" variant="ghost" size="icon" onClick={() => moveMonth(1)} aria-label="다음 달" className="h-9 w-9 text-[#667085]">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="mt-1 grid grid-cols-7 text-center text-[12px] font-bold text-[#667085]">
        {WEEK.map((day, index) => <div key={day} className={index === 0 ? "text-[#FF4D4F]" : index === 6 ? "text-[#1671E8]" : ""}>{day}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-0.5">
        {cells.map((cell, index) => {
          if (!cell.current) {
            return <div key={cell.date} aria-hidden="true" className="min-h-[64px]" />;
          }
          const dayBookings = bookings[cell.date] ?? [];
          const completed = dayBookings.filter((booking) => normalizePaymentStatus(booking.paymentStatus) === "completed").length;
          const progressing = dayBookings.length - completed;
          const selected = selectedDate === cell.date;
          const isToday = today === cell.date;
          const dow = index % 7;
          return (
            <button
              type="button"
              key={cell.date}
              onClick={() => setSelectedDate(cell.date)}
              aria-label={`${cell.date}${dayBookings.length ? ` 계약 ${dayBookings.length}건` : ""}${cell.son ? " 손 없는 날" : ""}`}
              className="relative flex min-h-[64px] min-w-0 flex-col items-center pt-1"
            >
              <span
                className={`relative z-10 flex h-7 items-center justify-center rounded-full text-[15px] font-bold tabular-nums ${
                  selected
                    ? "w-7 border-2 border-calendar-selected bg-white text-[#111827]"
                    : `min-w-7 px-1 ${dow === 0 ? "text-[#FF4D4F]" : dow === 6 ? "text-[#1671E8]" : "text-[#111827]"} ${isToday ? "ring-1 ring-[#1671E8]" : ""}`
                }`}
              >
                {cell.day}
              </span>
              {dayBookings.length > 0 && (
                <span
                  className={`pointer-events-none relative z-20 mt-1 flex h-[17px] max-w-[46px] items-center justify-center whitespace-nowrap rounded-full px-1.5 text-[10px] font-black leading-none text-white ${progressing === 0 ? "bg-[#35BBA3]" : progressing >= 2 ? "bg-[#F97316]" : "bg-[#1671E8]"}`}
                >
                  {progressing === 0 ? "완료" : `${progressing}건`}
                </span>
              )}
              {cell.son && (
                <span className="pointer-events-none absolute right-0.5 top-0 z-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#FF6B68] px-0.5 text-[7px] font-black leading-none text-white">
                  손
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-[14px] bg-[#F7F8FA] p-3">
        <div className="mb-2 text-[15px] font-black text-[#111827]">
          {Number(selectedDate.slice(5, 7))}월 {Number(selectedDate.slice(8, 10))}일
          {selectedBookings.length > 1 ? ` · 계약 ${selectedBookings.length}건` : ""}
        </div>
        {selectedBookings.length === 0 ? (
          <p className="py-2 text-center text-[13px] font-semibold text-[#8A94A6]">등록된 계약 일정이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {selectedBookings.map((booking) => {
              const done = normalizePaymentStatus(booking.paymentStatus) === "completed";
              const deposit = booking.depositPaid > 0 ? `예약금 ${booking.depositPaid.toLocaleString()}원 입금` : "예약금 미입금";
              return (
                <div key={booking.termsId} className="rounded-xl bg-white p-3">
                  <div className="truncate text-[15px] font-black text-[#111827]">{booking.customerName || "이름 없음"} 고객님</div>
                  <div className="mt-0.5 text-[12.5px] font-semibold text-[#667085]">시작 {booking.moveTime || "시간 미정"}</div>
                  <div className="break-keep text-[12.5px] font-semibold text-[#667085]">{booking.fromArea ?? "출발지 미입력"} → {booking.toArea ?? "도착지 미입력"}</div>
                  <div className="text-[13px] font-black tabular-nums text-[#111827]">총 {booking.total.toLocaleString()}원</div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11.5px] font-black">
                    <span className={`rounded-full px-2 py-0.5 ${done ? "bg-[#DDF8F1] text-[#187765]" : "bg-[#EAF2FC] text-[#1671E8]"}`}>{statusOf(booking)}</span>
                    <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[#4B5563]">{deposit}</span>
                    {companyName && <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[#4B5563]">{companyName}</span>}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => onOpenBooking(booking)} className="flex-1 rounded-xl bg-[#EAF2FC] py-2.5 text-[13px] font-black text-[#1671E8]">견적서 보기</button>
                    <button type="button" onClick={() => askCancel(booking)} className="flex-1 rounded-xl border border-[#EBCFCF] bg-white py-2.5 text-[13px] font-black text-[#D95C5C]">계약 취소</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-[#25282D]/45" onClick={() => { if (!cancelBusy) setCancelTarget(null); }} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-[340px] rounded-3xl bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.3)]">
            {cancelStep === "completed" ? (
              <div className="text-center text-[15px] font-black leading-relaxed text-[#B45309]">
                이 계약은 이미 결제가 완료된 계약입니다. 그래도 취소하시겠습니까? 결제기록은 삭제되지 않으며 환불은 별도로 처리해야 합니다.
              </div>
            ) : (
              <div className="text-center text-[15px] font-black leading-relaxed text-[#25282D]">
                이 계약을 취소하시겠습니까? 취소된 계약은 계약 일정에서 제외되지만 견적서와 고객정보는 삭제되지 않습니다.
              </div>
            )}
            <div className="mt-2 text-center text-[12.5px] font-semibold text-[#6B7280]">{cancelTarget.customerName || "이름 없음"} 고객님 · {cancelTarget.moveDate}</div>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={cancelBusy} onClick={() => setCancelTarget(null)} className="flex-1 rounded-2xl border border-[#E5E7EB] bg-white py-3 text-[14px] font-black text-[#6B7280] disabled:opacity-50">돌아가기</button>
              <button
                type="button"
                disabled={cancelBusy}
                onClick={() => (cancelStep === "completed" ? setCancelStep("confirm") : void doCancel())}
                className="flex-1 rounded-2xl bg-[#D95C5C] py-3 text-[14px] font-black text-white disabled:opacity-50"
              >
                {cancelBusy ? "취소 중…" : cancelStep === "completed" ? "계속 진행" : "계약 취소"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}