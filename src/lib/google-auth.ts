/**
 * 구글 로그인 공통 함수 — 「JIMPICK 로그인」, 「업체 로그인/회원가입」 화면이 모두 이것만 씁니다.
 *
 * Lovable Cloud 관리형 구글 로그인(lovable.auth.signInWithOAuth)을 사용합니다.
 * 같은 이메일로 이미 가입된 계정이 있으면 새 계정을 만들지 않고 기존 계정에 연결되며,
 * 로그인 후 세션 변화는 앱 한 곳(JimpickProvider)의 인증 구독이 받아 업체 정보·권한을 다시 불러옵니다.
 * 구글이 스스로 요구하는 보안 확인(보안 코드 등)은 우회하지 않습니다.
 */
import { lovable } from "@/integrations/lovable/index";

export const GOOGLE_RETRY_MESSAGE = "Google 보안 확인을 완료한 뒤 다시 시도해 주세요.";

export type GoogleSignInResult = "redirected" | "signed-in" | "failed";

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    const result = await lovable.auth.signInWithOAuth("google", {
      // 관리형 구글 로그인은 지금 열린 주소로만 돌아올 수 있습니다(운영 주소에서는 운영 주소).
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account", access_type: "offline" },
    });
    if (result.error) return "failed";
    if (result.redirected) return "redirected";
    return "signed-in";
  } catch {
    return "failed";
  }
}
