/**
 * 사다리차 자동 요금 — 층수와 5톤·1톤 차량 대수로 한 지점(출발지 또는 도착지) 금액을 계산합니다.
 * 기준이 없는 층수·차량 조합은 null 을 돌려줍니다(임의 금액이나 0원으로 확정하지 않음).
 */

/** 층별 기본요금(원). 25층 기본요금은 아직 정해지지 않아 비워 둡니다. */
export function ladderBaseFee(floor: number): number | null {
  const f = Math.floor(Number(floor));
  if (!Number.isFinite(f) || f < 2) return null;
  if (f <= 5) return 150000;
  if (f <= 7) return 160000;
  if (f <= 9) return 170000;
  if (f <= 11) return 180000;
  if (f <= 13) return 190000;
  if (f === 14) return 200000;
  if (f <= 19) return 210000 + (f - 15) * 10000;
  if (f <= 24) return 280000 + (f - 20) * 30000;
  return null;
}

/** 추가 1톤 차량 1대당 요금(원) — 2~14층 3만 원, 15~25층 4만 원 */
export function ladderExtraUnit(floor: number): number | null {
  const f = Math.floor(Number(floor));
  if (!Number.isFinite(f) || f < 2 || f > 25) return null;
  return f <= 14 ? 30000 : 40000;
}

export type LadderAuto = { amount: number } | { amount: null; reason: string };

export function ladderAutoFee(floor: number, truck5t: number, truck1t: number): LadderAuto {
  const t5 = Math.max(0, Math.floor(Number(truck5t) || 0));
  const t1 = Math.max(0, Math.floor(Number(truck1t) || 0));
  const base = ladderBaseFee(floor);
  const unit = ladderExtraUnit(floor);
  if (base === null || unit === null) {
    return { amount: null, reason: `${floor}층 기본요금이 등록되지 않았습니다. 금액을 직접 입력해 주세요.` };
  }
  if (t5 >= 2) {
    return { amount: null, reason: "5톤 2대 이상은 정해진 기준이 없습니다. 금액을 직접 입력해 주세요." };
  }
  const extra = t5 === 1 ? t1 : Math.max(0, t1 - 3);
  return { amount: base + extra * unit };
}

type LadderFields = {
  extraOrigin?: import('./multi-origin').ExtraOrigin;
  fromFloor: number;
  toFloor: number;
  truck1t: number;
  truck5t: number;
  ladderFromTruck5t?: number;
  ladderFromTruck1t?: number;
  ladderToTruck5t?: number;
  ladderToTruck1t?: number;
  ladderFrom: boolean;
  ladderTo: boolean;
  ladderFromPrice: number;
  ladderToPrice: number;
  ladderFromSeparate: boolean;
  ladderToSeparate: boolean;
  ladderFromManual?: boolean;
  ladderToManual?: boolean;
  ladderFromNote?: string;
  ladderToNote?: string;
};

const TRIGGERS = ["fromFloor", "toFloor", "truck1t", "truck5t", "ladderFrom", "ladderTo", "fromEnv", "toEnv", "extraOrigin", "ladderFromTruck5t", "ladderFromTruck1t", "ladderToTruck5t", "ladderToTruck1t"];

/**
 * 층수·차량·사다리차 선택이 바뀐 수정에서만 호출됩니다(견적을 열기만 하면 바뀌지 않음).
 * 같은 입력이면 항상 같은 금액이라 반복 클릭해도 누적되지 않습니다.
 * 사장님이 직접 입력한 금액은 그 지점 사다리차를 다시 켜기 전까지 유지합니다.
 */
export function applyLadderAuto<T extends LadderFields>(next: T, patch: Partial<T>): T {
  if (!Object.keys(patch).some((k) => TRIGGERS.includes(k))) return next;
  const out: T = { ...next };
  if (out.extraOrigin) {
    const o = { ...out.extraOrigin };
    if (!o.ladder) { o.ladderPrice = 0; o.ladderNote = undefined; }
    else if (!o.ladderManual) {
      const auto = ladderAutoFee(o.floor ?? 0, o.truck5t ?? out.truck5t, o.truck1t ?? out.truck1t);
      o.ladderPrice = auto.amount ?? 0;
      o.ladderNote = auto.amount === null ? auto.reason : undefined;
    }
    out.extraOrigin = o;
  }
  for (const side of ["from", "to"] as const) {
    const on = side === "from" ? !!out.ladderFrom : !!out.ladderTo;
    const P = side === "from" ? "ladderFrom" : "ladderTo";
    const turnedOn = (patch as Record<string, unknown>)[P] === true;
    if (!on) {
      Object.assign(out, { [`${P}Price`]: 0, [`${P}Manual`]: false, [`${P}Note`]: undefined });
      continue;
    }
    if (turnedOn) Object.assign(out, { [`${P}Manual`]: false });
    if ((out as Record<string, unknown>)[`${P}Manual`]) continue;
    const floor = side === "from" ? out.fromFloor : out.toFloor;
    const t5 = side === 'from' ? out.ladderFromTruck5t : out.ladderToTruck5t;
    const t1 = side === 'from' ? out.ladderFromTruck1t : out.ladderToTruck1t;
    const auto = ladderAutoFee(floor, t5 ?? out.truck5t, t1 ?? out.truck1t);
    Object.assign(out, auto.amount === null
      ? { [`${P}Price`]: 0, [`${P}Note`]: auto.reason }
      : { [`${P}Price`]: auto.amount, [`${P}Note`]: undefined });
  }
  return out;
}
