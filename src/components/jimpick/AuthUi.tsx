import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { ChevronLeft, LoaderCircle } from "lucide-react";
import logoImg from "@/assets/jimpick-logo.png";
import { Button } from "@/components/ui/button";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] w-full overflow-x-hidden bg-auth-canvas text-auth-text">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-background sm:my-8 sm:min-h-[calc(100dvh-4rem)] sm:overflow-hidden sm:rounded-lg sm:border sm:border-auth-border sm:shadow-auth">
        {children}
      </div>
    </main>
  );
}

export function AuthTopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="grid min-h-16 grid-cols-[44px_1fr_44px] items-center border-b border-auth-border bg-background px-4">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label="뒤로가기"
        className="size-11 rounded-md text-auth-primary focus-visible:ring-2 focus-visible:ring-auth-primary"
      >
        <ChevronLeft className="size-6" />
      </Button>
      <h1 className="text-center text-xl font-bold text-auth-text">{title}</h1>
      <span aria-hidden />
    </header>
  );
}

export function AuthField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[15px] font-semibold text-auth-text">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-auth-error">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="text-sm leading-5 text-auth-muted">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function AuthInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-[52px] w-full rounded-[14px] border border-auth-border bg-background px-4 text-base text-auth-text outline-none transition placeholder:text-auth-muted focus:border-auth-primary focus:ring-[3px] focus:ring-auth-focus disabled:bg-auth-soft disabled:text-auth-muted ${className}`}
    />
  );
}

export function AuthPrimaryButton({
  children,
  busy = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <Button
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy}
      className={`h-14 w-full rounded-[14px] bg-auth-primary text-lg font-bold text-auth-primary-foreground shadow-auth-button hover:bg-auth-primary-pressed active:bg-auth-primary-pressed focus-visible:ring-2 focus-visible:ring-auth-primary focus-visible:ring-offset-2 disabled:bg-auth-disabled disabled:opacity-100 ${props.className ?? ""}`}
    >
      {busy && <LoaderCircle aria-hidden className="size-5 animate-spin" />}
      {children}
    </Button>
  );
}

export function AuthLoadingScreen({ onRetry }: { onRetry: () => void }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 10_000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-auth-canvas px-4">
      <div className="flex max-w-sm flex-col items-center text-center" aria-live="polite">
        <img src={logoImg} alt="JIMPICK" className="size-16 object-contain" />
        <div className="mt-6 size-7 animate-spin rounded-full border-[3px] border-auth-border border-t-auth-primary" aria-hidden />
        <p className="mt-4 text-base font-semibold text-auth-text">로그인 상태를 확인하고 있습니다.</p>
        {slow && (
          <div className="mt-5 space-y-3">
            <p role="alert" className="text-sm leading-5 text-auth-muted">
              확인이 평소보다 오래 걸리고 있습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.
            </p>
            <Button type="button" variant="outline" onClick={onRetry} className="h-11 border-auth-border px-5 text-auth-primary">
              다시 시도
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}