/**
 * 집 안을 촬영해 주는 짐픽 마스코트.
 *
 * 품목 캐릭터(jimpick-chars)와 같은 규칙을 씁니다.
 *   - 바닥 그림자 + 동그란 눈 + 발그레한 볼
 *   - 위에서 빛이 드는 하이라이트
 *
 * 상태에 따라 표정과 움직임이 달라집니다.
 *   idle      말똥말똥 기다리는 중 (둥실둥실)
 *   shooting  찰칵 — 플래시가 터집니다
 *   analyzing 눈을 감고 집중, 스캔선이 지나갑니다
 */
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
        <span className="pointer-events-none absolute inset-x-[14%] z-10 overflow-hidden rounded-full">
          <span className="jp-scanline absolute left-0 h-[3px] w-full rounded-full bg-gradient-to-r from-transparent via-[#38BDF8] to-transparent" />
        </span>
      )}

      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        role="img"
        aria-label="카메라를 든 짐픽 캐릭터"
        className={`h-full w-full drop-shadow-[0_10px_18px_rgba(7,81,216,0.22)] ${
          analyzing ? "" : "jp-float"
        }`}
      >
        <defs>
          <linearGradient id="jp-mascot-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8FD2FF" />
            <stop offset="55%" stopColor="#4A94FF" />
            <stop offset="100%" stopColor="#0751D8" />
          </linearGradient>
          <linearGradient id="jp-mascot-cam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B4A63" />
            <stop offset="100%" stopColor="#1B2637" />
          </linearGradient>
          <radialGradient id="jp-mascot-lens" cx="38%" cy="32%" r="72%">
            <stop offset="0%" stopColor="#9BE3FF" />
            <stop offset="52%" stopColor="#2E8BFF" />
            <stop offset="100%" stopColor="#08306E" />
          </radialGradient>
        </defs>

        {/* 바닥 그림자 */}
        <ellipse cx="60" cy="110" rx="30" ry="5" fill="#0751D8" opacity="0.16" />

        {/* 몸통 */}
        <path
          d="M31 74a29 29 0 0 1 58 0v18a12 12 0 0 1-12 12H43a12 12 0 0 1-12-12z"
          fill="url(#jp-mascot-body)"
        />
        {/* 배 쪽 밝은 면 */}
        <ellipse cx="60" cy="86" rx="17" ry="14" fill="#EAF4FF" opacity="0.55" />

        {/* 발 */}
        <ellipse cx="47" cy="104" rx="8" ry="4.4" fill="#0B49B4" />
        <ellipse cx="73" cy="104" rx="8" ry="4.4" fill="#0B49B4" />

        {/* 머리 */}
        <circle cx="60" cy="45" r="25" fill="url(#jp-mascot-body)" />
        {/* 머리 위 하이라이트 */}
        <path d="M44 30a20 20 0 0 1 20-6 22 22 0 0 0-18 12z" fill="#FFFFFF" opacity="0.4" />

        {/* 눈 — 카메라 위로 빼꼼 */}
        {analyzing ? (
          <>
            <path
              d="M48.5 40.5a4.5 4.5 0 0 0 7 0"
              stroke="#12233F"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M64.5 40.5a4.5 4.5 0 0 0 7 0"
              stroke="#12233F"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <circle cx="52" cy="40" r="3.4" fill="#12233F" />
            <circle cx="68" cy="40" r="3.4" fill="#12233F" />
            <circle cx="53.2" cy="38.8" r="1.2" fill="#FFFFFF" />
            <circle cx="69.2" cy="38.8" r="1.2" fill="#FFFFFF" />
          </>
        )}
        {/* 볼터치 */}
        <circle cx="42" cy="47" r="4.2" fill="#FB7185" opacity="0.34" />
        <circle cx="78" cy="47" r="4.2" fill="#FB7185" opacity="0.34" />

        {/* 카메라 — 얼굴 아래를 가리며 들고 있습니다 */}
        <rect x="34" y="52" width="52" height="34" rx="9" fill="url(#jp-mascot-cam)" />
        {/* 뷰파인더 돌출부 */}
        <rect x="52" y="46" width="16" height="8" rx="3" fill="#2A374D" />
        {/* 셔터 버튼 */}
        <rect x="39" y="48" width="9" height="5" rx="2.5" fill="#FF7A90" />

        {/* 렌즈 */}
        <circle cx="60" cy="69" r="13" fill="#0E1A2B" />
        <circle cx="60" cy="69" r="10.5" fill="url(#jp-mascot-lens)" />
        <circle cx="56" cy="65" r="3.2" fill="#FFFFFF" opacity="0.75" />

        {/* 손 — 카메라를 양옆에서 잡고 있습니다 */}
        <ellipse cx="31" cy="76" rx="8" ry="7" fill="#5FA6FF" />
        <ellipse cx="89" cy="76" rx="8" ry="7" fill="#5FA6FF" />

        {/* 찰칵 — 플래시 */}
        {shooting && (
          <g>
            <circle cx="93" cy="47" r="6" fill="#FFE68A" opacity="0.95" />
            <path
              d="M93 33v7M93 54v7M79 47h7M100 47h7M83 37l5 5M103 37l-5 5M83 57l5-5M103 57l-5-5"
              stroke="#FFD24A"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </span>
  );
}
