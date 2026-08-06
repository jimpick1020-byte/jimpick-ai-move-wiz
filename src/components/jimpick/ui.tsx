import { useEffect, useRef, type ReactNode } from "react";
import {
  ChevronLeft,
  Home,
  ClipboardList,
  Users,
  Settings as SettingsIcon,
  Minus,
  Plus,
} from "lucide-react";
import { useApp, type Screen } from "@/lib/jimpick";
import { tap } from "@/lib/feedback";

/**
 * 시안용 가짜 상태바.
 * 홈 화면에서 앱처럼 실행할 때는 진짜 상태바가 이미 있으므로 숨깁니다.
 * (styles.css 의 `@media (display-mode: standalone)` 참고)
 */
export function StatusBar() {
  return (
    <div className="jp-mock-statusbar flex items-center justify-between px-6 pt-2 pb-1 text-[13px] font-semibold text-foreground">
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <span>●●●●</span>
        <span>📶</span>
        <span>🔋</span>
      </span>
    </div>
  );
}

const NEON_GRADIENT =
  "conic-gradient(from var(--jp-angle), #ff007f, #7928ca, #00dfd8, #7928ca, #ff007f)";

export function MobileShell({
  children,
  bg = "bg-[#F5F7FB]",
}: {
  children: ReactNode;
  bg?: string;
}) {
  return (
    <div className="min-h-[100dvh] w-full flex justify-center bg-slate-200">
      <div className="relative w-full max-w-md p-[3px]">
        {/* 정적 네온 테두리 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[26px]"
          style={{ background: NEON_GRADIENT }}
        />
        <div
          className={`relative w-full min-h-[100dvh] ${bg} rounded-[24px] overflow-hidden flex flex-col shadow-[0_20px_40px_-24px_rgba(7,81,216,0.3)]`}
        >
          <StatusBar />
          {children}
        </div>
      </div>
    </div>
  );
}

export function TopBar({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="flex items-center px-4 py-3 bg-white border-b border-[#E7EBF2]">
      {onBack && (
        <button
          onClick={onBack}
          className="mr-1 w-10 h-10 rounded-2xl bg-gradient-to-b from-white to-[#F1F6FF] border border-[#DCE8FA] flex items-center justify-center text-[#0751D8] shadow-[0_4px_0_#DCE8FA,0_10px_18px_-10px_rgba(7,81,216,0.5),inset_0_1px_0_#fff] transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_#DCE8FA]"
          aria-label="이전"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      <h1 className="text-lg font-bold text-[#111827] flex-1 text-center pr-8">{title}</h1>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={() => {
        tap("click");
        onClick?.();
      }}
      disabled={disabled}
      className={`relative w-full py-4 rounded-2xl text-white text-lg font-bold overflow-hidden transition-transform active:translate-y-[2px] active:shadow-[0_2px_0_#0645B0,0_6px_14px_rgba(7,81,216,0.25)] shadow-[0_5px_0_#0645B0,0_14px_26px_rgba(7,81,216,0.32)] disabled:opacity-50 disabled:shadow-none ${className}`}
      style={{
        background: "linear-gradient(180deg, #4A94FF 0%, #287BFF 45%, #0751D8 100%)",
      }}
    >
      <span className="pointer-events-none absolute inset-x-1 top-1 h-1/3 rounded-2xl bg-white/25 blur-[1px]" />
      <span className="relative">{children}</span>
    </button>
  );
}

export function BottomButtonBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 mt-auto p-4 bg-white border-t border-[#E7EBF2] pb-[max(1rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}

export function Counter({
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const timers = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval> }>(
    {},
  );
  const valueRef = useRef(value);
  valueRef.current = value;

  const clear = () => {
    if (timers.current.t) clearTimeout(timers.current.t);
    if (timers.current.i) clearInterval(timers.current.i);
    timers.current = {};
  };
  useEffect(() => clear, []);

  const step = (dir: 1 | -1) => {
    const next =
      dir === 1 ? Math.min(max, valueRef.current + 1) : Math.max(min, valueRef.current - 1);
    if (next === valueRef.current) return;
    valueRef.current = next;
    onChange(next);
  };

  const hold = (dir: 1 | -1) => {
    tap("soft");
    step(dir);
    clear();
    // 길게 누르면 숫자가 계속 올라가/내려갑니다
    timers.current.t = setTimeout(() => {
      timers.current.i = setInterval(() => step(dir), 80);
    }, 400);
  };

  return (
    <div className="flex items-center gap-3 select-none">
      <button
        onPointerDown={() => hold(-1)}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        className="w-10 h-10 rounded-full bg-gradient-to-b from-white to-[#EDF1F8] border border-[#DCE3EE] shadow-[0_3px_0_#DCE3EE,0_6px_12px_rgba(15,23,42,0.08)] flex items-center justify-center transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_#DCE3EE] touch-none"
        aria-label="감소"
      >
        <Minus className="w-5 h-5 text-[#334155]" />
      </button>
      <span className="text-xl font-bold w-8 text-center tabular-nums">{value}</span>
      <button
        onPointerDown={() => hold(1)}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-[0_3px_0_#0645B0,0_8px_16px_rgba(7,81,216,0.3)] transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_#0645B0] touch-none"
        style={{ background: "linear-gradient(180deg, #4A94FF 0%, #0751D8 100%)" }}
        aria-label="증가"
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}

/** 금액 입력 — 1,000원 단위 스텝 + 천단위 콤마 표시 */
export function MoneyInput({
  value,
  onChange,
  step = 10000,
  placeholder = "0",
  className = "",
  inputClassName = "",
  allowNegative = false,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  placeholder?: string;
  className?: string;
  /** 입력창에 추가할 클래스 */
  inputClassName?: string;
  /** 음수 입력 허용 (할인 금액 등) */
  allowNegative?: boolean;
}) {
  const timers = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval> }>(
    {},
  );
  const valueRef = useRef(value);
  valueRef.current = value;

  const clear = () => {
    if (timers.current.t) clearTimeout(timers.current.t);
    if (timers.current.i) clearInterval(timers.current.i);
    timers.current = {};
  };
  useEffect(() => clear, []);

  const bump = (dir: 1 | -1) => {
    const base = Math.round(valueRef.current / step) * step;
    const raw = base + dir * step;
    const next = allowNegative ? raw : Math.max(0, raw);
    if (next === valueRef.current) return;
    valueRef.current = next;
    onChange(next);
  };

  // 길게 누르면 금액이 계속 증가/감소합니다
  const hold = (dir: 1 | -1) => {
    tap("soft");
    bump(dir);
    clear();
    timers.current.t = setTimeout(() => {
      timers.current.i = setInterval(() => bump(dir), 100);
    }, 400);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onPointerDown={() => hold(-1)}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-b from-white to-[#EDF1F8] border border-[#DCE3EE] shadow-[0_3px_0_#DCE3EE] flex items-center justify-center active:translate-y-[2px] active:shadow-none touch-none"
        aria-label="금액 감소"
      >
        <Minus className="w-4 h-4 text-[#334155]" />
      </button>
      <div className="relative flex-1">
        <TextInput
          inputMode="numeric"
          placeholder={placeholder}
          value={value ? value.toLocaleString("ko-KR") : ""}
          onChange={(e) => {
            const t = e.target.value;
            const neg = allowNegative && /^\s*-/.test(t);
            const n = Number(t.replace(/[^\d]/g, "")) || 0;
            onChange(neg ? -n : allowNegative ? n : Math.max(0, n));
          }}
          className={`pr-8 text-right font-bold tabular-nums ${inputClassName}`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">원</span>
      </div>
      <button
        type="button"
        onPointerDown={() => hold(1)}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white shadow-[0_3px_0_#0645B0] active:translate-y-[2px] active:shadow-none touch-none"
        style={{ background: "linear-gradient(180deg, #4A94FF 0%, #0751D8 100%)" }}
        aria-label="금액 증가"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

export function BottomNav() {
  const { screen, setScreen } = useApp();
  const items: { key: Screen; icon: typeof Home; label: string }[] = [
    { key: "home", icon: Home, label: "홈" },
    { key: "history", icon: ClipboardList, label: "견적" },
    { key: "customers", icon: Users, label: "고객" },
    { key: "settings", icon: SettingsIcon, label: "설정" },
  ];
  return (
    <div className="sticky bottom-0 mt-auto bg-white border-t border-[#E7EBF2] flex pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {items.map(({ key, icon: Icon, label }) => {
        const active = screen === key;
        return (
          <button
            key={key}
            onClick={() => {
              tap("soft");
              setScreen(key);
            }}
            className="flex-1 py-3 flex flex-col items-center gap-1"
          >
            <Icon className={`w-6 h-6 ${active ? "text-[#0751D8]" : "text-[#6B7280]"}`} />
            <span
              className={`text-xs font-semibold ${active ? "text-[#0751D8]" : "text-[#6B7280]"}`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Card({
  children,
  selected,
  onClick,
  className = "",
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={
        onClick
          ? () => {
              tap("soft");
              onClick();
            }
          : undefined
      }
      className={`rounded-2xl border p-4 transition-all duration-200 ${
        selected
          ? "border-[#287BFF] bg-gradient-to-b from-[#F5F9FF] to-[#DEEAFF] shadow-[0_14px_26px_-10px_rgba(40,123,255,0.45),0_3px_0_#BBD3FF,inset_0_1px_0_#FFFFFF] ring-2 ring-[#287BFF]/30"
          : "border-[#DFE6F2] bg-gradient-to-b from-white to-[#F2F6FD] shadow-[0_10px_22px_-8px_rgba(15,23,42,0.18),0_2px_0_#E3E9F5,inset_0_1px_0_#FFFFFF]"
      } ${onClick ? "cursor-pointer active:scale-[0.98] active:shadow-[0_2px_8px_rgba(15,23,42,0.08)]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-[#111827]">{label}</label>
      {children}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-3 rounded-xl border border-[#DFE6F2] bg-gradient-to-b from-[#F8FAFD] to-white text-base shadow-[inset_0_2px_4px_rgba(15,23,42,0.06)] focus:outline-none focus:border-[#287BFF] focus:shadow-[inset_0_2px_4px_rgba(15,23,42,0.06),0_0_0_3px_rgba(40,123,255,0.15)] ${props.className ?? ""}`}
    />
  );
}
