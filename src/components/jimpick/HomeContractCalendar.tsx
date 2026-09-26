import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import KoreanLunarCalendar from "korean-lunar-calendar";
import { Button } from "@/components/ui/button";
import { normalizePaymentStatus } from "@/lib/payment.functions";
import type { ReservationRow } from "@/lib/terms.functions";

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
  return normalizePaymentStatus(booking.paymentStatus) === "completed" ? "완료" : "예약금 완료 (진행중)";
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
  onOpenBooking,
}: {
  bookings: Record<string, ReservationRow[]>;
  onOpenBooking: (booking: ReservationRow) => void;
}) {
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
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-[#1671E8]" />계약</span>
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
              <span className={`relative z-10 flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[15px] font-bold tabular-nums ${selected ? "bg-[#1671E8] text-white" : dow === 0 ? "text-[#FF4D4F]" : dow === 6 ? "text-[#1671E8]" : "text-[#111827]"} ${isToday && !selected ? "ring-1 ring-[#1671E8]" : ""}`}>
                {cell.day}
              </span>
              {dayBookings.length > 0 && (
                <span
                  className={`pointer-events-none relative z-20 mt-1 flex h-[17px] max-w-[46px] items-center justify-center whitespace-nowrap rounded-full px-1.5 text-[9px] font-black leading-none text-white ${progressing > 0 ? "bg-[#1671E8]" : "bg-[#35BBA3]"}`}
                >
                  {progressing > 0 && completed > 0
                    ? `총 ${dayBookings.length}건`
                    : completed > 0
                      ? `완료 ${dayBookings.length}건`
                      : `${dayBookings.length}건`}
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
            {selectedBookings.map((booking) => (
              <button
                type="button"
                key={booking.termsId}
                onClick={() => onOpenBooking(booking)}
                className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl bg-white p-3 text-left"
              >
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-black text-[#111827]">{booking.customerName || "이름 없음"} 고객님</div>
                  <div className="truncate text-[12px] font-semibold text-[#667085]">{booking.moveTime || "시간 미정"}{booking.fromArea ? ` · ${booking.fromArea}` : ""}</div>
                  <div className={`mt-0.5 text-[12px] font-black ${normalizePaymentStatus(booking.paymentStatus) === "completed" ? "text-[#249F88]" : "text-[#1671E8]"}`}>{statusOf(booking)}</div>
                </div>
                <span className="shrink-0 rounded-xl bg-[#EAF2FC] px-2.5 py-2 text-[12px] font-black text-[#1671E8]">견적서 보기</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}