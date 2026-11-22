import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const startStorageInterim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ estimateId: z.string().min(1).max(80), confirmed: z.literal(true) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const result = await context.supabase.rpc("start_storage_interim", { p_estimate: data.estimateId, p_confirmed: data.confirmed });
    if (result.error) return { ok: false, error: "작업 완료 확인을 저장하지 못했습니다." };
    return result.data as { ok: boolean; error?: string };
  });

export const confirmOwnerInterim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ estimateId: z.string().min(1).max(80), amount: z.number().int().positive().max(1_000_000_000), requestKey: z.string().uuid(), reviewed: z.literal(true), receiptId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string; already?: boolean }> => {
    const result = await context.supabase.rpc("confirm_owner_interim", { p_estimate: data.estimateId, p_amount: data.amount, p_key: data.requestKey, p_reviewed: true, ...(data.receiptId ? { p_receipt: data.receiptId } : {}) });
    if (result.error) return { ok: false, error: "중도금 입금 확인을 저장하지 못했습니다." };
    return result.data as { ok: boolean; error?: string; already?: boolean };
  });

export const claimCustomerInterim = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(80), amount: z.number().int().positive().max(1_000_000_000), seenAmount: z.number().int().positive(), confirmed: z.literal(true) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string; already?: boolean }> => {
    const guard = await import("./customer-link-guard.server");
    if (await guard.signedInAccountId()) return { ok: false, error: guard.STAFF_BLOCK_MESSAGE };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.rpc("claim_customer_interim", { p_token: data.token, p_confirmed: data.confirmed, p_seen: data.seenAmount, p_amount: data.amount });
    if (result.error) return { ok: false, error: "중도금 신고를 저장하지 못했습니다." };
    return result.data as { ok: boolean; error?: string; already?: boolean };
  });