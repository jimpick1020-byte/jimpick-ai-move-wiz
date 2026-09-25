/**
 * 구글 로그인 공통 함수 — 「JIMPICK 로그인」, 「업체 로그인/회원가입」 화면이 모두 handleGoogleLogin 하나만 씁니다.
 *
 * - 버튼 클릭 이벤트를 즉시 막아(preventDefault/stopPropagation) 로그인 폼 제출·이메일/비밀번호 검사가 실행되지 않습니다.
 * - Lovable Cloud 관리형 구글 로그인을 사용합니다. 같은 이메일 계정이 있으면 기존 계정에 연결됩니다.
 * - 구글이 스스로 요구하는 보안 확인은 우회하지 않습니다.
 */
import type React from "react";
import { lovable } from "@/integrations/lovable/index";

export const GOOGLE_RETRY_MESSAGE = "Google 보안 확인을 완료한 뒤 다시 시도해 주세요.";

export type GoogleSignInResult = "redirected" | "signed-in" | "failed";

export async function handleGoogleLogin(
  event?: React.SyntheticEvent,
): Promise<GoogleSignInResult> {
  event?.preventDefault();
  event?.stopPropagation();
  try {
    const result = await lovable.auth.signInWithOAuth("google", {
      // 관리형 구글 로그인은 지금 열린 주소로만 돌아올 수 있습니다(운영 앱에서는 운영 주소).
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) return "failed";
    if (result.redirected) return "redirected";
    return "signed-in";
  } catch {
    return "failed";
  }
}

/** 예전 이름 호환 */
export const signInWithGoogle = () => handleGoogleLogin();
