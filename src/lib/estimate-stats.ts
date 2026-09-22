/**
 * 견적 건수 집계 — 홈(견적 현황)과 견적 내역·완료 보관함이
 * 반드시 같은 기준으로 같은 숫자를 보여 주도록 한 곳에서만 계산합니다.
 *
 * 기준 (모든 화면 공통):
 * - 견적 한 건은 estimate_id 하나입니다 (고객 수가 아니라 견적 수, 중복 id는 한 번만 셉니다)
 * - 진행 중 = 삭제·취소·환불이 아니고 전액 결제가 아닌 견적
 * - 완료 = 실제 확인된 금액이 총액 이상인(전액 결제) 견적 → 완료 보관함
 * - 예약금만 받은 견적은 「진행 중」입니다
 * - 총 견적 = 진행 중 + 완료
 */
import { isFullyPaid, normalizePaymentStatus } from "./payment.functions";
import type { TermsStatusRow } from "./terms.functions";
import type { ArchivedContractRow } from "./payment.functions";

export interface EstimateStats {
  /** 총 견적 = 진행 중 + 완료 */
  total: number;
  inProgress: number;
  completed: number;
  /** 완료율 (%) */
  pct: number;
  /** 완료(전액 결제)로 판정된 견적 id */
  completedIds: Set<string>;
  /** 취소·환불로 집계에서 제외한 견적 id */
  excludedIds: Set<string>;
}

export interface EstimateLike {
  id: string;
  createdAt?: number;
}

/**
 * 하나의 공통 집계 함수. 홈·견적 내역·완료 보관함이 모두 이 함수를 씁니다.
 * 입력은 모두 같은 업체(로그인 계정)의 실제 데이터입니다.
 */
export function buildEstimateStats(input: {
  /** 이 업체의 견적 목록 (삭제된 건은 이미 빠져 있습니다) */
  estimates: readonly EstimateLike[];
  /** Supabase estimate_terms 상태 (deleted_at is null) */
  termsRows: readonly TermsStatusRow[];
  /** Supabase 완료 보관함 목록 (전액 결제 계약) */
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
  const completedIds = new Set<string>();
  for (const [id, row] of termsById) {
    const status = normalizePaymentStatus(row.paymentStatus);
    if (status === "canceled" || status === "refunded") {
      excludedIds.add(id);
      continue;
    }
    if (isFullyPaid(row)) completedIds.add(id);
  }
  for (const a of input.archived ?? []) {
    if (!a.estimateId) continue;
    if (excludedIds.has(a.estimateId)) continue;
    if (
      isFullyPaid({
        total: a.total,
        depositPaid: a.depositPaid,
        balancePaid: a.balancePaid,
        paymentStatus: a.paymentStatus,
      })
    ) {
      completedIds.add(a.estimateId);
    }
  }

  const inProgressIds = new Set<string>();
  for (const e of input.estimates) {
    if (!e.id) continue;
    if (excludedIds.has(e.id)) continue;
    if (completedIds.has(e.id)) continue;
    inProgressIds.add(e.id);
  }

  const inProgress = inProgressIds.size;
  const completed = completedIds.size;
  const total = inProgress + completed;
  return {
    total,
    inProgress,
    completed,
    pct: total ? Math.round((completed / total) * 100) : 0,
    completedIds,
    excludedIds,
  };
}
