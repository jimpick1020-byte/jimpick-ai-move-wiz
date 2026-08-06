/**
 * 트럭 적재 게이지 — 6단계에서 짐을 담을수록 트럭이 차오릅니다.
 *
 * 4단계에서 고른 차량(1톤·5톤)에 지금 담은 짐이 들어가는지
 * 견적을 계산하기 **전에** 알려 줍니다.
 */
import { TRUCK_CAPACITY, type TruckLoad } from "@/lib/jimpick";

/** 상태별 색 — 여유(파랑) · 빠듯(주황) · 넘침(빨강) */
const TONE = {
  ok: { main: "#0751D8", soft: "#4A94FF", bg: "#EEF4FF", line: "#BFD4FF", text: "#0751D8" },
  tight: { main: "#B45309", soft: "#FB923C", bg: "#FFF6EC", line: "#FBD9AE", text: "#B45309" },
  over: { main: "#B91C1C", soft: "#F87171", bg: "#FEF2F2", line: "#FBC4C4", text: "#B91C1C" },
  none: { main: "#475569", soft: "#94A3B8", bg: "#F4F7FC", line: "#DFE6F2", text: "#475569" },
} as const;

type ToneKey = keyof typeof TONE;

const toneOf = (s: TruckLoad["status"]): ToneKey =>
  s === "over" ? "over" : s === "tight" ? "tight" : s === "ok" ? "ok" : "none";

/** 대수를 "1톤 2대 · 5톤 1대" 처럼 */
function trucksText(t: { truck1t: number; truck5t: number }) {
  const parts: string[] = [];
  if (t.truck5t > 0) parts.push(`5톤 ${t.truck5t}대`);
  if (t.truck1t > 0) parts.push(`1톤 ${t.truck1t}대`);
  return parts.join(" · ") || "없음";
}

/** 짐이 차오르는 트럭 그림 */
function TruckArt({ fill, tone }: { fill: number; tone: ToneKey }) {
  const c = TONE[tone];
  // 적재함 안쪽: x 6~44, y 14~40 (26 높이)
  const h = Math.max(0, Math.min(1, fill)) * 26;
  const y = 40 - h;
  return (
    <svg
      viewBox="0 0 96 56"
      className="h-[54px] w-[92px] shrink-0"
      role="img"
      aria-label="트럭 적재량"
    >
      {/* 바닥 그림자 */}
      <ellipse cx="48" cy="52" rx="34" ry="3" fill="#0751D8" opacity="0.14" />

      {/* 적재함 */}
      <rect
        x="4"
        y="12"
        width="42"
        height="30"
        rx="3"
        fill="#FFFFFF"
        stroke={c.line}
        strokeWidth="2"
      />
      {/* 차오르는 짐 */}
      {h > 0 && (
        <>
          <rect x="6" y={y} width="38" height={h} rx="1.5" fill={c.soft} />
          <rect
            x="6"
            y={y}
            width="38"
            height={Math.min(h, 3)}
            rx="1.5"
            fill="#FFFFFF"
            opacity="0.35"
          />
        </>
      )}
      {/* 넘친 짐이 위로 삐져나온 표시 */}
      {fill > 1 && (
        <>
          <rect x="11" y="5" width="11" height="8" rx="1.5" fill={c.main} />
          <rect x="26" y="2" width="13" height="11" rx="1.5" fill={c.soft} />
          <path d="M30 6h5M30 9h5" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.7" />
        </>
      )}

      {/* 운전석 */}
      <path d="M48 20h14l10 11v11H48z" fill={c.main} />
      <path d="M51 23h9l7 8H51z" fill="#DCE8FB" />
      {/* 캐릭터 눈·미소 */}
      <circle cx="55.5" cy="36" r="1.7" fill="#FFFFFF" />
      <circle cx="63.5" cy="36" r="1.7" fill="#FFFFFF" />
      <path
        d="M56.5 39.5a4 4 0 0 0 6 0"
        stroke="#FFFFFF"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />

      {/* 바퀴 */}
      <circle cx="18" cy="45" r="6" fill="#1F2937" />
      <circle cx="18" cy="45" r="2.4" fill="#94A3B8" />
      <circle cx="62" cy="45" r="6" fill="#1F2937" />
      <circle cx="62" cy="45" r="2.4" fill="#94A3B8" />
    </svg>
  );
}

export function TruckGauge({
  load,
  onFixTrucks,
}: {
  load: TruckLoad;
  /** "차량 늘리기" 를 눌렀을 때 (4단계로 보내거나 바로 반영) */
  onFixTrucks?: (need: { truck1t: number; truck5t: number }) => void;
}) {
  const tone = toneOf(load.status);
  const c = TONE[tone];
  const bar = Math.min(100, load.percent);

  // 차량을 아직 안 골랐으면 게이지 대신 추천만 보여 줍니다
  const noTruck = load.status === "none";
  const fill = noTruck
    ? Math.min(1, load.volume / TRUCK_CAPACITY.truck1t)
    : load.volume / (load.capacity || 1);

  const headline = noTruck
    ? "차량을 아직 안 고르셨어요"
    : load.status === "over"
      ? `${load.shortage}루베가 안 실려요`
      : load.status === "tight"
        ? "거의 꽉 찼어요"
        : "여유 있어요";

  return (
    <div
      className="rounded-3xl border px-4 py-3"
      style={{ background: c.bg, borderColor: c.line }}
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <TruckArt fill={fill} tone={tone} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black tabular-nums" style={{ color: c.text }}>
              {noTruck ? `${load.volume}루베` : `${load.percent}%`}
            </span>
            <span className="truncate text-xs font-bold" style={{ color: c.text }}>
              {headline}
            </span>
          </div>

          {/* 막대 */}
          <div
            className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full"
            style={{ background: "#FFFFFF" }}
            role="progressbar"
            aria-valuenow={load.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${noTruck ? Math.min(100, fill * 100) : bar}%`,
                background: `linear-gradient(90deg, ${c.soft} 0%, ${c.main} 100%)`,
              }}
            />
          </div>

          <div className="mt-1 text-[11px] font-semibold text-[#64748B]">
            {noTruck ? (
              <>추천: {trucksText(load.need)}</>
            ) : (
              <>
                짐 {load.volume}루베 / 실을 수 있는 양 {load.capacity}루베
              </>
            )}
          </div>
        </div>
      </div>

      {/* 부족하거나 안 골랐을 때만 행동 버튼 */}
      {(load.status === "over" || noTruck) && onFixTrucks && (
        <button
          onClick={() => onFixTrucks(load.need)}
          className="mt-2.5 min-h-11 w-full rounded-2xl text-sm font-black text-white transition-transform active:translate-y-[2px]"
          style={{ background: `linear-gradient(180deg, ${c.soft} 0%, ${c.main} 100%)` }}
        >
          {trucksText(load.need)}로 바꾸기
        </button>
      )}
    </div>
  );
}
