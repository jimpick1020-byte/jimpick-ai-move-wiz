import { reservationStageOf, RESERVATION_STAGE_LABEL } from "./reservation-status";
import { paymentReview, type PaymentEvidence } from "./payment-review";

export type HomeReservationStage = Exclude<ReturnType<typeof reservationStageOf>, "reservation_request"> | "balance_waiting" | "interim_waiting";
export const HOME_STAGE_LABEL = { ...RESERVATION_STAGE_LABEL, card_waiting: "카드 예약 확인 대기", balance_waiting: "잔금 확인", interim_waiting: "중도금 확인" };

/** Review queues are independent of contract completion and can contain both kinds. */
export function homeReviewStages(input: Parameters<typeof homeReservationStageOf>[0] & { contractCancelled?: boolean }): HomeReservationStage[] {
  const pending = paymentReview(input.paymentReceipts ?? [], input.paymentStatus ?? "unpaid", 0, 0, 0, input.contractCancelled)?.receipts ?? [];
  const stages: HomeReservationStage[] = [];
  if (pending.some((r) => r.paymentKind !== "balance" && r.paymentKind !== "interim")) stages.push("deposit_waiting");
  if (pending.some((r) => r.paymentKind === "balance")) stages.push("balance_waiting");
  if (pending.some((r) => r.paymentKind === "interim")) stages.push("interim_waiting");
  return stages;
}

/** Callers supply latest-first rows; equal versions keep the first, never an older copy. */
export function latestTermsByEstimate<T extends { estimateId: string; sheetVersion: number }>(rows: readonly T[]): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const previous = latest.get(row.estimateId);
    if (!previous || row.sheetVersion > previous.sheetVersion) latest.set(row.estimateId, row);
  }
  return [...latest.values()];
}

/** Home groups use stored evidence, without changing the underlying contract stage. */
export function homeReservationStageOf(input: Parameters<typeof reservationStageOf>[0] & { paymentReceipts?: PaymentEvidence[]; contractCancelled?: boolean }): HomeReservationStage {
  // A legacy claim flag/consent is not evidence: only the current receipt rows define review.
  const reviews = homeReviewStages(input);
  const stage = reservationStageOf({ ...input, depositClaimPending: reviews.includes("deposit_waiting") });
  if (stage === "payment_completed") return stage;
  if (reviews.includes("balance_waiting")) return "balance_waiting";
  if (reviews.includes("interim_waiting")) return "interim_waiting";
  if (reviews.includes("deposit_waiting")) return "deposit_waiting";
  // Preserve the request badge in history, without inventing a payment-review queue.
  return stage === "reservation_request" ? "estimate_notice" : stage;
}
