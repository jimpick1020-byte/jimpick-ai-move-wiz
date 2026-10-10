export interface MonthlyStatRow {
  estimate_id: string;
  sheet_version: number;
  move_date: string | null;
  total: number;
  deposit_paid: number;
  balance_paid: number;
  payment_status: string | null;
  contract_status: string | null;
}

/** 예약금 입금 확인(예약 확정·결제 완료)만 통계에 넣습니다. 취소·환불은 제외. */
export function isDepositConfirmedRow(r: MonthlyStatRow): boolean {
  if (r.contract_status === "cancelled") return false;
  const s = (r.payment_status ?? "").trim();
  if (s === "canceled" || s === "refunded") return false;
  return (
    Number(r.deposit_paid) > 0 || Number(r.balance_paid) > 0 ||
    ["deposit_paid", "partial", "balance_paid", "completed"].includes(s)
  );
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const MOVE_TYPE_BADGE: Record<string, string> = {
  반포장이사: "bg-[#E3EEFB] text-[#1E4F91]",
  포장이사: "bg-[#E2F4E8] text-[#1F6B3A]",
  일반이사: "bg-[#FCEBDC] text-[#9A4A12]",
  보관이사: "bg-[#EEE7FA] text-[#5B3A9A]",
};
