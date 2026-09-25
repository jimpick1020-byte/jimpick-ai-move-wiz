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
  const completedStatusIds = new Set<string>();
  for (const [id, row] of termsById) {
    const status = normalizePaymentStatus(row.paymentStatus);
    if (status === "canceled" || status === "refunded") excludedIds.add(id);
    else if (status === "completed") {
      completedStatusIds.add(id);
      if (row.calendarArchived) archivedIds.add(id);
    }
  }
  for (const a of input.archived ?? []) {
    if (!a.estimateId || excludedIds.has(a.estimateId)) continue;
    completedStatusIds.add(a.estimateId);
    if (a.archivedAt) archivedIds.add(a.estimateId);
  }

  // 1) 모든 견적을 estimate_id 기준 하나의 배열로 (견적 내역 + 완료 보관함, 중복 없음)
  type Unique = { id: string; name: string; archived: boolean; status: string };
  const unique = new Map<string, Unique>();
  const norm = (s?: string) => (s || "").replace(/\s+/g, "");
  for (const a of input.archived ?? []) {
    if (!a.estimateId || unique.has(a.estimateId)) continue;
    unique.set(a.estimateId, { id: a.estimateId, name: norm(a.customerName), archived: archivedIds.has(a.estimateId), status: "completed" });
  }
  // 완료 견적 고객 이름 — 같은 견적이 서버 기록 없는 다른 id로 견적 내역에 남아 있으면 새 견적으로 세지 않습니다
  const completedNames = new Set<string>();
  for (const u of unique.values()) if (u.name) completedNames.add(u.name);
  const visibleOnly = new Set<string>();
  for (const e of input.estimates) {
    if (!e.id || unique.has(e.id)) continue;
    const row = termsById.get(e.id);
    const nm = norm(e.customerName);
    const status = completedStatusIds.has(e.id) ? "completed" : normalizePaymentStatus(row?.paymentStatus);
    // 서버 기록이 없는 같은 이름의 사본만 완료 견적과 같은 견적으로 봅니다.
    // 목록에서는 숨기지 않고, 숫자에서만 한 번 셉니다 (재방문 고객의 새 견적은 그대로 셉니다).
    if (nm && completedNames.has(nm) && !row && status !== "deposit_paid" && status !== "partial") {
      if (!excludedIds.has(e.id)) visibleOnly.add(e.id);
      continue;
    }
    if (excludedIds.has(e.id)) continue;
    unique.set(e.id, { id: e.id, name: nm, archived: archivedIds.has(e.id), status });
  }

  // 2) 상태별 분리
  const completedIds = new Set<string>();
  const inProgressIds = new Set<string>();
  for (const u of unique.values()) {
    if (excludedIds.has(u.id)) continue;
    if (u.archived || u.status === "completed") completedIds.add(u.id);
    else inProgressIds.add(u.id);
  }
  // 견적 내역에 보이는 현재 견적 = 진행 중 (완료·보관 제외)
  const currentIds = new Set<string>(inProgressIds);
  for (const id of visibleOnly) currentIds.add(id);
  for (const id of completedIds) if (!archivedIds.has(id) && input.estimates.some((e) => e.id === id)) currentIds.add(id);

  const total = inProgressIds.size + completedIds.size;
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
