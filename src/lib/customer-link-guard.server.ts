/**
 * 고객용 견적서 링크 서버 검사.
 *
 * 고객은 계정이 없고 문자로 받은 보안 토큰 링크로만 들어옵니다.
 * 이 기기에 업체 사장님·서비스 관리자 로그인 세션이 있으면(요청에 로그인 인증이 붙어 오면)
 * 고객용 견적 내용 조회·동의·「입금했습니다」·열람 집계를 모두 거부합니다.
 * 업체·관리자는 내부 견적 내역 화면에서 확인합니다.
 */
const PREVIEW_AGENT = /bot|crawler|spider|preview|facebookexternalhit|kakaotalk-scrap|slack|twitterbot|telegram|discord|whatsapp|google-inspection/i;

export const STAFF_BLOCK_MESSAGE =
  "업체·관리자 계정으로 로그인된 기기에서는 고객용 견적서를 열 수 없습니다. 견적 내역에서 확인해 주세요.";

/** 요청에 유효한 로그인(업체·관리자) 세션이 붙어 있으면 그 계정 ID */
export async function signedInAccountId(): Promise<string | null> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const header = getRequest()?.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1]!.trim();
  // 공개 키(apikey)만 붙은 요청은 로그인 세션이 아닙니다.
  if (!token || token.startsWith("sb_") || token.split(".").length !== 3) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

/** 링크 미리보기 수집기(문자·메신저 미리보기)인지 */
export async function isLinkPreviewRequest(): Promise<boolean> {
  const { getRequest } = await import("@tanstack/react-start/server");
  return PREVIEW_AGENT.test(getRequest()?.headers.get("user-agent") ?? "");
}
