import { reservationStageOf, RESERVATION_STAGE_LABEL } from "./reservation-status";
import { pendingReceipt, type PaymentEvidence } from "./payment-review";

export type HomeReservationStage = Exclude<ReturnType<typeof reservationStageOf>, "reservation_request"> | "balance_waiting";
export const HOME_STAGE_LABEL = { ...RESERVATION_STAGE_LABEL, balance_waiting: "잔금 대기" };

/** Home groups use stored evidence, without changing the underlying contract stage. */
export function homeReservationStageOf(input: Parameters<typeof reservationStageOf>[0] & { paymentReceipts?: PaymentEvidence[] }): HomeReservationStage {
  const stage = reservationStageOf(input);
  if (stage === "payment_completed") return stage;
  if (input.paymentReceipts?.some((receipt) => receipt.paymentKind === "balance" && pendingReceipt(receipt))) return "balance_waiting";
  // 은행 입금 문자로 연결된 예약금 기록도 고객 신고와 같이 입금 대기로 셉니다.
  if (stage !== "reservation_confirmed" && input.paymentReceipts?.some((receipt) => receipt.paymentKind !== "balance" && pendingReceipt(receipt))) return "deposit_waiting";
  return stage === "reservation_request" ? "deposit_waiting" : stage;
}
