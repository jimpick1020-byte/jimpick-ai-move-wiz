import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/** 견적서 기본 업체 정보 (사장님 계정별로 profiles 에 저장됩니다) */
export interface CompanyDefaults {
  /** 상호명 */
  companyName: string;
  /** 대표자명 */
  ownerName: string;
  /** 업체 연락처 */
  phone: string;
  /** 사업자등록번호 (숫자 10자리만 저장) */
  businessNumber: string;
  /** 사업자등록증 파일 경로 (비공개 Storage 의 object path, 공개 URL 아님) */
  certPath: string;
  /** 담당자명 */
  staffName: string;
  /** 담당자 연락처 */
  staffPhone: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
}

const EMPTY: CompanyDefaults = {
  companyName: "",
  ownerName: "",
  phone: "",
  businessNumber: "",
  certPath: "",
  staffName: "",
  staffPhone: "",
  bankName: "",
  bankAccount: "",
  bankHolder: "",
};

// 모든 항목은 선택값입니다. 넘어온 항목만 저장하고, 빠진 항목은 건드리지 않습니다
// (부분 저장 → 기존 값이 실수로 지워지지 않게 합니다).
const schema = z.object({
  companyName: z.string().max(120).optional(),
  ownerName: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
  // 사업자등록번호는 숫자 10자리만 저장(하이픈 없이). 빈 문자열은 '지움'으로 처리.
  businessNumber: z
    .string()
    .max(20)
    .optional()
    .transform((v) => (v == null ? v : v.replace(/[^0-9]/g, ""))),
  certPath: z.string().max(300).optional(),
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
      .select(
        "company_name, owner_name, phone, business_number, cert_path, staff_name, staff_phone, bank_name, bank_account, bank_holder",
      )
      .eq("id", context.userId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, data: EMPTY };
    return {
      ok: true,
      data: {
        companyName: data?.company_name ?? "",
        ownerName: data?.owner_name ?? "",
        phone: data?.phone ?? "",
        businessNumber: data?.business_number ?? "",
        certPath: data?.cert_path ?? "",
        staffName: data?.staff_name ?? "",
        staffPhone: data?.staff_phone ?? "",
        bankName: data?.bank_name ?? "",
        bankAccount: data?.bank_account ?? "",
        bankHolder: data?.bank_holder ?? "",
      },
    };
  });

/**
 * 기본 업체 정보를 저장합니다 (다음 견적서부터 자동 입력).
 * 넘어온 항목만 갱신하는 부분 저장이라, 함께 보내지 않은 값은 그대로 유지됩니다.
 */
export const saveCompanyDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
    const row: ProfileInsert = { id: context.userId };
    // 넘어온(정의된) 항목만 반영합니다. 빈 문자열은 null 로 지웁니다.
    const put = (column: keyof Omit<ProfileInsert, "id">, value: string | undefined) => {
      if (value !== undefined) {
        row[column] = (value.trim() === "" ? null : value.trim()) as never;
      }
    };
    put("company_name", data.companyName);
    put("owner_name", data.ownerName);
    put("phone", data.phone);
    put("business_number", data.businessNumber);
    put("cert_path", data.certPath);
    put("staff_name", data.staffName);
    put("staff_phone", data.staffPhone);
    put("bank_name", data.bankName);
    put("bank_account", data.bankAccount);
    put("bank_holder", data.bankHolder);

    const { error } = await context.supabase.from("profiles").upsert(row, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
