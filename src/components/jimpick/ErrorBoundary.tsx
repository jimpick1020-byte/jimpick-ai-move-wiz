/**
 * 화면 오류를 잡아 주는 안전망.
 *
 *  - 화면이 하얗게 되지 않고 안내 화면을 보여 줍니다.
 *  - 어떤 화면에서 언제 어떤 오류가 났는지만 서버에 남깁니다(개인정보는 저장하지 않습니다).
 *  - "다시 시도" 와 "마지막 저장 상태로 되돌리기" 버튼을 제공합니다.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { logAppError } from "@/lib/error-log.functions";
import { restoreSafeSnapshot, safeSnapshotAt } from "@/lib/safe-state";
import { reportLovableError } from "@/lib/lovable-error-reporting";

interface Props {
  children: ReactNode;
  /** 오류가 난 화면 이름 (예: step3) */
  screen: string;
}
interface State {
  error: Error | null;
  savedAt: number | null;
}

export class JimpickErrorBoundary extends Component<Props, State> {
  state: State = { error: null, savedAt: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportLovableError(error, { boundary: "jimpick_screen" });
    this.setState({ savedAt: safeSnapshotAt() });
    void logAppError({
      data: {
        screen: this.props.screen,
        kind: "render",
        message: error.message || "화면 오류",
        detail: (info.componentStack ?? "").slice(0, 1200),
        recovery: "none",
        attempts: 0,
      },
    }).catch(() => {
      /* 기록 실패는 화면을 막지 않습니다 */
    });
  }

  componentDidUpdate(prev: Props) {
    // 다른 화면으로 넘어가면 안내 화면을 닫습니다.
    if (prev.screen !== this.props.screen && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error, savedAt } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FC] px-4">
        <div className="w-full max-w-[420px] space-y-4 rounded-3xl bg-white p-6 shadow-[0_10px_30px_rgba(8,100,220,0.10)]">
          <div className="text-lg font-bold text-[#25282D] break-keep">
            화면을 여는 중 문제가 생겼습니다
          </div>
          <p className="text-sm leading-6 text-[#6B7280] break-keep">
            입력하신 내용은 자동 저장되어 있습니다. 아래 버튼으로 다시 시도해 주세요.
          </p>
          <div className="rounded-xl bg-[#F9FAFB] px-3 py-2 text-xs text-[#6B7280] break-all">
            {error.message || "알 수 없는 오류"}
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="w-full rounded-2xl bg-[#3578C8] py-3.5 text-sm font-bold text-white"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={() => {
                restoreSafeSnapshot();
                window.location.reload();
              }}
              disabled={savedAt === null}
              className="w-full rounded-2xl border border-[#D1D5DB] bg-white py-3.5 text-sm font-bold text-[#6B7280] disabled:opacity-50"
            >
              {savedAt === null
                ? "되돌릴 저장 상태가 없습니다"
                : `마지막 저장 상태로 되돌리기 (${new Date(savedAt).toLocaleTimeString("ko-KR")})`}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2 text-xs font-bold text-[#6B7280] underline"
            >
              새로고침
            </button>
          </div>
        </div>
      </div>
    );
  }
}
