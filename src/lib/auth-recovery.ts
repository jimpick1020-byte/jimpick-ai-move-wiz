import type { Session, User, AuthChangeEvent } from "@supabase/supabase-js";

export function shouldRefreshSession(expiresAt: number | undefined, now = Date.now()): boolean {
  return expiresAt !== undefined && expiresAt * 1000 - now <= 60_000;
}

export function isIdentityEvent(event: AuthChangeEvent): boolean {
  return event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED";
}

interface RecoveryClient {
  getSession: () => Promise<{ data: { session: Session | null }; error: unknown }>;
  refreshSession: () => Promise<{ data: { session: Session | null }; error: unknown }>;
  getUser: () => Promise<{ data: { user: User | null }; error: unknown }>;
}

export async function recoverAuthSession(auth: RecoveryClient): Promise<Session | null> {
  const initial = await auth.getSession();
  if (initial.error) throw initial.error;
  let session = initial.data.session;
  if (!session) return null;
  if (shouldRefreshSession(session.expires_at)) {
    const renewed = await auth.refreshSession();
    if (renewed.error) throw renewed.error;
    session = renewed.data.session;
    if (!session) return null;
  }
  const verified = await auth.getUser();
  if (verified.error) throw verified.error;
  return verified.data.user?.id === session.user.id ? session : null;
}