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
import { useApp, useAppSafe, type Screen } from "@/lib/jimpick";
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

// 형광색을 쓰지 않고, 차분한 파란색·연회색으로 은은한 테두리를 만듭니다.
const NEON_GRADIENT =
  "conic-gradient(from var(--jp-angle), #3578C8, #A9C3E4, #E5E7EB, #A9C3E4, #3578C8)";

/**
 * 작성 중인 견적 자동 임시저장 알림.
 * 저장 중 · 저장 완료 · 저장 실패를 알려 줍니다. 입력한 값은 어떤 경우에도 지우지 않습니다.
 */
export function DraftSaveBadge() {
  const app = useAppSafe();
  const state = app?.draftSaveState ?? "idle";
  if (!app || state === "idle") return null;
  const text =
    state === "saving"
      ? "임시저장 중…"
      : state === "saved"
        ? "임시저장 완료"
        : state === "offline"
          ? "인터넷 연결을 기다립니다 · 입력은 그대로 있습니다"
          : "임시저장 실패 · 연결되면 다시 저장합니다";
  const tone =
    state === "saved"
      ? "bg-[#E7F3EE] text-[#3E9B78]"
      : state === "saving"
        ? "bg-[#F7F8F5] text-[#25282D]"
        : "bg-[#FEF3C7] text-[#B45309]";
  return (
    <div className="px-4 pt-1" aria-live="polite">
      <span className={`inline-block rounded-full px-2 py-0.5 text-[12px] font-semibold ${tone}`}>
        {text}
      </span>
    </div>
  );
}

export function MobileShell({
  children,
  bg = "bg-[#F7F8F5]",
  className = "",
}: {
  children: ReactNode;
  bg?: string;
  className?: string;
}) {
  // jp-shell-* 클래스는 홈 화면에서 앱처럼 실행할 때(standalone)
  // 시안용 폰 테두리를 걷어내기 위한 것입니다. (styles.css 참고)
  return (
    <div
      className={`jp-shell-outer min-h-[100dvh] w-full flex justify-center bg-slate-200 ${className}`}
    >
      <div className="jp-shell-frame relative w-full max-w-md p-[3px]">
        {/* 정적 네온 테두리 */}
        <div
          aria-hidden
          className="jp-shell-neon pointer-events-none absolute inset-0 rounded-[26px]"
          style={{ background: NEON_GRADIENT }}
        />
        <div
          className={`jp-shell-inner relative w-full min-h-[100dvh] ${bg} rounded-[24px] overflow-hidden flex flex-col shadow-[0_20px_40px_-24px_rgba(7,81,216,0.3)]`}
        >
          <StatusBar />
          <DraftSaveBadge />
          {children}
        </div>
      </div>
    </div>
  );
}

