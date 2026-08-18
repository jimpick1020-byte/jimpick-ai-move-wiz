/**
 * 짐픽 AI 캐릭터.
 *
 * 상태에 따라 표정 대신 주변 효과가 달라집니다.
 *   idle        기본 — 조용히 떠 있습니다
 *   listening   듣는 중 — 파란 음성 파동
 *   processing  처리 중 — 작은 로딩 고리
 *   done        완료 — 체크 표시
 *   error       실패 — 캐릭터는 그대로 두고 문구만 바꿉니다
 *
 * 움직임을 싫어하는 설정(prefers-reduced-motion)을 켠 기기에서는
 * 애니메이션을 멈추고 정지된 모습만 보여 줍니다.
 */
import charSrc from "@/assets/jimpick-ai-character.webp";

export type CharacterState = "idle" | "listening" | "processing" | "done" | "error";

export function JimpickCharacter({
  state = "idle",
  size = 132,
  className = "",
  alt = "짐픽 AI 캐릭터",
}: {
  state?: CharacterState;
  /** 화면 폭에 맞춰 줄여서 씁니다 */
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* 듣는 중 — 부드러운 파란 파동 */}
      {state === "listening" && (
        <>
          <span
            aria-hidden
            className="jp-wave absolute inset-0 rounded-full border-2 border-[#0864DC]/35"
          />
          <span
            aria-hidden
            className="jp-wave jp-wave-2 absolute inset-0 rounded-full border-2 border-[#0864DC]/25"
          />
        </>
      )}

      {/* 처리 중 — 작은 로딩 고리 */}
      {state === "processing" && (
        <span
          aria-hidden
          className="jp-spin absolute inset-[6%] rounded-full border-[3px] border-[#DCE8FA] border-t-[#0864DC]"
        />
      )}

      <img
        src={charSrc}
        alt={alt}
        width={size}
        height={size}
        className={`relative h-full w-full object-contain ${
          state === "idle" || state === "listening" ? "jp-bob" : ""
        }`}
      />

      {/* 완료 — 체크 */}
      {state === "done" && (
        <span
          aria-hidden
          className="absolute bottom-0 right-0 flex h-[30%] w-[30%] items-center justify-center rounded-full bg-[#16A34A] shadow-[0_3px_0_#128038]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[60%] w-[60%]"
            fill="none"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}

      {/* 실패 — 캐릭터는 그대로 두고 표시만 답니다 */}
      {state === "error" && (
        <span
          aria-hidden
          className="absolute bottom-0 right-0 flex h-[30%] w-[30%] items-center justify-center rounded-full bg-[#EF4444] text-white shadow-[0_3px_0_#B91C1C]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[58%] w-[58%]"
            fill="none"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
          >
            <path d="M12 7v7M12 17.5v.5" />
          </svg>
        </span>
      )}
    </span>
  );
}
