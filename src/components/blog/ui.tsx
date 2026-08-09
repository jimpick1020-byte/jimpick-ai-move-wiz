/*
 * AI 부동산 블로그 — 공용 UI 조각 (모바일 우선, 화이트+퍼플)
 */
import type { ReactNode } from "react";
import { Check } from "lucide-react";

/** 선택형 칩 버튼 (선택 시 보라색) */
export function Chip({
  active,
  onClick,
  children,
  size = "md",
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border font-medium transition-all active:scale-95",
        size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-4 py-2 text-sm",
        active
          ? "border-violet-600 bg-violet-600 text-white shadow-sm shadow-violet-200"
          : "border-violet-200 bg-white text-violet-900 hover:border-violet-400 hover:bg-violet-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** 큰 거래유형 버튼 */
export function BigTypeButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-2xl border-2 py-3.5 text-base font-bold transition-all active:scale-95",
        active
          ? "border-violet-600 bg-violet-600 text-white shadow-md shadow-violet-200"
          : "border-violet-200 bg-white text-violet-700 hover:bg-violet-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** 카드 */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-violet-100 bg-white p-4 shadow-sm shadow-violet-100/50 ${className}`}>
      {children}
    </div>
  );
}

/** 섹션 제목 */
export function SectionTitle({ step, title, desc }: { step?: number; title: string; desc?: string }) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      {step != null && (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
          {step}
        </span>
      )}
      <div>
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {desc && <p className="mt-0.5 text-sm text-slate-500">{desc}</p>}
      </div>
    </div>
  );
}

/** 큰 보라색 기본 버튼 */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-4 text-base font-bold text-white shadow-lg shadow-violet-300/50 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none ${className}`}
    >
      {children}
    </button>
  );
}

/** 보조(외곽선) 버튼 */
export function GhostButton({
  children,
  onClick,
  className = "",
  tone = "violet",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  tone?: "violet" | "green" | "slate";
}) {
  const tones = {
    violet: "border-violet-300 text-violet-700 hover:bg-violet-50",
    green: "border-green-400 text-green-700 hover:bg-green-50",
    slate: "border-slate-300 text-slate-600 hover:bg-slate-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl border bg-white px-5 py-3.5 text-base font-semibold transition-all active:scale-[0.98] ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

/** 라벨 입력 */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  wide,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? "col-span-2" : ""}`}>
      <span className="text-[13px] font-semibold text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-[15px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
      />
    </label>
  );
}

/** 진행 단계 표시 */
const STEPS = ["사진 촬영", "AI 작성", "미리보기", "승인", "업로드"];
export function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-between gap-1">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-center">
              <div className={`h-1 flex-1 rounded ${i === 0 ? "opacity-0" : done || active ? "bg-violet-500" : "bg-violet-100"}`} />
              <span
                className={[
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  done ? "bg-violet-500 text-white" : active ? "bg-violet-600 text-white ring-4 ring-violet-100" : "bg-violet-100 text-violet-400",
                ].join(" ")}
              >
                {done ? <Check size={13} /> : i + 1}
              </span>
              <div className={`h-1 flex-1 rounded ${i === STEPS.length - 1 ? "opacity-0" : done ? "bg-violet-500" : "bg-violet-100"}`} />
            </div>
            <span className={`text-[10px] font-medium ${active ? "text-violet-700" : "text-slate-400"}`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** 체크 기능 항목 (상단 우측 표시용) */
export function FeatureCheck({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-1.5 text-[12px] leading-snug text-violet-100">
      <Check size={14} className="mt-0.5 shrink-0 text-green-300" />
      <span>{children}</span>
    </li>
  );
}
