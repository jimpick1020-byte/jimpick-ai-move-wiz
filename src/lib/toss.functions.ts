/**
 * 토스페이먼츠 자동결제(빌링) 연결.
 *
 * - getTossBillingConfig : 화면에서 카드 등록창을 띄우기 위한 클라이언트 키와 고객 식별값을 내려 줍니다.
 *                          비밀 키(TOSS_SECRET_KEY)는 이 파일의 서버 처리 안에서만 쓰이며 화면으로 나가지 않습니다.
 * - registerTossBilling  : 카드 등록 후 받은 authKey 로 빌링키를 발급받아 저장하고, 첫 달 요금을 실제로 결제합니다.
 * - chargeTossBilling    : 저장된 카드로 다시 결제합니다(결제 실패 후 재시도).
 * - getTossBilling       : 등록된 카드 정보를 보여 줍니다.
 *
 * 토스가 실제로 승인(DONE)한 경우에만 결제 성공으로 기록합니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { PLANS } from "./subscription.functions";

const TOSS_API = "https://api.tosspayments.com/v1";

/** 구독 요금제 (월 22,000원) */
const proPlan = () => PLANS.find((p) => p.id === "pro") ?? PLANS[PLANS.length - 1];

/** 사용자마다 고정된 토스 고객 식별값 (개인정보를 담지 않습니다) */
function customerKeyOf(userId: string) {
  return `jimpick_${userId.replace(/-/g, "")}`;
}

function basicAuth(secretKey: string) {
  // 비밀 키는 Basic 인증의 아이디 자리에 넣습니다 (비밀번호는 빈 값).
  const raw = `${secretKey}:`;
  const b64 =
    typeof btoa === "function"
      ? btoa(raw)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).Buffer.from(raw, "utf8").toString("base64");
  return `Basic ${b64}`;
}

interface TossError {
  code?: string;
  message?: string;
}

/** 토스 오류 메시지를 사장님이 읽을 수 있는 말로 바꿉니다 (없는 값은 만들지 않습니다) */
function tossErrorText(body: TossError | null, status: number) {
  const msg = body?.message?.trim();
  if (msg) return body?.code ? `${msg} (${body.code})` : msg;
  return `결제사 응답 오류 (HTTP ${status})`;
}

