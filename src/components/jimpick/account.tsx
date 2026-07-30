import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useApp, won } from "@/lib/jimpick";
import { MobileShell, TopBar, Card, Field, TextInput, PrimaryButton, BottomButtonBar } from "@/components/jimpick/ui";
import { PLANS, getMyAccount, subscribePlan, cancelSubscription, type PlanId } from "@/lib/subscription.functions";
import { tap } from "@/lib/feedback";
import { Check, Crown, CreditCard, LogOut } from "lucide-react";

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

  const submit = async () => {
    if (!email || password.length < 6) {
      toast.error("이메일과 6자 이상 비밀번호를 입력하세요");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { company_name: company, owner_name: owner, phone },
          },
        });
        if (error) throw error;
        toast.success("가입 완료! 3일 무료 체험이 시작되었습니다");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("로그인되었습니다");
      }
      login(email, true);
      setScreen("subscription");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리에 실패했습니다");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("구글 로그인에 실패했습니다");
      return;
    }
    if (result.redirected) return;
    login(email || "google", true);
    setScreen("subscription");
  };

  return (
    <MobileShell>
      <TopBar title={mode === "signup" ? "업체 회원가입" : "업체 로그인"} onBack={() => setScreen("login")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto">
        <div className="grid grid-cols-2 gap-2 bg-[#EDF2FB] p-1 rounded-2xl">
          {(["signup", "signin"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`py-2.5 rounded-xl text-sm font-bold ${mode === m ? "bg-white text-[#0751D8] shadow" : "text-[#6B7280]"}`}
            >
              {m === "signup" ? "회원가입" : "로그인"}
            </button>
          ))}
        </div>

        <Card className="space-y-3">
          <Field label="이메일">
            <TextInput type="email" placeholder="company@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="비밀번호">
            <TextInput type="password" placeholder="6자 이상" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {mode === "signup" && (
            <>
              <Field label="업체명">
                <TextInput placeholder="짐픽 이사" value={company} onChange={(e) => setCompany(e.target.value)} />
              </Field>
              <Field label="담당자명">
                <TextInput placeholder="홍길동" value={owner} onChange={(e) => setOwner(e.target.value)} />
              </Field>
              <Field label="연락처">
                <TextInput placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            </>
          )}
        </Card>

        <button
          onClick={google}
          className="w-full py-3.5 rounded-2xl bg-white border border-[#E7EBF2] font-bold shadow-sm"
        >
          구글 계정으로 계속하기
        </button>

        <div className="text-xs text-[#6B7280] leading-relaxed px-1">
          가입 즉시 <b>3일 무료 체험</b>이 시작되며, 체험 기간에는 모든 기능을 쓸 수 있습니다.
        </div>
      </div>
      <BottomButtonBar>
        <PrimaryButton onClick={submit} disabled={busy}>
          {busy ? "처리 중..." : mode === "signup" ? "가입하고 시작하기" : "로그인"}
        </PrimaryButton>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ 구독 · 결제 ============
type Account = Awaited<ReturnType<typeof getMyAccount>>;

export function SubscriptionScreen() {
  const { setScreen } = useApp();
  const { userId, email, loading } = useSession();
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState<PlanId | null>(null);

  const refresh = async () => {
    if (!userId) return;
    try {
      setAccount(await getMyAccount());
    } catch {
      /* 세션 준비 전 */
    }
  };

  useEffect(() => {
    refresh();
  }, [userId]);

  const buy = async (plan: PlanId) => {
    setBusy(plan);
    tap("success");
    try {
      await subscribePlan({ data: { plan, method: "card" } });
      toast.success(plan === "free" ? "무료 체험으로 변경되었습니다" : "결제가 완료되었습니다");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "결제에 실패했습니다");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    try {
      await cancelSubscription();
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

  if (!loading && !userId) {
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
