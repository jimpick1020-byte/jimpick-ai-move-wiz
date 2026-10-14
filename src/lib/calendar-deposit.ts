export interface CalendarPayment {
  payment_status: string | null;
  deposit_paid: number | null;
  deposit_paid_at?: string | null;
  payment_confirmed_at?: string | null;
}

/** A contract amount alone is not proof of an owner-confirmed receipt. */
export function calendarDepositConfirmed(terms: CalendarPayment, receiptConfirmed: boolean): boolean {
  return receiptConfirmed && Number(terms.deposit_paid ?? 0) > 0
    && !!(terms.deposit_paid_at || terms.payment_confirmed_at)
    && ["deposit_paid", "partial", "completed"].includes(terms.payment_status ?? "unpaid");
}