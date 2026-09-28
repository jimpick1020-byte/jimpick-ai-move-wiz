import { normalizePaymentStatus } from "./payment.functions";

export type ReservationStage =
  | "estimate_notice"
  | "reservation_request"
  | "deposit_waiting"
  | "reservation_confirmed"
  | "payment_completed";

export const RESERVATION_STAGE_LABEL: Record<ReservationStage, string> = {
  estimate_notice: "견적 안내",
  reservation_request: "예약 요청",
  deposit_waiting: "입금 대기",
  reservation_confirmed: "예약 확정",
  payment_completed: "결제 완료",
};

export const RESERVATION_STAGE_CLASS: Record<ReservationStage, string> = {
  estimate_notice: "bg-[#F3F4F6] text-[#6B7280]",
  reservation_request: "bg-[#EAF2FC] text-[#1D4ED8]",
  deposit_waiting: "bg-[#FEF3C7] text-[#B45309]",
  reservation_confirmed: "bg-[#E7F3EE] text-[#2F7A5E]",
  payment_completed: "bg-[#DDF8F1] text-[#187765]",
};

/** 모든 화면이 실제 동의·입금·결제 기록으로 같은 예약 단계를 계산합니다. */
export function reservationStageOf(input: {
  paymentStatus?: string | null;
  depositPaid?: number | null;
  balancePaid?: number | null;
  acceptedAt?: string | null;
  reservationStatus?: string | null;
  depositClaimPending?: boolean;
}): ReservationStage {
  const payment = normalizePaymentStatus(input.paymentStatus);
  if (payment === "completed") return "payment_completed";
  if (
    Number(input.depositPaid ?? 0) > 0 ||
    Number(input.balancePaid ?? 0) > 0 ||
    payment === "deposit_paid" ||
    payment === "partial"
  ) return "reservation_confirmed";
  if (input.depositClaimPending) return "deposit_waiting";
  if (input.acceptedAt && input.reservationStatus !== "canceled") return "reservation_request";
  return "estimate_notice";
}