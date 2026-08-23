/**
 * 사장님 계정 로그인 (Supabase Auth).
 *
 * 문자발송 같은 서버 기능은 「로그인한 사장님」만 부를 수 있습니다.
 * 그래서 화면에 로그인으로 보이는 것만으로는 부족하고,
 * 실제 계정 세션(access token)이 있어야 합니다.
 *
 * 이 파일은 그 세션을 만들고·확인하는 일만 합니다.
 */
import { supabase } from "@/integrations/supabase/client";

/** 지금 계정 세션이 있는지, 있으면 그 열쇠를 돌려줍니다 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** 지금 로그인되어 있는지 */
export async function hasSession(): Promise<boolean> {
  return (await getAccessToken()) !== null;
}

/** 로그인한 계정의 이메일 (화면 표시용) */
export async function currentEmail(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.email ?? "";
  } catch {
    return "";
  }
}

export interface SignInResult {
  ok: boolean;
  /** 계정이 없어 보이면 참 — 회원가입을 권합니다 */
  needSignup?: boolean;
  error?: string;
}

/**
 * 계정으로 로그인합니다.
 * 아이디 칸에 이메일을 넣습니다 (계정은 이메일로 만듭니다).
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const id = email.trim();
  if (!id) return { ok: false, error: "아이디(이메일)를 입력해 주세요." };
  if (!password) return { ok: false, error: "비밀번호를 입력해 주세요." };
  if (!id.includes("@")) {
    return {
      ok: false,
      error: "아이디는 가입할 때 쓴 이메일 주소입니다. 예) jimpick@example.com",
    };
  }

  try {
    const { error } = await supabase.auth.signInWithPassword({ email: id, password });
    if (!error) return { ok: true };

    const msg = String(error.message || "");
    if (/invalid login credentials/i.test(msg)) {
      return {
        ok: false,
        needSignup: true,
        error: "이메일 또는 비밀번호가 맞지 않습니다. 계정이 없으시면 아래에서 가입해 주세요.",
      };
    }
    if (/email not confirmed/i.test(msg)) {
      return { ok: false, error: "이메일 확인이 끝나지 않았습니다. 받은 메일의 링크를 눌러 주세요." };
    }
    return { ok: false, error: `로그인하지 못했습니다. (${msg})` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "로그인 중 문제가 생겼습니다.",
    };
  }
}

/** 로그아웃 — 계정 세션을 지웁니다 */
export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    /* 이미 끊겼으면 그대로 둡니다 */
  }
}
