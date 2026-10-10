import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { Session } from "@supabase/supabase-js";
import { isIdentityEvent, recoverAuthSession, shouldRefreshSession } from "./auth-recovery";

test("만료 60초 전 갱신, 여유 있는 토큰은 유지", () => {
  assert.equal(shouldRefreshSession(160, 100_000), true);
  assert.equal(shouldRefreshSession(161, 100_000), false);
  assert.equal(shouldRefreshSession(99, 100_000), true);
});
test("초기 확인과 토큰 갱신 이벤트는 로그인 강제 이동하지 않음", () => {
  assert.equal(isIdentityEvent("INITIAL_SESSION"), false);
  assert.equal(isIdentityEvent("TOKEN_REFRESHED"), false);
  assert.equal(isIdentityEvent("SIGNED_OUT"), true);
});
test("저장된 세션은 사용자 검증 이후 복구", async () => {
  const session = { expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "owner" } } as Session;
  let verified = false;
  const result = await recoverAuthSession({
    getSession: async () => ({ data: { session }, error: null }),
    refreshSession: async () => { throw new Error("unexpected refresh"); },
    getUser: async () => { verified = true; return { data: { user: session.user }, error: null }; },
  });
  assert.equal(result, session);
  assert.equal(verified, true);
});
test("일시적 통신 실패는 로그아웃 대신 재시도 대상", async () => {
  await assert.rejects(recoverAuthSession({
    getSession: async () => { throw new Error("network unavailable"); },
    refreshSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
  }), /network unavailable/);
});
test("만료 직전 저장 토큰은 갱신 후 검증", async () => {
  const session = { expires_at: 1, user: { id: "owner" } } as Session;
  const renewed = { ...session, expires_at: Math.floor(Date.now() / 1000) + 3600 };
  const result = await recoverAuthSession({
    getSession: async () => ({ data: { session }, error: null }),
    refreshSession: async () => ({ data: { session: renewed }, error: null }),
    getUser: async () => ({ data: { user: renewed.user }, error: null }),
  });
  assert.equal(result, renewed);
});