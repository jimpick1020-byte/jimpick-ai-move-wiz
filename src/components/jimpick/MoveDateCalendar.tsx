import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Moon } from "lucide-react";
import { toast } from "sonner";
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

/** 하루에 받을 수 있는 확정 예약 최대 건수 (넘으면 마감) */
export const DAILY_BOOKING_LIMIT = 2;

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export function MoveDateCalendar({
  value,
  onSelect,
  counts,
}: {
  /** YYYY-MM-DD (없으면 빈 문자열) */
  value: string;
  onSelect: (date: string) => void;
  /** 날짜별(YYYY-MM-DD) 확정 예약 건수 — 실제 예약 데이터에서 집계해 전달합니다 */
  counts?: Record<string, number>;
}) {
  const today = todayYmd();
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
    if (dow === 0) return "text-[#EF4444]";
    if (dow === 6) return "text-[#0864DC]";
    return "text-[#1F2937]";
  };

  return (
    <div className="bg-white">
      {/* 연·월 + 얇은 선 화살표 */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="이전 달"
          className="flex h-9 w-9 items-center justify-center text-[#6B7280] active:translate-y-[1px]"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={1.8} />
        </button>
        <div className="text-[18px] font-black text-[#111827] tabular-nums">
          {view.y}년 {view.m}월
        </div>
        <button
          type="button"
          onClick={() => move(1)}
          aria-label="다음 달"
          className="flex h-9 w-9 items-center justify-center text-[#6B7280] active:translate-y-[1px]"
        >
          <ChevronRight className="h-6 w-6" strokeWidth={1.8} />
        </button>
      </div>

      {/* 요일 */}
      <div className="mt-3 grid grid-cols-7 text-center text-[13px] font-bold">
        {WEEK.map((w, i) => (
          <div key={w} className={dowColor(i, false)}>
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 — 테두리·배경·그림자 없이 평면 */}
      <div className="mt-1 grid grid-cols-7">
        {cells.map((c, i) =>
          !c ? (
            <div key={`e${i}`} className="min-h-[58px]" />
          ) : (
            (() => {
              const cnt = counts?.[c.date] ?? 0;
              const full = cnt >= DAILY_BOOKING_LIMIT;
              const one = cnt === 1;
              const selected = value === c.date;
              const disabled = c.past || full;
              return (
                <button
                  key={c.date}
                  type="button"
                  disabled={c.past}
                  onClick={() => {
                    if (full) {
                      tap("soft");
                      toast.error("예약이 마감된 날짜입니다");
                      return;
                    }
                    tap("click");
                    onSelect(c.date);
                  }}
                  aria-label={`${view.m}월 ${c.d}일${c.son ? " 손없는날" : ""}${
                    full ? " 예약 마감" : ""
                  }`}
                  aria-pressed={selected}
                  aria-disabled={disabled}
                  className="relative flex min-h-[58px] flex-col items-center justify-start gap-[2px] pt-1.5"
                >
                  {/* 손없는날 — 오른쪽 위 작은 금색 초승달 */}
                  {c.son && (
                    <Moon
                      className="absolute right-1 top-0.5 h-3.5 w-3.5 text-[#F59E0B]"
                      fill="#F59E0B"
                      strokeWidth={0}
                    />
                  )}
                  {/* 숫자 (마감이면 아주 연한 빨강 원 배경, 선택이면 파란 원 배경) */}
                  <span
                    className={`relative flex h-8 w-8 items-center justify-center rounded-full text-[16px] font-bold tabular-nums ${
                      full
                        ? "bg-[#FDECEC]"
                        : selected
                          ? "bg-[#0864DC] text-white"
                          : ""
                    } ${full ? dowColor(c.dow, false) : selected ? "text-white" : dowColor(c.dow, c.past)}`}
                  >
                    {c.d}
                  </span>
                  {/* 아래 상태 표시 — 마감 > 예약 1건 점 / 손없는날 텍스트 */}
                  {full ? (
                    <span className="text-[10px] font-bold text-[#EF4444]">마감</span>
                  ) : one ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0864DC]" aria-hidden />
                  ) : c.son ? (
                    <span className="text-[10px] font-semibold text-[#D97706]">손없는날</span>
                  ) : (
                    <span className="h-1.5 w-1.5" aria-hidden />
                  )}
                  {/* 마감이면서 손없는날이어도 초승달은 위에 이미 작게 유지됩니다 */}
                </button>
              );
            })()
          ),
        )}
      </div>

      {/* 얇은 회색 구분선 + 범례 (모바일에서 두 줄로 자연스럽게 줄바꿈) */}
      <div className="mt-3 border-t border-[#EEF1F5] pt-3">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] font-semibold text-[#6B7280]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0864DC]" />
            예약 1건
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded-full bg-[#FDECEC]" />
            마감
          </span>
          <span className="flex items-center gap-1.5">
            <Moon className="h-4 w-4 text-[#F59E0B]" fill="#F59E0B" strokeWidth={0} />
            손없는날
          </span>
        </div>
      </div>

      {value && (
        <div className="mt-3 rounded-xl bg-[#F5F7FB] px-3 py-2 text-center text-[13px] font-semibold text-[#111827]">
          선택한 이사 날짜 · {value}
        </div>
      )}
    </div>
  );
}
