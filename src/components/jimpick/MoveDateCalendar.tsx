import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import KoreanLunarCalendar from "korean-lunar-calendar";
import { tap } from "@/lib/feedback";

/** YYYY-MM-DD 문자열 만들기 (시간대 영향 없음) */
function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 오늘 날짜(로컬) */
function todayYmd() {
  const n = new Date();
  return ymd(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

/** 음력 날짜 구하기 — 변환 실패하면 null */
export function lunarOf(y: number, m: number, d: number): { month: number; day: number } | null {
  try {
    const cal = new KoreanLunarCalendar();
    if (!cal.setSolarDate(y, m, d)) return null;
    const l = cal.getLunarCalendar();
    return { month: l.month, day: l.day };
  } catch {
    return null;
  }
}

/** 손 없는 날 = 음력 끝자리 9 또는 0 (음력 9·10·19·20·29·30일) */
export function isSonEomneunDay(y: number, m: number, d: number) {
  const l = lunarOf(y, m, d);
  if (!l) return false;
  const last = l.day % 10;
  return last === 9 || last === 0;
}

/** 하루에 받을 수 있는 확정 계약 최대 건수 (넘으면 마감) */
export const DAILY_BOOKING_LIMIT = 2;

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export interface CalendarBooking {
  estimateId: string;
  termsId: string;
  customerName: string;
  total: number;
  sheetNo: string | null;
}

export function MoveDateCalendar({
  value,
  onSelect,
  counts,
  bookings,
  onOpenBooking,
  onCancelBooking,
}: {
  /** YYYY-MM-DD (없으면 빈 문자열) */
  value: string;
  onSelect: (date: string) => void;
  /** 날짜별(YYYY-MM-DD) 확정 계약 건수 — 실제 계약 데이터에서 집계해 전달합니다 */
  counts?: Record<string, number>;
  /** 날짜별 확정 예약 상세 — 누르면 견적서를 열 수 있게 합니다 */
  bookings?: Record<string, CalendarBooking[]>;
  onOpenBooking?: (estimateId: string, customerName: string, termsId: string) => void;
  onCancelBooking?: (termsId: string, estimateId: string) => void;
}) {
  const today = todayYmd();
  const [openDate, setOpenDate] = useState("");
  const base = useMemo(() => {
    const src = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today;
    const [y, m] = src.split("-").map(Number);
    return { y, m };
  }, [value, today]);

  const [view, setView] = useState(base);

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m - 1, 1);
    const lead = first.getDay();
    const days = new Date(view.y, view.m, 0).getDate();
    const list: ({ d: number; date: string; dow: number; son: boolean; past: boolean } | null)[] =
      [];
    for (let i = 0; i < lead; i++) list.push(null);
    for (let d = 1; d <= days; d++) {
      const date = ymd(view.y, view.m, d);
      const l = lunarOf(view.y, view.m, d);
      list.push({
        d,
        date,
        dow: new Date(view.y, view.m - 1, d).getDay(),
        son: l ? l.day % 10 === 9 || l.day % 10 === 0 : false,
        past: date < today,
      });
    }
    return list;
  }, [view, today]);

  const move = (delta: number) => {
    tap("soft");
    setView((v) => {
      const n = new Date(v.y, v.m - 1 + delta, 1);
      return { y: n.getFullYear(), m: n.getMonth() + 1 };
    });
  };

  /** 요일별 숫자 색 — 일요일 빨강, 토요일 파랑, 평일 짙은 남색 */
  const dowColor = (dow: number, muted: boolean) => {
    if (muted) return "text-[#C3CAD6]";
    if (dow === 0) return "text-[#D95C5C]";
    if (dow === 6) return "text-[#3578C8]";
    return "text-[#25282D]";
  };

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3">
      {/* 연·월 + 파란 화살표 버튼 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="이전 달"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F8F5] text-[#25282D] active:translate-y-[1px]"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
        </button>
        <div className="text-[18px] font-black text-[#25282D] tabular-nums">
          {view.y}년 {view.m}월
        </div>
        <button
          type="button"
          onClick={() => move(1)}
          aria-label="다음 달"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F8F5] text-[#25282D] active:translate-y-[1px]"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </div>

      {/* 요일 */}
      <div className="mt-3 grid grid-cols-7 text-center text-[15px] font-black">
        {WEEK.map((w, i) => (
          <div key={w} className={dowColor(i, false)}>
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 — 둥근 사각형 칸 */}
      <div className="mt-1.5 grid grid-cols-7 gap-1">
        {cells.map((c, i) =>
          !c ? (
            <div key={`e${i}`} className="min-h-[56px]" />
          ) : (
            (() => {
              const cnt = counts?.[c.date] ?? 0;
              const hasContract = cnt >= 1; // 계약 있는 날
              const many = cnt >= 2; // 계약 2건 이상 → 주황
              const selected = value === c.date;
              // 칸 배경·테두리: 계약(2건+ 주황 / 1건 초록) > 손없는날 > 기본.
              const box = many
                ? "bg-[#FFF4E5] border-[#F59E0B]"
                : cnt === 1
                  ? "bg-[#E9F9EF] border-[#3E9B78]"
                  : c.son
                    ? "bg-[#FDF6E3] border-[#F3D98A]"
                    : "border-[#E5E7EB] bg-white";
              const ring = selected ? " ring-2 ring-[#3578C8]" : "";
              return (
                <button
                  key={c.date}
                  type="button"
                  disabled={c.past}
                  onClick={() => {
                    // 계약 있는 날: 계약 목록 패널을 열어 견적서 보기/예약 취소를 선택하게 함.
                    if (hasContract) {
                      tap("click");
                      setOpenDate((p) => (p === c.date ? "" : c.date));
                      return;
                    }
                    // 계약 없는 날: 새 견적의 이사 날짜로 선택.
                    tap("click");
                    onSelect(c.date);
                  }}
                  aria-label={`${view.m}월 ${c.d}일${c.son ? " 손없는날" : ""}${
                    hasContract ? ` 계약완료 ${cnt}건` : ""
                  }`}
                  aria-pressed={selected}
                  aria-disabled={c.past}
                  className={`relative flex min-h-[56px] flex-col items-center justify-start gap-[2px] rounded-xl border px-0.5 pt-1.5 pb-1 ${box}${ring} ${
                    c.past ? "opacity-45" : ""
                  }`}
                >
                  <span
                    className={`text-[17px] font-black tabular-nums ${dowColor(c.dow, c.past)}`}
                  >
                    {c.d}
                  </span>
                  {/* 상태 표시 — 계약완료(초록/주황) + 건수 > 손없는날 배지 */}
                  {hasContract ? (
                    <span
                      className={`flex flex-col items-center leading-none ${
                        many ? "text-[#B45309]" : "text-[#3E9B78]"
                      }`}
                    >
                      <span className="text-[10px] font-black">계약완료</span>
                      <span className="mt-[1px] text-[11px] font-black tabular-nums">{cnt}건</span>
                    </span>
                  ) : c.son ? (
                    <span className="rounded-full bg-[#FBE7B8] px-1 py-[1px] text-[10px] font-black text-[#8A6D1B]">
                      손없는날
                    </span>
                  ) : (
                    <span className="h-1.5 w-1.5" aria-hidden />
                  )}
                </button>
              );
            })()
          ),
        )}
      </div>

      {/* 얇은 회색 구분선 + 범례 (모바일에서 두 줄로 자연스럽게 줄바꿈) */}
      <div className="mt-3 border-t border-[#E5E7EB] pt-3">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] font-semibold text-[#6B7280]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded-md border border-[#3E9B78] bg-[#E9F9EF]" />
            계약 1건
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded-md border border-[#F59E0B] bg-[#FFF4E5]" />
            계약 2건 이상
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded-md border border-[#F3D98A] bg-[#FDF6E3]" />
            손없는날
          </span>
        </div>
      </div>

      {/* 예약된 날짜를 누르면 그 날짜의 확정 계약을 보여 줍니다 */}
      {openDate && (bookings?.[openDate]?.length ?? 0) > 0 && (
        <div className="mt-3 rounded-xl border border-[#E5E7EB] bg-[#F7FAFF] p-3">
          <div className="mb-2 text-[13px] font-bold text-[#25282D]">
            {openDate} 계약 {bookings?.[openDate]?.length ?? 0}건 · 고객을 선택하세요
          </div>
          <div className="space-y-2">
            {(bookings?.[openDate] ?? []).map((b) => (
              <div key={b.termsId} className="rounded-xl border border-[#E5E7EB] bg-white p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-bold text-[#25282D]">
                      {b.customerName || "이름 없음"}
                    </div>
                    <div className="text-[12.5px] font-semibold text-[#6B7280] tabular-nums">
                      {b.total.toLocaleString()}원
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      tap("click");
                      onOpenBooking?.(b.estimateId, b.customerName, b.termsId);
                    }}
                    className="shrink-0 rounded-lg bg-[#3578C8] px-3 py-2 text-[13px] font-bold text-white active:translate-y-[1px]"
                  >
                    견적서 보기
                  </button>
                </div>
                {onCancelBooking && (
                  <button
                    type="button"
                    onClick={() => {
                      tap("soft");
                      onCancelBooking(b.termsId, b.estimateId);
                    }}
                    className="mt-2 w-full rounded-lg border border-[#EBCFCF] bg-white py-2 text-[12.5px] font-bold text-[#D95C5C] active:translate-y-[1px]"
                  >
                    이 예약 취소
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {value && (
        <div className="mt-3 rounded-xl bg-[#F7F8F5] px-3 py-2 text-center text-[13px] font-semibold text-[#25282D]">
          선택한 이사 날짜 · {value}
        </div>
      )}
    </div>
  );
}
