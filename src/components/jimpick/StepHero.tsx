/**
 * 새 단계 화면 머리 영역 — 진행 표시선, 왼쪽 정렬 제목, 말풍선, 큰 공식 캐릭터.
 * 캐릭터는 고정 너비·높이로 자리를 먼저 잡아 로딩 중 화면이 움직이지 않습니다.
 */
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { CharacterImg, type CharacterPose } from "./CharacterGuide";
import { tap } from "@/lib/feedback";

export function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <ol className="jp-step-progress" aria-label={`전체 ${total}단계 중 ${current}단계`}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <li key={n} data-state={n < current ? "done" : n === current ? "current" : "todo"} aria-current={n === current ? "step" : undefined}>
          <span className="sr-only">{n}단계</span>
        </li>
      ))}
    </ol>
  );
}

export function StepHero({ step, total, title, bubble, pose, onBack }: {
  step: number; total: number; title: string; bubble: string; pose: CharacterPose; onBack?: () => void;
}) {
  return (
    <header className="jp-step-hero">
      <div className="flex items-center gap-2">
        {onBack && (
          <button type="button" aria-label="뒤로" onClick={() => { tap("soft"); onBack(); }} className="jp-hero-back">
            <ChevronLeft className="h-6 w-6" strokeWidth={2.4} />
          </button>
        )}
        <div className="min-w-0 flex-1"><StepProgress current={step} total={total} /></div>
        {onBack && <span aria-hidden className="w-11 shrink-0" />}
      </div>
      <h1 className="jp-hero-title"><span>{step}단계</span> {title}</h1>
      <div className="jp-hero-stage">
        <p className="jp-hero-bubble">{bubble}</p>
        <CharacterImg pose={pose} size={168} priority className="jp-hero-char" />
      </div>
    </header>
  );
}

/** 흰색 둥근 입력 카드 */
export function FormCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`jp-form-card ${className}`}>{children}</section>;
}

/** 왼쪽 아이콘+항목명, 오른쪽 입력 (stack이면 입력을 아래 줄에) */
export function FormRow({ icon, label, children, stack = false }: { icon: ReactNode; label: string; children: ReactNode; stack?: boolean }) {
  return (
    <div className={stack ? "jp-form-row jp-form-row-stack" : "jp-form-row"}>
      <div className="jp-form-label"><span aria-hidden className="jp-form-icon">{icon}</span><span>{label}</span></div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
