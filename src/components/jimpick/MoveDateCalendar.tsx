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

/** 하루 여러 건 계약을 받을 수 있습니다. 2건 이상이면 달력에서 빨간색으로 알려 줍니다. */
export const MANY_BOOKING_WARN = 2;

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export interface CalendarBooking {
  estimateId: string;
  termsId: string;
  customerName: string;
  total: number;
  sheetNo: string | null;
  /** 'customer'(고객 확정) | 'company_admin'(업체 확정) */
  confirmedBy?: string;
  moveTime?: string | null;
  fromArea?: string | null;
  toArea?: string | null;
  moveType?: string | null;
  truck?: string | null;
  staffName?: string | null;
  /** 평수 (견적서에 저장된 값) */
  sizeTab?: string | null;
  /** 결제 진행 상태 */
  paymentStatus?: string | null;
  /** 완료 보관 대상으로 체크했는지 */
  calendarSelected?: boolean;
}

/** 이사 날짜 선택 전용 달력 — 기존 계약·고객 정보는 불러오지도, 보여 주지도 않습니다. */
export function MoveDateCalendar({
  value,
  onSelect,
}: {
  /** YYYY-MM-DD (없으면 빈 문자열) */
  value: string;
  onSelect: (date: string) => void;
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
            <div key={`e${i}`} className="min-h-[60px]" />
          ) : (
            (() => {
              const selected = value === c.date;
              const isToday = c.date === today;
              const box = selected
                ? "bg-[#EAF2FC] border-[#1D4ED8]"
                : c.son
                  ? "bg-[#FDF6E3] border-[#F3D98A]"
                  : "border-[#E5E7EB] bg-white";
              const ring = selected ? " ring-2 ring-[#1D4ED8]" : isToday ? " ring-1 ring-[#93C5FD]" : "";
              const numColor = selected ? "text-[#1D4ED8]" : dowColor(c.dow, c.past);
              return (
                <button
                  key={c.date}
                  type="button"
                  disabled={c.past}
                  onClick={() => {
                    tap("click");
                    // 계약이 있어도 날짜 선택은 항상 가능합니다(하루 여러 건 계약 허용).
                    onSelect(c.date);
                  }}
                  aria-label={`${view.m}월 ${c.d}일${c.son ? " 손없는날" : ""}`}
                  aria-pressed={selected}
                  aria-disabled={c.past}
                  className={`relative flex min-h-[60px] flex-col items-center justify-start gap-[2px] rounded-xl border px-0.5 pt-1.5 pb-1 ${box}${ring} ${
                    c.past ? "opacity-45" : ""
                  }`}
                >
                  <span className={`text-[17px] font-black tabular-nums ${numColor}`}>{c.d}</span>
                  {/* 상태 표시 — 계약 건수 배지 > 손없는날 배지 */}
                  {c.son ? (
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

      <div className="mt-3 border-t border-[#E5E7EB] pt-3">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] font-semibold text-[#6B7280]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded-md border-2 border-[#1D4ED8] bg-[#EAF2FC]" />
            선택한 날짜
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded-md border border-[#F3D98A] bg-[#FDF6E3]" />
            손없는날
          </span>
        </div>
      </div>

      {value && (
        <div className="mt-3 rounded-xl bg-[#F7F8F5] px-3 py-2 text-center text-[13px] font-semibold text-[#25282D]">
          선택한 이사 날짜 · {value}
        </div>
      )}
    </div>
  );
}
