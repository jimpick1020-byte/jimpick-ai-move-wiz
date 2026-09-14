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

/** 손 없는 날 = 음력 끝자리 9 또는 0 */
export function isSonEomneunDay(y: number, m: number, d: number) {
  const l = lunarOf(y, m, d);
  if (!l) return false;
  const last = l.day % 10;
  return last === 9 || last === 0;
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

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
    const list: ({ d: number; date: string; lunar: string; son: boolean; past: boolean } | null)[] =
      [];
    for (let i = 0; i < lead; i++) list.push(null);
    for (let d = 1; d <= days; d++) {
      const date = ymd(view.y, view.m, d);
      const l = lunarOf(view.y, view.m, d);
      list.push({
        d,
        date,
        lunar: l ? `${l.month}.${l.day}` : "",
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

  return (
    <div className="rounded-2xl border border-[#DFE6F2] bg-white p-3 shadow-[0_8px_18px_-10px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="이전 달"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE8FA] bg-gradient-to-b from-white to-[#F1F6FF] text-[#0864DC] active:translate-y-[1px]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-[16px] font-bold text-[#111827] tabular-nums">
          {view.y}년 {view.m}월
        </div>
        <button
          type="button"
          onClick={() => move(1)}
          aria-label="다음 달"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE8FA] bg-gradient-to-b from-white to-[#F1F6FF] text-[#0864DC] active:translate-y-[1px]"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#6B7280]">
        {WEEK.map((w, i) => (
          <div key={w} className={i === 0 ? "text-[#EF4444]" : i === 6 ? "text-[#0751D8]" : ""}>
            {w}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) =>
          !c ? (
            <div key={`e${i}`} />
          ) : (
            <button
              key={c.date}
              type="button"
              disabled={c.past}
              onClick={() => {
                tap("click");
                onSelect(c.date);
              }}
              aria-label={`${view.m}월 ${c.d}일${c.son ? " 손없는 날" : ""}`}
              aria-pressed={value === c.date}
              className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl border px-0.5 py-1 leading-tight transition-colors ${
                c.past
                  ? "cursor-not-allowed border-transparent bg-[#F5F7FB] text-[#C3CAD6]"
                  : value === c.date
                    ? "border-[#0751D8] bg-gradient-to-b from-[#287BFF] to-[#0751D8] text-white shadow-[0_3px_0_#0645B0]"
                    : c.son
                      ? "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]"
                      : "border-[#E7EBF2] bg-white text-[#111827]"
              }`}
            >
              <span className="text-[14px] font-bold tabular-nums">{c.d}</span>
              <span
                className={`text-[9px] tabular-nums ${
                  value === c.date ? "text-white/85" : "text-[#9AA3B2]"
                }`}
              >
                {c.lunar}
              </span>
              {c.son && (
                <span
                  className={`mt-[1px] rounded-full px-1 text-[8px] font-bold ${
                    value === c.date ? "bg-white/25 text-white" : "bg-[#FDE68A] text-[#92400E]"
                  }`}
                >
                  손없음
                </span>
              )}
            </button>
          ),
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6B7280]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded border border-[#FCD34D] bg-[#FFFBEB]" />
          손 없는 날 (음력 9·10·19·20·29·30일)
        </span>
        <span>작은 숫자는 음력</span>
      </div>

      <div className="mt-2 rounded-xl bg-[#F5F7FB] px-3 py-2 text-[13px] font-semibold text-[#111827]">
        {value ? `선택한 이사 날짜 · ${value}` : "이사 날짜를 선택해 주세요"}
      </div>
    </div>
  );
}
