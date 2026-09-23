import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public metadata only. Never return a customer's name, amount, or token from this lookup. */
export const getSharePreview = createServerFn({ method: "GET" })
  .inputValidator((value: unknown) => z.object({
    estimateId: z.string().min(1).max(120),
    token: z.string().min(8).max(80),
    reminderToken: z.string().max(80).optional(),
    card: z.enum(["quote", "deposit", "reminder"]).default("quote"),
  }).parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: terms, error } = await supabaseAdmin.from("estimate_terms")
      .select("id, user_id, estimate_id, deposit_paid")
      .eq("estimate_id", data.estimateId)
      .eq("access_token", data.token)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !terms) return { valid: false as const };

    // The reminder preview must belong to this exact contract and its original view token.
    if (data.card === "reminder") {
      if (!data.reminderToken || data.reminderToken.length < 16) return { valid: false as const };
      const { data: reminder, error: reminderError } = await supabaseAdmin.from("move_reminders")
        .select("id")
        .eq("estimate_terms_id", terms.id)
        .eq("company_id", terms.user_id)
        .eq("estimate_id", terms.estimate_id)
        .eq("view_token", data.reminderToken)
        .maybeSingle();
      if (reminderError || !reminder) return { valid: false as const };
    }
    if (data.card === "deposit" && Number(terms.deposit_paid ?? 0) <= 0) {
      return { valid: false as const };
    }
    return { valid: true as const, card: data.card };
  });