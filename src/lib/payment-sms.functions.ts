import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { paymentText } from "./customer-payment";

export const preparePaymentSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ estimateId: z.string().min(1).max(80), receiptId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: terms } = await context.supabase.from("estimate_terms").select("customer_name,contact_phone,total,deposit_paid,balance_paid,payment_status").eq("user_id",context.userId).eq("estimate_id",data.estimateId).is("deleted_at",null).order("sheet_version",{ascending:false}).limit(1).maybeSingle();
    if (!terms) throw new Error("견적을 찾지 못했습니다.");
    let query = context.supabase.from("deposit_records").select("amount,payment_kind").eq("user_id",context.userId).eq("estimate_id",data.estimateId).eq("status","confirmed");
    if (data.receiptId) query = query.eq("id",data.receiptId);
    const { data: receipt } = await query.order("confirmed_at",{ascending:false}).limit(1).maybeSingle();
    if (!receipt) throw new Error("실제 입금 확인 후 문자를 작성할 수 있습니다.");
    return { phone: terms.contact_phone ?? "", body: paymentText(terms.customer_name.trim(),receipt.amount,receipt.payment_kind,true,terms.payment_status === "completed") };
  });