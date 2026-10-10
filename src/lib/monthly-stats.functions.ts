import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isDepositConfirmedRow, type MonthlyStatRow } from "./monthly-stats";

/**
 * 선택한 달(이사 날짜 기준, 한국시간)의 예약금 입금 확인 계약만 집계합니다.
 * 로그인한 업체(user_id = company_id) 자료만 읽고, 삭제·취소 계약은 제외합니다.
 */
export const getMonthlyStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("estimate_terms")
      .select("estimate_id, sheet_version, move_date, total, deposit_paid, balance_paid, payment_status, contract_status")
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .like("move_date", `${data.month}%`)
      .limit(2000);
    if (error) {
      console.error("[getMonthlyStats]", error.message);
      return { ok: false as const, count: 0, revenue: 0 };
    }
    // 같은 견적의 여러 차수는 최신 차수 하나만 셉니다
    const latest = new Map<string, MonthlyStatRow>();
    for (const r of (rows ?? []) as MonthlyStatRow[]) {
      const p = latest.get(r.estimate_id);
      if (!p || Number(r.sheet_version) >= Number(p.sheet_version)) latest.set(r.estimate_id, r);
    }
    let count = 0, revenue = 0;
    for (const r of latest.values()) {
      if (!isDepositConfirmedRow(r)) continue;
      count++;
      revenue += Math.max(0, Number(r.total) || 0);
    }
    return { ok: true as const, count, revenue };
  });
