import type { ReactNode } from "react";
import { ChevronLeft, Home, ClipboardList, Users, Settings as SettingsIcon, Minus, Plus } from "lucide-react";
import { useApp, type Screen } from "@/lib/jimpick";

export function StatusBar() {
  return (
    <div className="flex items-center justify-between px-6 pt-2 pb-1 text-[13px] font-semibold text-foreground">
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <span>●●●●</span>
        <span>📶</span>
        <span>🔋</span>
      </span>
    </div>
  );
}

export function MobileShell({ children, bg = "bg-[#F5F7FB]" }: { children: ReactNode; bg?: string }) {
  return (
    <div className="min-h-screen w-full flex justify-center bg-slate-200">
      <div className={`w-full max-w-[430px] min-h-screen ${bg} relative shadow-xl flex flex-col`}>
        <StatusBar />
        {children}
      </div>
    </div>
  );
}

export function TopBar({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="flex items-center px-4 py-3 bg-white border-b border-[#E7EBF2]">
      {onBack && (
        <button onClick={onBack} className="p-2 -ml-2" aria-label="이전">
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
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-4 rounded-2xl text-white text-lg font-bold shadow-[0_6px_20px_rgba(15,23,42,0.10)] disabled:opacity-50 ${className}`}
      style={{
        background: "linear-gradient(135deg, #287BFF 0%, #0751D8 100%)",
      }}
    >
      {children}
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
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-10 h-10 rounded-full bg-[#F5F7FB] border border-[#E7EBF2] flex items-center justify-center active:bg-[#E7EBF2]"
        aria-label="감소"
      >
        <Minus className="w-5 h-5" />
      </button>
      <span className="text-xl font-bold w-8 text-center">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-10 h-10 rounded-full flex items-center justify-center text-white active:opacity-80"
        style={{ background: "linear-gradient(135deg, #287BFF 0%, #0751D8 100%)" }}
        aria-label="증가"
      >
        <Plus className="w-5 h-5" />
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
            onClick={() => setScreen(key)}
            className="flex-1 py-3 flex flex-col items-center gap-1"
          >
            <Icon className={`w-6 h-6 ${active ? "text-[#0751D8]" : "text-[#6B7280]"}`} />
            <span className={`text-xs font-semibold ${active ? "text-[#0751D8]" : "text-[#6B7280]"}`}>
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
      onClick={onClick}
      className={`rounded-2xl bg-white border p-4 transition ${
        selected ? "border-[#287BFF] bg-[#EEF4FF] ring-2 ring-[#287BFF]/20" : "border-[#E7EBF2]"
      } ${onClick ? "cursor-pointer active:scale-[0.98]" : ""} ${className}`}
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
      className={`w-full px-4 py-3 rounded-xl border border-[#E7EBF2] bg-white text-base focus:outline-none focus:border-[#287BFF] ${props.className ?? ""}`}
    />
  );
}
