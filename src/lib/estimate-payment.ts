/** Apply one company/estimate ledger projection; never derive money from a status label. */
export interface EstimatePaymentProjection {
  estimate_id: string;
  total: number;
  deposit_paid: number;
  balance_paid: number;
  payment_status: string;
  deposit_paid_at: string | null;
  interim_paid?: number;
  planned_interim?: number;
  storage_origin_completed_at?: string | null;
}
export async function loadEstimatePayments(client: { rpc: Function }, company: string, ids: string[]) {
  const result = new Map<string, EstimatePaymentProjection>();
  const unique = [...new Set(ids)].filter(Boolean);
  for (let start = 0; start < unique.length; start += 200) {
    const { data, error } = await client.rpc("read_estimate_payments", { p_company: company, p_estimates: unique.slice(start, start + 200) });
    if (error) throw new Error("확인된 입금 금액을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.");
    for (const row of (data ?? []) as EstimatePaymentProjection[]) result.set(row.estimate_id, row);
    const storage = await client.rpc("read_storage_payments", { p_company: company, p_estimates: unique.slice(start, start + 200) });
    if (storage.error) throw new Error("입금 금액을 불러오지 못했습니다.");
    for (const row of (storage.data ?? []) as Pick<EstimatePaymentProjection, "estimate_id" | "interim_paid" | "planned_interim" | "storage_origin_completed_at">[]) {
      const current = result.get(row.estimate_id);
      if (current) result.set(row.estimate_id, { ...current, ...row });
    }
  }
  return result;
}