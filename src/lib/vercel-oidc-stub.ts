// 공개 서버(Cloudflare)에서 실행되지 않는 Vercel 전용 인증 부품을 대신합니다.
// 이 앱은 Lovable AI 키로만 AI를 호출하므로 아래 기능은 쓰이지 않습니다.
export function getContext(): { headers?: Record<string, string> } {
  return {};
}

export async function getVercelOidcToken(): Promise<string> {
  throw new Error("Vercel OIDC is not available in this app");
}

export function getVercelOidcTokenSync(): string {
  throw new Error("Vercel OIDC is not available in this app");
}
