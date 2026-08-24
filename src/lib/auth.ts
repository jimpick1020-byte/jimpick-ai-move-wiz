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

/**
 * 계정 관련 영어 안내를 쉬운 한국어로 바꿉니다.
 * (Supabase 가 영어로만 알려 주기 때문입니다)
 */
export function authErrorMessage(raw: string): string {
  const m = String(raw || "");
  if (/known to be weak|easy to guess|pwned|leaked/i.test(m)) {
    return "이 비밀번호는 이미 널리 알려진 비밀번호라 쓸 수 없습니다. 다른 비밀번호를 정해 주세요. (영문·숫자를 섞어 8자 이상을 권합니다)";
  }
  if (/password should be at least|at least 6 characters|too short/i.test(m)) {
    return "비밀번호가 너무 짧습니다. 8자 이상으로 정해 주세요.";
  }
  if (/user already registered|already been registered/i.test(m)) {
    return "이미 가입된 이메일입니다. 로그인으로 들어가 주세요.";
  }
  if (/invalid login credentials/i.test(m)) {
    return "이메일 또는 비밀번호가 맞지 않습니다.";
  }
  if (/unable to validate email|invalid email/i.test(m)) {
    return "이메일 주소 형식이 올바르지 않습니다.";
  }
  if (/email not confirmed/i.test(m)) {
    return "이메일 확인이 끝나지 않았습니다. 받은 메일의 링크를 눌러 주세요.";
  }
  if (/rate limit|too many requests/i.test(m)) {
    return "잠시 후 다시 시도해 주세요. (요청이 너무 잦습니다)";
  }
  if (/network|fetch/i.test(m)) {
    return "인터넷 연결을 확인한 뒤 다시 시도해 주세요.";
  }
  return m || "처리에 실패했습니다.";
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
    return { ok: false, error: authErrorMessage(msg) };
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
