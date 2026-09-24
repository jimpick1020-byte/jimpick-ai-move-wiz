/**
 * 견적 건수 집계 — 홈(견적 현황)과 견적 내역·완료 보관함이
 * 반드시 같은 기준으로 같은 숫자를 보여 주도록 한 곳에서만 계산합니다.
 *
 * 기준 (모든 화면 공통):
 * - 견적 한 건은 estimate_id 하나입니다 (고객 수가 아니라 견적 수, 중복 id는 한 번만 셉니다)
 * - 완료 = 결제상태가 「결제완료」인 견적만 → 완료 보관함
 * - 진행 중 = 예약금 완료·일부결제만 (돈이 들어와 진행 중인 견적)
 * - 미결제·결제대기는 진행 중에 세지 않습니다 (예약금이 들어오면 그때 진행 중이 됩니다)
 * - 총 견적 = 현재 견적 전체 (진행 중 + 완료 + 아직 예약금 없는 견적)
 */
import { normalizePaymentStatus } from "./payment.functions";
import type { TermsStatusRow } from "./terms.functions";
import type { ArchivedContractRow } from "./payment.functions";

export interface EstimateStats {
  /** 총 견적 = 진행 중 + 완료 (완료 보관함으로 옮긴 견적은 빠집니다) */
  total: number;
  inProgress: number;
  completed: number;
  /** 완료율 (%) = 완료 ÷ 총 견적 × 100 */
  pct: number;
  /** 현재 견적 내역에 보이는 견적 id (estimate_id 기준 중복 없음) */
  currentIds: Set<string>;
  /** 현재 견적 중 「완료」(결제완료만) */
  completedIds: Set<string>;
  inProgressIds: Set<string>;
  /** 완료 보관함으로 옮긴 견적 id — 현재 집계에서 제외 */
  archivedIds: Set<string>;
  /** 삭제·취소·환불로 제외한 견적 id */
  excludedIds: Set<string>;
}

export interface EstimateLike {
  id: string;
  createdAt?: number;
  phone?: string;
  customerName?: string;
}

/** 고객 고유 키 — 같은 고객은 한 사람으로 셉니다 (연락처 숫자, 없으면 이름) */
export function customerKeyOf(e: { phone?: string; customerName?: string }): string | null {
  const digits = (e.phone || "").replace(/[^0-9]/g, "");
  if (digits) return `p:${digits}`;
  const name = (e.customerName || "").trim();
  return name ? `n:${name}` : null;
}

/**
 * 하나의 공통 집계 함수. 홈(견적 현황·고객 현황)·견적 내역·고객 관리가 모두 이 함수를 씁니다.
 * 입력은 모두 로그인한 업체 본인의 데이터입니다 (서버에서 user_id로 제한).
 */
export function buildEstimateStats(input: {
  estimates: readonly EstimateLike[];
  termsRows: readonly TermsStatusRow[];
  archived?: readonly ArchivedContractRow[];
}): EstimateStats {
  const termsById = new Map<string, TermsStatusRow>();
  for (const r of input.termsRows) {
    if (!r.estimateId) continue;
    const prev = termsById.get(r.estimateId);
    // 같은 견적의 여러 차수는 가장 최신 차수 한 건만 씁니다 (중복 집계 방지)
    if (!prev || Number(r.sheetVersion ?? 1) >= Number(prev.sheetVersion ?? 1)) {
      termsById.set(r.estimateId, r);
    }
  }

  const excludedIds = new Set<string>();
  const archivedIds = new Set<string>();
  for (const [id, row] of termsById) {
    const status = normalizePaymentStatus(row.paymentStatus);
    if (status === "canceled" || status === "refunded") excludedIds.add(id);
    // 달력에서 완료 보관함으로 옮긴 결제완료 견적 → 현재 견적 집계에서 뺍니다
    else if (status === "completed" && row.calendarArchived) archivedIds.add(id);
  }

  const currentIds = new Set<string>();
  const completedIds = new Set<string>();
  const inProgressIds = new Set<string>();
  for (const e of input.estimates) {
    if (!e.id || currentIds.has(e.id)) continue;
    if (excludedIds.has(e.id) || archivedIds.has(e.id)) continue;
    currentIds.add(e.id);
    const st = normalizePaymentStatus(termsById.get(e.id)?.paymentStatus);
    // 결제완료만 완료, 예약금 완료·일부결제만 진행 중. 미결제·결제대기는 진행 중에 세지 않습니다.
    if (st === "completed") completedIds.add(e.id);
    else if (st === "deposit_paid" || st === "partial") inProgressIds.add(e.id);
  }

  const total = currentIds.size;
  const completed = completedIds.size;
  return {
    total,
    inProgress: inProgressIds.size,
    completed,
    pct: total ? Math.round((completed / total) * 100) : 0,
    currentIds,
    completedIds,
    inProgressIds,
    archivedIds,
    excludedIds,
  };
}
