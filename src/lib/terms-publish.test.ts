import { test } from "node:test";
import { strict as assert } from "node:assert";
import { saveTermsWithStableToken } from "./terms-publish";

test("a reused token on a new revision retries with a fresh link", async () => {
  const attempts: string[] = [];
  const result = await saveTermsWithStableToken({
    token: "old-link", existingToken: async () => null, freshToken: () => "new-link",
    save: async (token) => {
      attempts.push(token);
      return token === "old-link"
        ? { data: null, error: { code: "23505", message: 'duplicate key violates unique constraint "estimate_terms_access_token_key"' } }
        : { data: { id: "revision-2" }, error: null };
    },
  });
  assert.deepEqual(attempts, ["old-link", "new-link"]);
  assert.equal(result.token, "new-link");
  assert.equal(result.data?.id, "revision-2");
  assert.equal(result.error, null);
});

test("resending the same revision preserves its saved customer link", async () => {
  const result = await saveTermsWithStableToken({
    token: "device-link", existingToken: async () => "saved-link",
    freshToken: () => { throw new Error("must not rotate"); },
    save: async (token) => ({ data: token, error: null }),
  });
  assert.equal(result.data, "saved-link");
  assert.equal(result.token, "saved-link");
});

test("permission and connection failures never become apparent success", async () => {
  for (const code of ["42501", "08006", "23505"]) {
    let calls = 0;
    const result = await saveTermsWithStableToken({
      token: "link", existingToken: async () => null,
      freshToken: () => { throw new Error("must not rotate"); },
      save: async () => { calls++; return { data: null, error: { code, message: "another failure" } }; },
    });
    assert.equal(calls, 1);
    assert.equal(result.error?.code, code);
  }
});