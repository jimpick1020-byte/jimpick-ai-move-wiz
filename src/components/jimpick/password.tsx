import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/auth";
import { useApp } from "@/lib/jimpick";
import { MobileShell, TopBar, Card, Field, TextInput, PrimaryButton, BottomButtonBar } from "@/components/jimpick/ui";

/** 비밀번호 재설정 메일이 돌아올 화면 주소 (지금 접속한 주소 기준) */
export function resetRedirectUrl(): string {
  return `${window.location.origin}/reset-password`;
}

/** 아이디/비밀번호 찾기 — 이메일을 받아 실제로 재설정 메일을 보냅니다 */
export function ForgotPasswordScreen() {
  const { setScreen } = useApp();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const send = async () => {
    if (busy) return; // 전송 중 중복 클릭 방지
    const target = email.trim();
    if (!target.includes("@")) {
      toast.error("이메일 주소를 정확히 입력해 주세요");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: resetRedirectUrl(),
      });
      if (error) throw error;
      setSentTo(target);
      toast.success("비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 눌러 주세요.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(authErrorMessage(msg) || `메일 전송에 실패했습니다. (${msg})`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileShell>
      <TopBar title="아이디 · 비밀번호 찾기" onBack={() => setScreen("login")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto">
        <Card className="space-y-3">
          <div className="text-[14px] leading-relaxed text-[#4B5563]">
            가입할 때 쓴 <b>이메일 주소</b>가 곧 아이디입니다. 아래에 적어 주시면 그 주소로
            비밀번호를 새로 정할 수 있는 링크를 보내 드립니다.
          </div>
          <Field label="이메일 (아이디)">
            <TextInput
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="jimpick@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
            />
          </Field>
        </Card>

        {sentTo && (
          <Card className="space-y-1 border border-[#0751D8]/20 bg-[#F5F8FF]">
            <div className="text-sm font-bold text-[#0751D8]">메일을 확인해 주세요</div>
            <div className="text-[13px] leading-relaxed text-[#4B5563]">
              <b>{sentTo}</b> 로 재설정 링크를 보냈습니다. 메일이 안 보이면 <b>스팸함</b>도 확인해 주세요.
            </div>
          </Card>
        )}
      </div>
      <BottomButtonBar>
        <PrimaryButton onClick={() => void send()} disabled={busy}>
          {busy ? "보내는 중…" : "재설정 메일 보내기"}
        </PrimaryButton>
      </BottomButtonBar>
    </MobileShell>
  );
}

/** 메일 링크로 들어와 새 비밀번호를 정하는 화면 (/reset-password) */
export function ResetPasswordScreen() {
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // 메일 링크의 인증 정보로 임시 세션이 만들어졌는지 확인합니다.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) await supabase.auth.exchangeCodeForSession(code);
        const errDesc = url.searchParams.get("error_description") ?? new URLSearchParams(url.hash.slice(1)).get("error_description");
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        if (data.session) setReady(true);
        else
          setLinkError(
            errDesc
              ? authErrorMessage(errDesc) || errDesc
              : "링크가 만료되었거나 올바르지 않습니다. 로그인 화면에서 재설정 메일을 다시 받아 주세요.",
          );
      } catch (e) {
        if (alive) setLinkError(e instanceof Error ? authErrorMessage(e.message) || e.message : "링크를 확인하지 못했습니다.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    if (busy) return; // 중복 클릭 방지
    if (pw.length < 8) {
      toast.error("비밀번호는 8자 이상으로 정해 주세요");
      return;
    }
    if (pw !== pw2) {
      toast.error("두 비밀번호가 서로 다릅니다");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setDone(true);
      toast.success("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(authErrorMessage(msg) || `비밀번호 변경에 실패했습니다. (${msg})`);
    } finally {
      setBusy(false);
    }
  };

  const goLogin = async () => {
    await supabase.auth.signOut();
    window.location.replace("/");
  };

  return (
    <MobileShell>
      <TopBar title="새 비밀번호 설정" />
      <div className="p-5 space-y-4 flex-1 overflow-auto">
        {linkError && (
          <Card className="space-y-1 border border-[#EF4444]/30 bg-[#FEF2F2]">
            <div className="text-sm font-bold text-[#EF4444]">링크를 사용할 수 없습니다</div>
            <div className="text-[13px] leading-relaxed text-[#4B5563]">{linkError}</div>
          </Card>
        )}
        {!linkError && !ready && <Card>확인 중입니다…</Card>}
        {ready && !done && (
          <Card className="space-y-3">
            <Field label="새 비밀번호">
              <TextInput
                type="password"
                autoComplete="new-password"
                placeholder="영문·숫자를 섞어 8자 이상"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
            </Field>
            <Field label="새 비밀번호 확인">
              <TextInput
                type="password"
                autoComplete="new-password"
                placeholder="한 번 더 입력"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                }}
              />
            </Field>
          </Card>
        )}
        {done && (
          <Card className="space-y-1 border border-[#0751D8]/20 bg-[#F5F8FF]">
            <div className="text-sm font-bold text-[#0751D8]">변경 완료</div>
            <div className="text-[13px] leading-relaxed text-[#4B5563]">새 비밀번호로 로그인해 주세요.</div>
          </Card>
        )}
      </div>
      <BottomButtonBar>
        {done || linkError ? (
          <PrimaryButton onClick={() => void goLogin()}>로그인 화면으로</PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => void save()} disabled={busy || !ready}>
            {busy ? "변경 중…" : "비밀번호 변경"}
          </PrimaryButton>
        )}
      </BottomButtonBar>
    </MobileShell>
  );
}
