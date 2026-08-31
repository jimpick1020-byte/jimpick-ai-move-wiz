import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** 견적서 기본 업체 정보 (사장님 계정별로 저장됩니다) */
export interface CompanyDefaults {
  staffName: string;
  staffPhone: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
}

const EMPTY: CompanyDefaults = {
  staffName: "",
  staffPhone: "",
  bankName: "",
  bankAccount: "",
  bankHolder: "",
};

const schema = z.object({
  staffName: z.string().max(80).optional(),
  staffPhone: z.string().max(40).optional(),
  bankName: z.string().max(40).optional(),
  bankAccount: z.string().max(60).optional(),
  bankHolder: z.string().max(80).optional(),
});

/** 저장된 기본 업체 정보를 읽습니다 */
export const getCompanyDefaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; error?: string; data: CompanyDefaults }> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("staff_name, staff_phone, bank_name, bank_account, bank_holder")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, data: EMPTY };
    return {
      ok: true,
      data: {
        staffName: data?.staff_name ?? "",
        staffPhone: data?.staff_phone ?? "",
        bankName: data?.bank_name ?? "",
        bankAccount: data?.bank_account ?? "",
        bankHolder: data?.bank_holder ?? "",
      },
    };
  });

/** 기본 업체 정보를 저장합니다 (다음 견적서부터 자동 입력) */
export const saveCompanyDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const row = {
      id: context.userId,
      staff_name: (data.staffName ?? "").trim() || null,
      staff_phone: (data.staffPhone ?? "").trim() || null,
      bank_name: (data.bankName ?? "").trim() || null,
      bank_account: (data.bankAccount ?? "").trim() || null,
      bank_holder: (data.bankHolder ?? "").trim() || null,
    };
    const { error } = await context.supabase.from("profiles").upsert(row, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
