export const NEW_TRIAL_DAYS = 10;
export interface PayappTestState {
  mode: "test";
  status: "registered" | "active" | "canceled";
  registeredAt: string;
  nextBillingAt: string;
  trialEndsAt: string;
  events: string[];
  simulatedTotal: number;
  actualCharged: number;
  consentedAt?: string;
  firstPaidAt?: string;
  checkout?: "pending" | "succeeded" | "failed" | "canceled";
  trialBillingCanceled?: boolean;
}

export function nextMonth(at: string): string {
  const d = new Date(at);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}

export function registerTest(at: string, trialEndsAt: string): PayappTestState {
  const nextBillingAt = new Date(trialEndsAt) > new Date(at) ? trialEndsAt : at;
  return { mode: "test", status: "registered", registeredAt: at, trialEndsAt, nextBillingAt,
    events: [], simulatedTotal: 0, actualCharged: 0 };
}

export function notifyTest(state: PayappTestState, event: string, amount: number) {
  if (state.events.includes(event)) return { state, duplicate: true };
  if (state.checkout && !state.firstPaidAt) throw new Error("첫 결제 승인 후 갱신 시험을 진행해 주세요.");
  if (state.status === "canceled") throw new Error("해지한 시험 구독은 갱신할 수 없습니다.");
  if (amount !== 30000) throw new Error("구독 금액이 일치하지 않습니다.");
  return { duplicate: false, state: { ...state, status: "active" as const,
    nextBillingAt: nextMonth(state.nextBillingAt), events: [...state.events, event],
    simulatedTotal: state.simulatedTotal + amount, actualCharged: 0 } };
}

export function cancelTest(state: PayappTestState): PayappTestState {
  return { ...state, status: "canceled" };
}

// Isolated simulation: these values never grant a real entitlement or call a merchant.
export function startImmediateTest(state: PayappTestState | null, at: string, trialEndsAt: string, consent: boolean) {
  if (!consent) throw new Error("월 30,000원 즉시 결제와 정기결제에 동의해 주세요.");
  if (state?.firstPaidAt || state?.checkout === "pending") return { state, duplicate: true };
  const base = state && state.status !== "canceled" ? state : registerTest(at, trialEndsAt);
  return { duplicate: false, state: { ...base, consentedAt: at, checkout: "pending" as const } };
}

export function approveImmediateTest(state: PayappTestState, at: string, amount: number) {
  if (amount !== 30000) throw new Error("구독 금액이 일치하지 않습니다.");
  if (state.firstPaidAt) return { state, duplicate: true };
  if (state.checkout !== "pending" || !state.consentedAt) throw new Error("즉시 구독 동의를 먼저 확인해 주세요.");
  return { duplicate: false, state: { ...state, status: "active" as const, checkout: "succeeded" as const,
    firstPaidAt: at, nextBillingAt: nextMonth(at), trialBillingCanceled: true,
    events: [...state.events, "mock:immediate:first"], simulatedTotal: state.simulatedTotal + amount, actualCharged: 0 } };
}

export function rejectImmediateTest(state: PayappTestState, result: "failed" | "canceled") {
  if (state.firstPaidAt) throw new Error("이미 승인된 시험 결제는 취소·실패로 변경할 수 없습니다.");
  if (state.checkout !== "pending") throw new Error("진행 중인 시험 결제가 없습니다.");
  return { ...state, checkout: result };
}