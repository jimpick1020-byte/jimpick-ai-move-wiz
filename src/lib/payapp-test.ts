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
  if (state.status === "canceled") throw new Error("해지한 시험 구독은 갱신할 수 없습니다.");
  if (amount !== 30000) throw new Error("구독 금액이 일치하지 않습니다.");
  return { duplicate: false, state: { ...state, status: "active" as const,
    nextBillingAt: nextMonth(state.nextBillingAt), events: [...state.events, event],
    simulatedTotal: state.simulatedTotal + amount, actualCharged: 0 } };
}

export function cancelTest(state: PayappTestState): PayappTestState {
  return { ...state, status: "canceled" };
}