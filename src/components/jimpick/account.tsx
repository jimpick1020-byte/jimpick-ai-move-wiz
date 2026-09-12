import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, authHeader } from "@/lib/auth";
import { lovable } from "@/integrations/lovable/index";
import { useApp, won } from "@/lib/jimpick";
import { MobileShell, TopBar, Card, Field, TextInput, PrimaryButton, BottomButtonBar } from "@/components/jimpick/ui";
import { PLANS, getMyAccount, subscribePlan, cancelSubscription, type PlanId } from "@/lib/subscription.functions";
import { tap } from "@/lib/feedback";
import { Check, Crown, CreditCard, LogOut } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AuthField, AuthInput, AuthPrimaryButton, AuthShell, AuthTopBar } from "./AuthUi";

/** 로그인한 Cloud 사용자 세션 */
export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setEmail(session?.user?.email ?? "");
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setEmail(data.session?.user?.email ?? "");
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { userId, email, loading };
}

// ============ 회원가입 / 구독 계정 만들기 ============
export function SignupScreen() {
  const { setScreen, login } = useApp();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [owner, setOwner] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  /** 인증 메일을 보낸 주소 — 있으면 '인증메일 다시 보내기' 안내를 띄웁니다 */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);
  const [formError, setFormError] = useState("");

  const normalizedEmail = email.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const hasLength = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const commonPassword = /^(password|password1|qwerty|12345678|11111111|abc12345)$/i.test(password);
  const passwordValid = hasLength && hasLetter && hasNumber && !commonPassword;
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = /^01[016789]\d{7,8}$/.test(phoneDigits);
  const requiredComplete = emailValid && passwordValid && company.trim().length > 0 && owner.trim().length > 0 && phoneValid;
  const canSubmit = mode === "signin" ? emailValid && password.length > 0 : requiredComplete && termsAccepted && privacyAccepted;

  const formatSignupPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, digits.length === 10 ? 6 : 7)}-${digits.slice(digits.length === 10 ? 6 : 7)}`;
  };

  const submit = async () => {
    if (busy) return; // 연속 클릭으로 중복 요청되지 않게 잠급니다
    setFormError("");
    if (!emailValid) {
      setFormError("이메일 주소를 정확히 입력해 주세요.");
      return;
    }
    if (mode === "signup" && !passwordValid) {
      setFormError("비밀번호 조건을 모두 충족해 주세요.");
      return;
    }
    if (mode === "signup" && (!requiredComplete || !termsAccepted || !privacyAccepted)) {
      setFormError("필수 정보와 필수 동의를 확인해 주세요.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            // 게시 주소로 돌아오게 합니다 (게시: https://jimpick-ai-move-wiz.lovable.app,
            // 미리보기: lovable 프리뷰 주소). 어느 쪽이든 지금 접속한 주소로 맞춰집니다.
            emailRedirectTo: window.location.origin,
            data: {
              company_name: company.trim(),
              owner_name: owner.trim(),
              phone,
              terms_accepted: termsAccepted,
              privacy_accepted: privacyAccepted,
              marketing_accepted: marketingAccepted,
              consent_accepted_at: new Date().toISOString(),
              consent_version: "2026-09-13",
            },
          },
        });
        if (error) throw error;

        // 이미 가입된(인증 완료된) 이메일이면 Supabase 는 계정 노출을 막기 위해
        // 오류 없이 identities 가 빈 user 를 돌려주고, 메일도 보내지 않습니다.
        // 이때 "메일 보냈습니다" 라고 하면 거짓 안내가 되므로 로그인으로 안내합니다.
        const identities = data.user?.identities;
        if (data.user && Array.isArray(identities) && identities.length === 0) {
          toast.error("이미 가입된 이메일입니다. 아래에서 '로그인'으로 들어가 주세요.");
          setMode("signin");
          return;
        }

        // 이메일 확인이 켜져 있으면 세션 없이 user 만 옵니다 → 인증 메일이 실제로 발송된 상태.
        // 세션이 없으면 구독 화면으로 넘기지 않고 인증 대기 안내를 띄웁니다.
        if (!data.session) {
          setPendingEmail(email);
          toast.success("인증 메일을 보냈습니다. 메일의 링크를 눌러 인증해 주세요.");
          setMode("signin");
          return;
        }

        // 이메일 확인이 꺼져 있어 바로 세션이 생긴 경우만 로그인 처리합니다.
        toast.success("가입 완료! 3일 무료 체험이 시작되었습니다");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) {
          // 인증이 끝나지 않은 계정이면 '인증메일 다시 보내기' 안내를 띄웁니다.
          if (/email not confirmed|not confirmed/i.test(error.message)) {
            setPendingEmail(email);
          }
          throw error;
        }
        toast.success("로그인되었습니다");
      }
      login(normalizedEmail, true);
      setScreen("subscription");
    } catch (e) {
      // 영어 안내를 쉬운 한국어로 바꿔 보여 줍니다
      const message = authErrorMessage(e instanceof Error ? e.message : "");
      setFormError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  /** 인증 메일 재발송 — 실제 Supabase 응답으로 성공·실패를 표시합니다 */
  const resendVerification = async () => {
    if (resendBusy || !pendingEmail) return; // 재발송 중 중복 발송 방지
    setResendBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast.success("인증 메일을 다시 보냈습니다. 메일함과 스팸함을 확인해 주세요.");
    } catch (e) {
      toast.error(authErrorMessage(e instanceof Error ? e.message : "") || "재발송에 실패했습니다.");
    } finally {
      setResendBusy(false);
    }
  };

  const google = async () => {
    if (busy) return; // 연속 클릭 잠금
    if (mode === "signup" && (!termsAccepted || !privacyAccepted)) {
      setFormError("Google로 가입하려면 필수 약관에 먼저 동의해 주세요.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        localStorage.setItem("jimpick_pending_oauth_consent", JSON.stringify({
          termsAccepted,
          privacyAccepted,
          marketingAccepted,
          acceptedAt: new Date().toISOString(),
          version: "2026-09-13",
        }));
      }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        localStorage.removeItem("jimpick_pending_oauth_consent");
        toast.error("구글 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      // 구글 로그인 페이지로 이동하는 경우(가장 일반적) — 돌아오면 세션이 설정됩니다.
      if (result.redirected) return;
      login(email || "google", true);
      setScreen("subscription");
    } catch {
      localStorage.removeItem("jimpick_pending_oauth_consent");
      toast.error("구글 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <AuthTopBar title={mode === "signup" ? "업체 회원가입" : "업체 로그인"} onBack={() => setScreen("login")} />
      <form className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-6 sm:px-8" onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-auth-soft p-1">
          {(["signup", "signin"] as const).map((m) => (
            <Button
              type="button"
              variant="ghost"
              key={m}
              onClick={() => { setMode(m); setFormError(""); }}
              className={`h-11 rounded-md text-base font-bold ${mode === m ? "bg-background text-auth-primary shadow-sm" : "text-auth-muted"}`}
            >
              {m === "signup" ? "회원가입" : "로그인"}
            </Button>
          ))}
        </div>

        <div className="space-y-4">
          <AuthField id="signup-email" label="이메일" error={email && !emailValid ? "이메일 주소를 정확히 입력해 주세요." : ""}>
            <AuthInput id="signup-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="company@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!email && !emailValid} aria-describedby={email && !emailValid ? "signup-email-error" : undefined} />
          </AuthField>
          <AuthField id="signup-password" label="비밀번호" hint={mode === "signup" ? (
            <ul className="grid gap-1" aria-live="polite">
              <li className={hasLength ? "text-auth-primary" : ""}>• 8자 이상</li>
              <li className={hasLetter ? "text-auth-primary" : ""}>• 영문 포함</li>
              <li className={hasNumber ? "text-auth-primary" : ""}>• 숫자 포함</li>
              {commonPassword && <li className="font-semibold text-auth-error">• 널리 알려진 비밀번호는 사용할 수 없습니다.</li>}
            </ul>
          ) : undefined}>
            <div className="relative">
            <AuthInput
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="영문·숫자를 섞어 8자 이상"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={mode === "signup" && !!password && !passwordValid}
              aria-describedby={mode === "signup" ? "signup-password-hint" : undefined}
              className="pr-13"
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"} className="absolute right-1 top-1/2 size-11 -translate-y-1/2 text-auth-muted">
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </Button>
            </div>
          </AuthField>
          {mode === "signup" && (
            <>
              <AuthField id="signup-company" label="업체명">
                <AuthInput id="signup-company" name="organization" autoComplete="organization" placeholder="업체명을 입력해 주세요" value={company} onChange={(e) => setCompany(e.target.value)} aria-invalid={false} aria-describedby={undefined} />
              </AuthField>
              <AuthField id="signup-owner" label="담당자명">
                <AuthInput id="signup-owner" name="name" autoComplete="name" placeholder="담당자명을 입력해 주세요" value={owner} onChange={(e) => setOwner(e.target.value)} aria-invalid={false} aria-describedby={undefined} />
              </AuthField>
              <AuthField id="signup-phone" label="연락처" error={phone && !phoneValid ? "010으로 시작하는 휴대전화 번호를 정확히 입력해 주세요." : ""}>
                <AuthInput id="signup-phone" name="tel" type="tel" inputMode="numeric" autoComplete="tel" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(formatSignupPhone(e.target.value))} maxLength={13} aria-invalid={!!phone && !phoneValid} aria-describedby={phone && !phoneValid ? "signup-phone-error" : undefined} />
              </AuthField>
            </>
          )}
        </div>

        {mode === "signup" && <ConsentSection termsAccepted={termsAccepted} privacyAccepted={privacyAccepted} marketingAccepted={marketingAccepted} onTerms={setTermsAccepted} onPrivacy={setPrivacyAccepted} onMarketing={setMarketingAccepted} />}

        <Button
          type="button"
          variant="outline"
          onClick={google}
          disabled={busy || (mode === "signup" && (!termsAccepted || !privacyAccepted))}
          aria-busy={busy}
          className="h-[52px] w-full rounded-[14px] border-auth-border bg-background text-base font-bold text-auth-text shadow-sm hover:bg-auth-soft"
        >
          <GoogleIcon />
          구글 계정으로 계속하기
        </Button>

        {pendingEmail && (
          <Card className="space-y-2 border border-[#0751D8]/20 bg-[#F5F8FF]">
            <div className="text-sm font-bold text-[#0751D8]">인증 메일을 확인해 주세요</div>
            <div className="text-[13px] leading-relaxed text-[#4B5563]">
              <b>{pendingEmail}</b> 로 인증 메일을 보냈습니다. 메일의 링크를 누르면 인증이
              완료되고, 이 앱으로 돌아와 로그인할 수 있습니다. 메일이 안 보이면{" "}
              <b>스팸함</b>도 확인해 주세요.
            </div>
            <button
              onClick={resendVerification}
              disabled={resendBusy}
              className="w-full py-2.5 rounded-xl bg-white border border-[#0751D8] text-[#0751D8] text-sm font-bold disabled:opacity-60"
            >
              {resendBusy ? "다시 보내는 중…" : "인증메일 다시 보내기"}
            </button>
          </Card>
        )}

        <div className="text-sm leading-relaxed text-auth-muted">
          가입 즉시 <b>3일 무료 체험</b>이 시작되며, 체험 기간에는 모든 기능을 쓸 수 있습니다.
        </div>
        {formError && <div role="alert" aria-live="assertive" className="rounded-md bg-auth-soft p-3 text-sm font-semibold text-auth-error">{formError}</div>}
        <div className="sticky bottom-0 -mx-4 mt-auto border-t border-auth-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:-mx-8 sm:px-8">
          <AuthPrimaryButton type="submit" busy={busy} disabled={!canSubmit}>
            {busy ? (mode === "signup" ? "가입 처리 중…" : "로그인 중…") : mode === "signup" ? "가입하고 시작하기" : "로그인"}
          </AuthPrimaryButton>
        </div>
      </form>
    </AuthShell>
  );
}

function GoogleIcon() {
  return <svg aria-hidden viewBox="0 0 24 24" className="size-5"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9l3.4-2.6Z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3 7.5l3.4 2.6C7.2 7.7 9.4 5.9 12 5.9Z"/></svg>;
}

function ConsentSection({ termsAccepted, privacyAccepted, marketingAccepted, onTerms, onPrivacy, onMarketing }: { termsAccepted: boolean; privacyAccepted: boolean; marketingAccepted: boolean; onTerms: (value: boolean) => void; onPrivacy: (value: boolean) => void; onMarketing: (value: boolean) => void }) {
  return <fieldset className="space-y-1 rounded-md border border-auth-border bg-auth-soft p-3">
    <legend className="px-1 text-[15px] font-bold text-auth-text">약관 동의</legend>
    <ConsentRow checked={termsAccepted} onChange={onTerms} label="이용약관에 동의합니다." required document="terms" />
    <ConsentRow checked={privacyAccepted} onChange={onPrivacy} label="개인정보 처리방침에 동의합니다." required document="privacy" />
    <ConsentRow checked={marketingAccepted} onChange={onMarketing} label="서비스 및 이벤트 안내 수신에 동의합니다." />
  </fieldset>;
}

function ConsentRow({ checked, onChange, label, required = false, document }: { checked: boolean; onChange: (value: boolean) => void; label: string; required?: boolean; document?: "terms" | "privacy" }) {
  const content = document === "terms" ? TERMS_DRAFT : PRIVACY_DRAFT;
  return <div className="flex min-h-11 items-center gap-2">
    <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-sm text-auth-text">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-6 shrink-0 accent-auth-primary" />
      <span><b className={required ? "text-auth-primary" : "text-auth-muted"}>[{required ? "필수" : "선택"}]</b> {label}</span>
    </label>
    {document && <Dialog><DialogTrigger asChild><Button type="button" variant="ghost" className="h-11 px-2 text-sm font-bold text-auth-primary underline">보기</Button></DialogTrigger><DialogContent className="max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border-auth-border p-5"><DialogHeader><DialogTitle>{document === "terms" ? "JIMPICK 이용약관" : "JIMPICK 개인정보 처리방침"}</DialogTitle><DialogDescription>시행일 2026년 9월 13일</DialogDescription></DialogHeader><div className="whitespace-pre-line text-sm leading-6 text-auth-text">{content}</div></DialogContent></Dialog>}
  </div>;
}

const TERMS_DRAFT = `제1조 목적\n본 약관은 JIMPICK이 제공하는 AI 이사 견적 작성·관리 서비스의 이용 조건을 정합니다.\n\n제2조 계정\n이용자는 정확한 업체 정보를 제공하고 계정 정보를 안전하게 관리해야 합니다.\n\n제3조 서비스 이용\n견적 결과는 입력 정보와 설정 단가를 기준으로 계산되며, 이용자는 고객에게 발송하기 전에 내용을 확인해야 합니다.\n\n제4조 금지행위\n타인의 계정 사용, 허위 정보 입력, 서비스 방해 및 관련 법령 위반 행위를 금지합니다.\n\n제5조 책임\n회사는 안정적인 서비스 제공을 위해 노력하며, 천재지변이나 외부 통신 장애 등 합리적으로 통제하기 어려운 사유에는 제한된 책임을 집니다.`;
const PRIVACY_DRAFT = `1. 수집 항목\n이메일, 업체명, 담당자명, 연락처와 서비스 이용 중 이용자가 입력한 견적·고객 정보입니다.\n\n2. 이용 목적\n계정 생성과 인증, 견적 작성·보관·발송, 고객 지원, 서비스 안전성 확보에 사용합니다.\n\n3. 보유 기간\n회원 탈퇴 또는 법령상 보존 기간이 끝날 때까지 보관하며, 목적 달성 후 안전하게 파기합니다.\n\n4. 제3자 제공\n법령상 의무가 있거나 이용자가 별도로 동의한 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다.\n\n5. 이용자 권리\n이용자는 본인 정보의 열람·정정·삭제를 요청할 수 있습니다. 선택 안내 수신 동의는 언제든 철회할 수 있습니다.`;

// ============ 구독 · 결제 ============
type Account = Awaited<ReturnType<typeof getMyAccount>>;

export function SubscriptionScreen() {
  const { setScreen, loggedIn } = useApp();
  const { userId, email, loading } = useSession();
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState<PlanId | null>(null);

  const refresh = async () => {
    if (!userId) return;
    // 지금 세션의 access token 을 Authorization: Bearer 로 실어 보냅니다.
    const headers = await authHeader();
    if (!headers) return; // 세션이 아직 없으면 조회하지 않습니다 (401 방지)
    try {
      setAccount(await getMyAccount({ headers }));
    } catch {
      /* 세션 준비 전 */
    }
  };

  useEffect(() => {
    refresh();
  }, [userId]);

  const buy = async (plan: PlanId) => {
    // 구독 시작은 로그인한 사장님만 가능합니다.
    // 지금 세션의 access token 을 Authorization: Bearer 로 실어 보냅니다.
    const headers = await authHeader();
    if (!headers) {
      toast.error("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      setScreen("signup");
      return;
    }
    setBusy(plan);
    tap("success");
    try {
      await subscribePlan({ data: { plan, method: "card" }, headers });
      if (plan === "free") {
        toast.success("무료 체험이 시작되었습니다 (3일)");
      } else {
        toast.success("구독이 활성화되었습니다", {
          description: "실제 카드 결제는 시스템 연결 준비 중이며, 현재는 테스트 결제로 기록됩니다.",
        });
      }

      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "결제에 실패했습니다");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    const headers = await authHeader();
    if (!headers) {
      toast.error("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      setScreen("signup");
      return;
    }
    try {
      await cancelSubscription({ headers });
      toast.success("이번 결제 주기 종료 후 해지됩니다");
      await refresh();
    } catch {
      toast.error("해지 처리에 실패했습니다");
    }
  };

  const current = account?.subscription;
  const statusLabel: Record<string, string> = {
    trialing: "무료 체험 중",
    active: "이용 중",
    past_due: "결제 실패",
    canceled: "해지됨",
  };

  if (!loading && !userId && !loggedIn) {
    return (
      <MobileShell>
        <TopBar title="구독 · 결제" onBack={() => setScreen("home")} />
        <div className="p-5 flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <Crown className="w-12 h-12 text-[#0751D8]" />
          <div className="font-bold text-lg">업체 계정이 필요합니다</div>
          <div className="text-sm text-[#6B7280]">가입하면 3일 무료 체험이 바로 시작됩니다.</div>
        </div>
        <BottomButtonBar>
          <PrimaryButton onClick={() => setScreen("signup")}>업체 회원가입 / 로그인</PrimaryButton>
        </BottomButtonBar>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <TopBar title="구독 · 결제" onBack={() => setScreen("home")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto">
        <Card className="space-y-1">
          <div className="text-xs text-[#6B7280]">현재 계정</div>
          <div className="font-bold">{account?.profile?.company_name || email || "내 업체"}</div>
          {current && (
            <div className="text-sm mt-2 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#EDF2FB] text-[#0751D8] text-xs font-bold">
                {PLANS.find((p) => p.id === current.plan)?.name}
              </span>
              <span className="text-[#6B7280] text-xs">{statusLabel[current.status] ?? current.status}</span>
              <span className="text-[#6B7280] text-xs">
                ~ {new Date(current.current_period_end).toLocaleDateString("ko-KR")}
              </span>
            </div>
          )}
          {current?.cancel_at_period_end && (
            <div className="text-xs text-[#EF4444] mt-1">기간 종료 후 자동 해지 예정</div>
          )}
        </Card>

        {PLANS.map((p) => {
          const active = current?.plan === p.id;
          return (
            <Card key={p.id} className={active ? "border-2 border-[#0751D8]" : ""}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-lg flex items-center gap-2">
                    {p.name}
                    {p.id === "pro" && <Crown className="w-4 h-4 text-[#F59E0B]" />}
                  </div>
                  <div className="text-xs text-[#6B7280]">{p.desc}</div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-[#0751D8]">{p.price === 0 ? "무료" : won(p.price)}</div>
                  {p.price > 0 && <div className="text-xs text-[#6B7280]">/ 월</div>}
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="text-sm flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#22C55E]" /> {f}
                  </li>
                ))}
              </ul>
              <button
                disabled={active || busy !== null}
                onClick={() => buy(p.id)}
                className={`w-full mt-4 py-3 rounded-2xl font-bold ${
                  active
                    ? "bg-[#EDF2FB] text-[#6B7280]"
                    : "text-white shadow-[0_4px_0_#0645B0]"
                }`}
                style={active ? undefined : { background: "linear-gradient(180deg, #4A94FF 0%, #0751D8 100%)" }}
              >
                {active ? "이용 중" : busy === p.id ? "결제 중..." : p.price === 0 ? "무료로 시작" : "구독 결제하기"}
              </button>
            </Card>
          );
        })}

        {account && account.payments.length > 0 && (
          <Card>
            <div className="font-bold mb-2 flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> 결제 내역
            </div>
            <div className="divide-y divide-[#E7EBF2]">
              {account.payments.map((pay) => (
                <div key={pay.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold">{PLANS.find((p) => p.id === pay.plan)?.name}</div>
                    <div className="text-xs text-[#6B7280]">
                      {new Date(pay.paid_at).toLocaleDateString("ko-KR")} · {pay.receipt_no}
                    </div>
                  </div>
                  <div className="font-bold">{won(pay.amount)}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {current && current.plan !== "free" && !current.cancel_at_period_end && (
          <button onClick={cancel} className="w-full py-3 text-sm text-[#6B7280] font-semibold">
            구독 해지하기
          </button>
        )}

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            toast.success("로그아웃되었습니다");
            setScreen("home");
          }}
          className="w-full py-3 rounded-2xl bg-white border border-[#E7EBF2] font-semibold flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" /> 계정 로그아웃
        </button>
      </div>
    </MobileShell>
  );
}
