import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isRememberMe, rememberAwareAuthStorage, setRememberMe } from "./auth-persistence";

function storage() {
  const rows = new Map<string, string>();
  return { getItem: (k: string) => rows.get(k) ?? null, setItem: (k: string, v: string) => { rows.set(k, v); }, removeItem: (k: string) => { rows.delete(k); } };
}
test("로그인 유지와 갱신 및 명시적 로그아웃", async () => {
  const local = storage();
  const temporary = storage();
  Object.assign(globalThis, { window: { sessionStorage: temporary }, localStorage: local });
  const adapter = rememberAwareAuthStorage(local);
  assert.ok(adapter);
  assert.equal(isRememberMe(), true);
  await adapter.setItem("auth", "first");
  assert.equal(local.getItem("auth"), "first");
  setRememberMe(false);
  const reopened = rememberAwareAuthStorage(local);
  assert.ok(reopened);
  assert.equal(await reopened.getItem("auth"), "first");
  await reopened.setItem("auth", "renewed");
  assert.equal(local.getItem("auth"), "renewed");
  await reopened.removeItem("auth");
  assert.equal(local.getItem("auth"), null);
  assert.equal(temporary.getItem("auth"), null);
});
test("탭 한정 기존 세션은 유지 선택 시 정보 보존하여 이전", async () => {
  const local = storage();
  const temporary = storage();
  Object.assign(globalThis, { window: { sessionStorage: temporary }, localStorage: local });
  setRememberMe(false);
  const adapter = rememberAwareAuthStorage(local);
  assert.ok(adapter);
  await adapter.setItem("auth", "temporary");
  assert.equal(local.getItem("auth"), null);
  assert.equal(temporary.getItem("auth"), "temporary");
  setRememberMe(true);
  assert.equal(await adapter.getItem("auth"), "temporary");
  assert.equal(local.getItem("auth"), "temporary");
  assert.equal(temporary.getItem("auth"), null);
});