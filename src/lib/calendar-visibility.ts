import { reservationStageOf } from "./reservation-status";

/** 달력 표시 판단에 쓰는 견적서의 결제 필드 */
export interface CalendarTermsPayment {
  payment_status: string | null;
  deposit_paid: number | null;
  balance_paid?: number | null;
}

/**
 * 견적내역이 「예약 확정」·「결제 완료」로 표시하는 견적은 이사 날짜 달력에 무조건 표시합니다.
 *
 * 견적내역과 같은 단계 계산(reservationStageOf)을 그대로 쓰므로, 두 화면이
 * 서로 다른 기준(입금 확인서 유무 등)으로 다른 견적을 보여주지 않습니다.
 * 예약 요청·입금 대기·견적 안내는 달력에 올리지 않습니다.
 */
export function calendarReservationShown(terms: CalendarTermsPayment): boolean {
  const stage = reservationStageOf({
    paymentStatus: terms.payment_status,
    depositPaid: terms.deposit_paid,
    balancePaid: terms.balance_paid ?? 0,
  });
  return stage === "reservation_confirmed" || stage === "payment_completed";
}
