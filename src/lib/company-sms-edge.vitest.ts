import { beforeAll, beforeEach, expect, test, vi } from "vitest";
let handle: (request: Request) => Promise<Response>;
const fetchMock = vi.fn();
let serviceAdmin = false;
beforeAll(async () => {
  const env: Record<string, string> = { ALIGO_USER_ID: "synthetic", ALIGO_API_KEY: "synthetic", APP_PUBLIC_URL: "https://gyeonjeokit.lovable.app", SUPABASE_URL: "https://synthetic.invalid", SUPABASE_SERVICE_ROLE_KEY: "synthetic-service", JIMPICK_PROXY_SECRET: "synthetic-server" };
  vi.stubGlobal("Deno", { env: { get: (key: string) => env[key] }, serve: (fn: typeof handle) => { handle = fn; } });
  vi.stubGlobal("fetch", fetchMock);
  await import("../../supabase/functions/send-estimate-sms/index");
});
beforeEach(() => {
  serviceAdmin = false;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: "11111111-1111-4111-8111-111111111111" });
    if (url.includes("/user_roles?")) return Response.json(serviceAdmin ? [{ role: "super_admin" }] : []);
    throw new Error("Unexpected external provider or data call in synthetic test");
  });
});
const request = (body: unknown, server = false) => new Request("https://synthetic.invalid/functions/v1/send-estimate-sms", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${server ? "synthetic-service" : "synthetic-user"}` }, body: JSON.stringify(body) });
test.each([{}, { mode: "test" }, { mode: "deposit_notify" }, { mode: "manager_notify" }, { mode: "unknown" }, { checkOnly: true }])("actual API owner/staff denies %j before any provider/write", async body => {
  expect((await handle(request(body))).status).toBe(403);
  expect(fetchMock.mock.calls.every(([url]) => url.includes("/auth/v1/user") || url.includes("/user_roles?"))).toBe(true);
});
test("service secret cannot send customer messages", async () => {
  expect((await handle(request({ estimate_id: "synthetic" }, true))).status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});
test("actual API verified admin passes authorization and only fails missing estimate, not permission", async () => {
  serviceAdmin = true;
  expect((await handle(request({}))).status).toBe(400);
  expect(fetchMock.mock.calls.some(([url]) => url.includes("/user_roles?"))).toBe(true);
});