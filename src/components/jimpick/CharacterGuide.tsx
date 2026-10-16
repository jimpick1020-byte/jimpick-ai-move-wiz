/**
 * JIMPICK 공식 캐릭터 안내 (같은 캐릭터, 화면별 자세만 다름).
 * 원본은 투명 PNG(1024px), 화면에는 2배 해상도 WebP를 srcset 으로 씁니다.
 * 파일명에 버전(v1)을 넣어 캐시 문제를 막습니다.
 */
import clipboard240 from "@/assets/character/char-clipboard-v1-240.webp";
import clipboard480 from "@/assets/character/char-clipboard-v1-480.webp";
import mappin240 from "@/assets/character/char-mappin-v1-240.webp";
import mappin480 from "@/assets/character/char-mappin-v1-480.webp";
import elevator240 from "@/assets/character/char-elevator-v1-240.webp";
import elevator480 from "@/assets/character/char-elevator-v1-480.webp";
import house240 from "@/assets/character/char-house-v1-240.webp";
import house480 from "@/assets/character/char-house-v1-480.webp";
import boxes240 from "@/assets/character/char-boxes-v1-240.webp";
import boxes480 from "@/assets/character/char-boxes-v1-480.webp";
import calculator240 from "@/assets/character/char-calculator-v1-240.webp";
import calculator480 from "@/assets/character/char-calculator-v1-480.webp";
import document240 from "@/assets/character/char-document-v1-240.webp";
import document480 from "@/assets/character/char-document-v1-480.webp";
import thumbsup240 from "@/assets/character/char-thumbsup-v1-240.webp";
import thumbsup480 from "@/assets/character/char-thumbsup-v1-480.webp";
import camera240 from "@/assets/character/char-camera-v1-240.webp";
import camera480 from "@/assets/character/char-camera-v1-480.webp";

const POSES = {
  clipboard: [clipboard240, clipboard480],
  mappin: [mappin240, mappin480],
  elevator: [elevator240, elevator480],
  house: [house240, house480],
  boxes: [boxes240, boxes480],
  calculator: [calculator240, calculator480],
  document: [document240, document480],
  thumbsup: [thumbsup240, thumbsup480],
  camera: [camera240, camera480],
} as const;
export type CharacterPose = keyof typeof POSES;

export function CharacterImg({ pose, size = 88, priority = false, className = "" }: { pose: CharacterPose; size?: number; priority?: boolean; className?: string }) {
  const [s, l] = POSES[pose];
  return (
    <img
      src={s}
      srcSet={`${s} 240w, ${l} 480w`}
      sizes={`${size}px`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      draggable={false}
      className={`shrink-0 select-none pointer-events-none ${className}`}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}

/** 단계 상단 안내 — 캐릭터 + 말풍선. 입력창 위에 별도 줄로 놓여 가리지 않습니다. */
export function CharacterGuide({ pose, text, priority = false }: { pose: CharacterPose; text: string; priority?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-primary/5 px-3 py-2" data-character-guide={pose}>
      <CharacterImg pose={pose} size={84} priority={priority} />
      <p className="flex-1 text-[17px] font-black leading-snug text-foreground">{text}</p>
    </div>
  );
}
