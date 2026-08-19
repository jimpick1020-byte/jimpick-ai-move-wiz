/**
 * 집 안을 촬영해 주는 짐픽 마스코트.
 *
 * 앱 전체와 같은 파란 모자 직원 캐릭터를 씁니다.
 *   idle      기다리는 중 (둥실둥실)
 *   shooting  찰칵 — 플래시가 터집니다
 *   analyzing 스캔선이 지나갑니다
 */
import charSrc from "@/assets/jimpick-char-c.png";

export type MascotState = "idle" | "shooting" | "analyzing";

export function ScanMascot({
  state = "idle",
  size = 168,
  className = "",
}: {
  state?: MascotState;
  size?: number;
  className?: string;
}) {
  const shooting = state === "shooting";
  const analyzing = state === "analyzing";

  return (
    <span
      className={`relative inline-flex shrink-0 items-end justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* 분석 중일 때 지나가는 스캔선 */}
      {analyzing && (
        <span className="pointer-events-none absolute inset-x-[14%] inset-y-[10%] z-10 overflow-hidden rounded-2xl">
          <span className="jp-scanline absolute left-0 h-[3px] w-full rounded-full bg-gradient-to-r from-transparent via-[#38BDF8] to-transparent" />
        </span>
      )}

      {/* 찰칵 — 플래시 */}
      {shooting && (
        <span className="pointer-events-none absolute inset-0 z-10 rounded-3xl bg-white/70" />
      )}

      <img
        src={charSrc}
        alt=""
        loading="lazy"
        width={size}
        height={size}
        className={`relative h-full w-full object-contain drop-shadow-[0_10px_18px_rgba(7,81,216,0.22)] ${
          analyzing ? "" : "jp-float"
        }`}
      />
    </span>
  );
}
