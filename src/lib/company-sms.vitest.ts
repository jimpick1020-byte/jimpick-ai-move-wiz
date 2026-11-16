import { beforeEach, expect, test, vi } from "vitest";
import { hasSavedNoticePhone, savedNoticePhone } from "./company-sms-policy";
import { smsRequestAllowed } from "../../supabase/functions/send-estimate-sms/policy";
import { authorizeSms } from "../../aligo-sms-proxy/authorization.js";

const fake = vi.hoisted(() => ({ context: { userId: "11111111-1111-4111-8111-111111111111", supabase: { rpc: vi.fn(), from: vi.fn() } }, admin: { rpc: vi.fn(), from: vi.fn() }, fetch: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validator = (input: unknown) => input;
  const chain = { middleware: () => chain, inputValidator: (fn: typeof validator) => { validator = fn; return chain; }, handler: (fn: (arg: unknown) => unknown) => (args: { data?: unknown } = {}) => fn({ context: fake.context, data: validator(args.data) }) };
  return chain;
} }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: fake.admin }));
import { submitBankSms, createBankSmsToken } from "./bank-sms.functions";
import { registerDeposit, confirmDeposit } from "./deposit.functions";
import { retryMoveReminder } from "./reminder.functions";
import { sendViaAligo, runDueMoveReminders, resendReminderNow } from "./reminder-send.server";
import { Route } from "@/routes/api/public/hooks/bank-sms";
const A = fake.context.userId;
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fake.fetch); });

test.each(["", "010-0000-0000", "01012", "예시 번호"])("unregistered/example %s does not hide notice", phone => expect(hasSavedNoticePhone(phone)).toBe(false));
test("successful stored valid contact hides; input/failure do not alter saved contact; reload uses storage", () => {
  const input = "010-1234-5678";
  expect(savedNoticePhone("", { ok: false, phone: input })).toBe("");
  expect(hasSavedNoticePhone(savedNoticePhone("", { ok: true, phone: input }) ?? "")).toBe(true);
  expect(hasSavedNoticePhone(input)).toBe(true);
});
test.each(["owner", "staff", "admin"])("%s cannot call paid customer API or settings/unknown modes", () => {
  for (const mode of [undefined, "deposit_notify", "test", "fix_notice", "manager_notify", "unknown"]) expect(smsRequestAllowed({ mode, isServerCall: false, isServiceAdmin: false })).toBe(false);
  expect(smsRequestAllowed({ checkOnly: true, isServerCall: false, isServiceAdmin: false })).toBe(false);
});
test("verified super-admin direct customer calls and platform owner notices are allowed; service credentials cannot launder customer calls", () => {
  for (const mode of [undefined, "deposit_notify", "test"]) {
    expect(smsRequestAllowed({ mode, isServerCall: false, isServiceAdmin: true })).toBe(true);
    expect(smsRequestAllowed({ mode, isServerCall: true, isServiceAdmin: false })).toBe(false);
  }
  expect(smsRequestAllowed({ mode: "manager_notify", isServerCall: true, isServiceAdmin: false })).toBe(true);
  expect(smsRequestAllowed({ mode: "unknown", isServerCall: false, isServiceAdmin: true })).toBe(false);
});
test("old forwarding handler rejects before parsing, database or fetch", async () => {
  const handler = (Route as unknown as { server: { handlers: { POST: () => Promise<Response> } } }).server.handlers.POST;
  const result = await handler(); expect(result.status).toBe(410); expect(await result.text()).toBe(""); expect(result.headers.get("Cache-Control")).toBe("no-store");
  expect(fake.admin.from).not.toHaveBeenCalled(); expect(fake.fetch).not.toHaveBeenCalled();
});
test("paste/token/raw-text deposit entry rejects before any write", async () => {
  await expect(submitBankSms({ data: { text: "synthetic only" } })).rejects.toThrow("더 이상");
  expect((await createBankSmsToken()).ok).toBe(false);
  expect((await registerDeposit({ data: { estimateId: "synthetic", text: "synthetic only" } })).ok).toBe(false);
  expect(fake.context.supabase.from).not.toHaveBeenCalled(); expect(fake.admin.from).not.toHaveBeenCalled();
});
test("owner receipt confirmation delegates original RPC without customer transport", async () => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { estimate_id: "synthetic", payment_kind: "deposit" } }) };
  fake.context.supabase.from.mockReturnValue(query);
  fake.context.supabase.rpc.mockResolvedValue({ data: { ok: true, paid: 10000 }, error: null });
  expect(await confirmDeposit({ data: { id: A } })).toEqual({ ok: true, paid: 10000 });
  expect(fake.context.supabase.rpc).toHaveBeenCalledWith("confirm_payment_receipt", { _receipt_id: A });
  expect(fake.fetch).not.toHaveBeenCalled(); expect(fake.admin.from).not.toHaveBeenCalled();
});
test("owner direct retry cannot reserve, query or dispatch; legacy cron does nothing", async () => {
  fake.context.supabase.rpc.mockResolvedValue({ data: false, error: null });
  expect((await retryMoveReminder({ data: { id: A } })).ok).toBe(false);
  expect(fake.context.supabase.from).not.toHaveBeenCalled();
  expect(await runDueMoveReminders()).toEqual({ ok: true, picked: 0, sent: 0, failed: 0 });
  expect((await resendReminderNow(A, A)).ok).toBe(false);
  expect(fake.fetch).not.toHaveBeenCalled(); expect(fake.admin.from).not.toHaveBeenCalled();
});
test("final transport checks actual admin actor before provider; authorized mock path succeeds", async () => {
  const args = { to: "01012345678", text: "synthetic", title: "", msgType: "SMS", aligoUserId: "fake", apiKey: "fake", proxyUrl: "https://synthetic.invalid", proxySecret: "fake", sender: "01012345678", companyId: A, actorId: A };
  fake.admin.rpc.mockResolvedValue({ data: false, error: null });
  expect((await sendViaAligo(args)).ok).toBe(false); expect(fake.fetch).not.toHaveBeenCalled();
  fake.admin.rpc.mockResolvedValue({ data: true, error: null });
  fake.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, result_code: 1, msg_id: "synthetic" }), { status: 200 }));
  expect((await sendViaAligo(args)).ok).toBe(true);
  expect(JSON.parse(fake.fetch.mock.calls[0][1].body)).toMatchObject({ actorId: A, purpose: "customer" });
});
test("proxy denies omitted/forged role or purpose; validates platform notice recipient and consent", async () => {
  const read = vi.fn(async () => [] as Array<Record<string, string>>);
  expect(await authorizeSms({ companyId: A, userId: A }, read)).toBe(false);
  expect(await authorizeSms({ companyId: A, actorId: A, purpose: "customer" }, read)).toBe(false);
  read.mockResolvedValue([{ id: "role" }]);
  expect(await authorizeSms({ companyId: A, actorId: A, purpose: "customer" }, read)).toBe(true);
  const ownerRead = vi.fn(async (table: string) => table === "profiles" ? [{ phone: "010-1234-5678" }] : [{ id: "synthetic" }]);
  expect(await authorizeSms({ companyId: A, purpose: "owner_reservation", estimateId: "synthetic", to: "01012345678" }, ownerRead)).toBe(true);
  expect(await authorizeSms({ companyId: A, purpose: "owner_reservation", estimateId: "synthetic", to: "01099999999" }, ownerRead)).toBe(false);
});