export function TopBar({
  title,
  onBack,
  /** 작성 중인 내용이 사라질 수 있으면 이 문구로 먼저 물어봅니다 */
  confirmBack,
}: {
  title: string;
  onBack?: () => void;
  confirmBack?: string;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-[#E5E7EB] bg-white px-4 py-3">
      {onBack && (
        <button
          onClick={() => {
            if (confirmBack && !window.confirm(confirmBack)) return;
            tap("soft");
            onBack();
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-gradient-to-b from-white to-[#F7F8F5] text-[#25282D] shadow-[0_3px_0_#E5E7EB,inset_0_1px_0_#fff] transition-transform active:translate-y-[2px] active:shadow-none"
          aria-label="뒤로"
        >
          <ChevronLeft className="h-[24px] w-[24px]" strokeWidth={2.2} />
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-center text-[20px] font-black text-[#25282D]">
        {title}
      </h1>
      {/* 제목이 가운데 오도록 뒤로가기 버튼과 같은 너비를 비워 둡니다 */}
      {onBack && <span aria-hidden className="w-11 shrink-0" />}
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
      className={`relative w-full py-4 rounded-2xl text-white text-lg font-bold overflow-hidden transition-transform active:translate-y-[2px] active:shadow-[0_2px_0_#285C99,0_6px_14px_rgba(7,81,216,0.25)] shadow-[0_5px_0_#285C99,0_14px_26px_rgba(7,81,216,0.32)] disabled:opacity-50 disabled:shadow-none ${className}`}
      style={{
        background: "linear-gradient(180deg, #5B93D6 0%, #3578C8 45%, #3578C8 100%)",
      }}
    >
      <span className="pointer-events-none absolute inset-x-1 top-1 h-1/3 rounded-2xl bg-white/25 blur-[1px]" />
      <span className="relative">{children}</span>
    </button>
  );
}

export function BottomButtonBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 mt-auto p-4 bg-white border-t border-[#E5E7EB] pb-[max(1rem,env(safe-area-inset-bottom))]">
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
        className="w-10 h-10 rounded-full bg-gradient-to-b from-white to-[#F7F8F5] border border-[#E5E7EB] shadow-[0_3px_0_#E5E7EB,0_6px_12px_rgba(15,23,42,0.08)] flex items-center justify-center transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_#E5E7EB] touch-none"
        aria-label="감소"
      >
        <Minus className="w-5 h-5 text-[#6B7280]" />
      </button>
      <span className="text-xl font-bold w-8 text-center tabular-nums">{value}</span>
      <button
        onPointerDown={() => hold(1)}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-[0_3px_0_#285C99,0_8px_16px_rgba(7,81,216,0.3)] transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_#285C99] touch-none"
        style={{ background: "linear-gradient(180deg, #5B93D6 0%, #3578C8 100%)" }}
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
        className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-b from-white to-[#F7F8F5] border border-[#E5E7EB] shadow-[0_3px_0_#E5E7EB] flex items-center justify-center active:translate-y-[2px] active:shadow-none touch-none"
        aria-label="금액 감소"
      >
        <Minus className="w-4 h-4 text-[#6B7280]" />
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
        className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white shadow-[0_3px_0_#285C99] active:translate-y-[2px] active:shadow-none touch-none"
        style={{ background: "linear-gradient(180deg, #5B93D6 0%, #3578C8 100%)" }}
        aria-label="금액 증가"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * 관리자 첫 화면 위쪽 메뉴 — 견적 · 고객 · 설정.
 *
 * 화면 이동은 기존 setScreen 을 그대로 씁니다 (새 화면을 만들지 않습니다).
 * 고객에게 나가는 공유 견적서 화면에서는 쓰지 않습니다.
 */
export function AdminTopNav() {
  const { screen, setScreen } = useApp();
  const items: { key: Screen; icon: typeof Home; label: string }[] = [
    { key: "history", icon: ClipboardList, label: "견적" },
    { key: "customers", icon: Users, label: "고객" },
    { key: "settings", icon: SettingsIcon, label: "설정" },
  ];
  return (
    <div className="flex gap-2 px-4 pb-1 pt-2">
      {items.map(({ key, icon: Icon, label }) => {
        const active = screen === key;
        return (
          <button
            key={key}
            onClick={() => {
              tap("soft");
              setScreen(key);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[14px] py-3 text-[18px] font-black transition-transform active:translate-y-[2px] ${
              active
                ? "bg-gradient-to-b from-[#3578C8] to-[#2C63A8] text-white shadow-[0_4px_0_#285C99]"
                : "border border-[#E5E7EB] bg-white text-[#25282D] shadow-[0_3px_0_#F7F8F5]"
            }`}
          >
            <Icon className="h-[20px] w-[20px] shrink-0" strokeWidth={1.9} />
            <span className="whitespace-nowrap">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * 관리자 화면 뒤로가기.
 *
 * 이전 화면이 있으면 그리로 가고, 바로 들어와 기록이 없으면 첫 화면으로 갑니다.
 * 작성 중인 내용이 사라질 수 있으면 먼저 물어봅니다.
 */
export function AdminBackButton({
  to,
  confirmMessage,
  className = "",
}: {
  /** 돌아갈 화면 (없으면 홈) */
  to?: Screen;
  /** 값이 있으면 이동 전에 이 문구로 확인합니다 */
  confirmMessage?: string;
  className?: string;
}) {
  const { setScreen } = useApp();
  const go = () => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    tap("soft");
    if (to) {
      setScreen(to);
      return;
    }
    // 브라우저 뒤로가기 기록이 있으면 그것을 씁니다 (갤럭시 크롬 포함)
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      // 기록이 앱 밖이면 첫 화면으로 되돌립니다
      window.setTimeout(() => setScreen("home"), 350);
      return;
    }
    setScreen("home");
  };
  return (
    <button
      onClick={go}
      aria-label="뒤로"
      className={`inline-flex items-center gap-1 rounded-[14px] border border-[#E5E7EB] bg-white px-3 py-2 text-[18px] font-black text-[#25282D] shadow-[0_3px_0_#F7F8F5] transition-transform active:translate-y-[2px] active:shadow-none ${className}`}
    >
      <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.2} />
      뒤로
    </button>
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
    <div className="sticky bottom-0 mt-auto bg-white border-t border-[#E5E7EB] flex pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
            <Icon className={`w-6 h-6 ${active ? "text-[#3578C8]" : "text-[#6B7280]"}`} />
            <span
              className={`text-xs font-semibold ${active ? "text-[#3578C8]" : "text-[#6B7280]"}`}
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
          ? "border-[#3578C8] bg-gradient-to-b from-[#F7F8F5] to-[#D7E5F5] shadow-[0_14px_26px_-10px_rgba(40,123,255,0.45),0_3px_0_#E5E7EB,inset_0_1px_0_#FFFFFF] ring-2 ring-[#3578C8]/30"
          : "border-[#E5E7EB] bg-gradient-to-b from-white to-[#F7F8F5] shadow-[0_10px_22px_-8px_rgba(15,23,42,0.18),0_2px_0_#E5E7EB,inset_0_1px_0_#FFFFFF]"
      } ${onClick ? "cursor-pointer active:scale-[0.98] active:shadow-[0_2px_8px_rgba(15,23,42,0.08)]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
  labelClassName,
}: {
  label: string;
  children: ReactNode;
  /** 항목명 색을 바꿀 때 (없으면 기본 파란색) */
  labelClassName?: string;
}) {
  return (
    <div className="space-y-2">
      <label
        className={`jp-field-label text-[17px] font-black ${labelClassName ?? "text-[#25282D]"}`}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-gradient-to-b from-[#F8FAFD] to-white text-[18px] font-bold text-[#25282D] placeholder:text-[#7C899D] shadow-[inset_0_2px_4px_rgba(15,23,42,0.06)] focus:outline-none focus:border-[#3578C8] focus:shadow-[inset_0_2px_4px_rgba(15,23,42,0.06),0_0_0_3px_rgba(40,123,255,0.15)] ${props.className ?? ""}`}
    />
  );
}