async function tossFetch(
  path: string,
  init: { body: unknown; idempotencyKey?: string },
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null }> {
  const secretKey = process.env["TOSS_SECRET_KEY"]?.trim();
  if (!secretKey) throw new Error("결제 설정이 준비되지 않았습니다. 관리자에게 문의해 주세요.");

  const headers: Record<string, string> = {
    Authorization: basicAuth(secretKey),
    "Content-Type": "application/json",
  };
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

  const res = await fetch(`${TOSS_API}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(init.body),
  });
  let json: Record<string, unknown> | null = null;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

/** 카드 등록창에 필요한 값 (클라이언트 키는 공개용 키입니다) */
export const getTossBillingConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; clientKey?: string; customerKey?: string; error?: string }> => {
    const clientKey = process.env["TOSS_CLIENT_KEY"]?.trim();
    if (!clientKey) return { ok: false, error: "결제 설정이 준비되지 않았습니다." };
    return { ok: true, clientKey, customerKey: customerKeyOf(context.userId) };
  });

export interface BillingCardInfo {
  registered: boolean;
  cardCompany?: string | null;
  cardNumberMasked?: string | null
  registeredAt?: string | null;
}

/** 등록된 카드 정보 */
export const getTossBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingCardInfo> => {
    const { data } = await context.supabase
      .from("billing_keys")
      .select("card_company, card_number_masked, created_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return { registered: false };
    const row = data as { card_company: string | null; card_number_masked: string | null; created_at: string };
    return {
      registered: true,
      cardCompany: row.card_company,
      cardNumberMasked: row.card_number_masked,
      registeredAt: row.created_at,
    };
  });

interface ChargeResult {
  ok: boolean;
  error?: string;
  orderId?: string;
  amount?: number;
  approvedAt?: string | null;
  receiptNo?: string | null;
}

/** 저장된 빌링키로 실제 결제하고, 성공·실패를 그대로 기록합니다 */
async function chargeWithBillingKey(args: {
  userId: string;
  billingKey: string;
  customerKey: string;
  reason: string;
}): Promise<ChargeResult> {
  const plan = proPlan();
  const orderId = `jimpick_${args.userId.slice(0, 8)}_${Date.now()}`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let res: Awaited<ReturnType<typeof tossFetch>>;
  try {
    res = await tossFetch(`/billing/${args.billingKey}`, {
      idempotencyKey: orderId,
      body: {
        customerKey: args.customerKey,
        amount: plan.price,
        orderId,
        orderName: `짐픽 ${plan.name} 1개월`,
      },
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "네트워크 오류";
    await supabaseAdmin.from("payments").insert({
      user_id: args.userId,
      plan: "pro",
      amount: plan.price,
      method: "card",
      status: "failed",
      provider: "toss",
      order_id: orderId,
      fail_reason: reason,
    } as never);
    return { ok: false, error: reason };
  }

  const body = res.json ?? {};
  const status = typeof body["status"] === "string" ? (body["status"] as string) : "";

  if (!res.ok || status !== "DONE") {
    const reason = tossErrorText(body as TossError, res.status);
    console.error("[toss] 결제 실패", status || res.status, (body as TossError).code ?? "");
    await supabaseAdmin.from("payments").insert({
      user_id: args.userId,
      plan: "pro",
      amount: plan.price,
      method: "card",
      status: "failed",
      provider: "toss",
      order_id: orderId,
      fail_reason: reason,
    } as never);
    await supabaseAdmin.from("subscriptions").update({ status: "past_due" }).eq("user_id", args.userId);
    return { ok: false, error: reason };
  }

  const approvedAt = typeof body["approvedAt"] === "string" ? (body["approvedAt"] as string) : null;
  const paymentKey = typeof body["paymentKey"] === "string" ? (body["paymentKey"] as string) : null;
  const receipt = body["receipt"] as { url?: string } | undefined;
  const approvedAmount = typeof body["totalAmount"] === "number" ? (body["totalAmount"] as number) : plan.price;

  const now = approvedAt ? new Date(approvedAt) : new Date();
  const end = new Date(now.getTime() + 30 * 86400000);

  await supabaseAdmin.from("payments").insert({
    user_id: args.userId,
    plan: "pro",
    amount: approvedAmount,
    method: "card",
    status: "paid",
    provider: "toss",
    order_id: orderId,
    payment_key: paymentKey,
    paid_at: now.toISOString(),
    receipt_no: orderId,
  } as never);

  const { error: subErr } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: args.userId,
      plan: "pro",
      status: "active",
      price: plan.price,
      interval: "month",
      current_period_start: now.toISOString(),
      current_period_end: end.toISOString(),
      cancel_at_period_end: false,
    } as never,
    { onConflict: "user_id" },
  );
  if (subErr) console.error("[toss] 구독 저장 실패", subErr.message);

  return {
    ok: true,
    orderId,
    amount: approvedAmount,
    approvedAt,
    receiptNo: receipt?.url ?? null,
  };
}

/** 카드 등록(authKey) → 빌링키 발급 → 첫 달 결제 */
export const registerTossBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ authKey: z.string().min(5).max(300), customerKey: z.string().min(5).max(200) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ChargeResult> => {
    const expected = customerKeyOf(context.userId);
    if (data.customerKey !== expected) {
      return { ok: false, error: "카드 등록 정보가 계정과 일치하지 않습니다. 다시 시도해 주세요." };
    }

    let issue: Awaited<ReturnType<typeof tossFetch>>;
    try {
      issue = await tossFetch("/billing/authorizations/issue", {
        body: { authKey: data.authKey, customerKey: expected },
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "카드 등록에 실패했습니다." };
    }

    const ib = issue.json ?? {};
    const billingKey = typeof ib["billingKey"] === "string" ? (ib["billingKey"] as string) : "";
    if (!issue.ok || !billingKey) {
      console.error("[toss] 빌링키 발급 실패", issue.status, (ib as TossError).code ?? "");
      return { ok: false, error: tossErrorText(ib as TossError, issue.status) };
    }

    const card = (ib["card"] ?? {}) as { issuerCode?: string; company?: string; number?: string; cardType?: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: keyErr } = await supabaseAdmin.from("billing_keys").upsert(
      {
        user_id: context.userId,
        customer_key: expected,
        billing_key: billingKey,
        card_company: card.company ?? card.issuerCode ?? null,
        card_number_masked: card.number ?? null,
        card_type: card.cardType ?? null,
      } as never,
      { onConflict: "user_id" },
    );
    if (keyErr) {
      console.error("[toss] 카드 정보 저장 실패", keyErr.message);
      return { ok: false, error: "카드 정보를 저장하지 못했습니다. 다시 시도해 주세요." };
    }

    return chargeWithBillingKey({
      userId: context.userId,
      billingKey,
      customerKey: expected,
      reason: "첫 결제",
    });
  });

/** 저장된 카드로 다시 결제 */
export const chargeTossBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChargeResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("billing_keys")
      .select("billing_key, customer_key")
      .eq("user_id", context.userId)
      .maybeSingle();
    const row = data as { billing_key: string; customer_key: string } | null;
    if (!row) return { ok: false, error: "등록된 카드가 없습니다. 카드를 먼저 등록해 주세요." };
    return chargeWithBillingKey({
      userId: context.userId,
      billingKey: row.billing_key,
      customerKey: row.customer_key,
      reason: "재결제",
    });
  });
