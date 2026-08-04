// 3D 아트 에셋 레지스트리
import bed from "@/assets/item-bed.png";
import wardrobe from "@/assets/item-wardrobe.png";
import sofa from "@/assets/item-sofa.png";
import fridge from "@/assets/item-fridge.png";
import washer from "@/assets/item-washer.png";
import tv from "@/assets/item-tv.png";
import table from "@/assets/item-table.png";
import chair from "@/assets/item-chair.png";
import desk from "@/assets/item-desk.png";
import shelf from "@/assets/item-shelf.png";
import aircon from "@/assets/item-aircon.png";
import microwave from "@/assets/item-microwave.png";
import waterpurifier from "@/assets/item-waterpurifier.png";
import kimchi from "@/assets/item-kimchi.png";
import vanity from "@/assets/item-vanity.png";
import drawer from "@/assets/item-drawer.png";
import piano from "@/assets/item-piano.png";
import box from "@/assets/item-box.png";

import roomMaster from "@/assets/room-master.png";
import roomSmall from "@/assets/room-small.png";
import roomEntry from "@/assets/room-entry.png";
import roomLiving from "@/assets/room-living.png";
import roomKitchen from "@/assets/room-kitchen.png";
import roomBalcony from "@/assets/room-balcony.png";

import truck1t from "@/assets/veh-truck1t.png";
import truck5t from "@/assets/veh-truck5t.png";
import ladder from "@/assets/veh-ladder.png";
import charMale from "@/assets/char-male.png";
import charFemale from "@/assets/char-female.png";
import envStairs from "@/assets/env-stairs.png";
import envElevator from "@/assets/env-elevator.png";


export const ITEM_IMG: Record<string, string> = {
  bed, wardrobe, sofa, fridge, washer, tv, table, chair,
  desk, shelf, aircon, microwave, waterpurifier, kimchi, vanity, drawer, piano, box,
};

/** 매칭되는 3D 이미지가 없을 때 쓰는 기본 이미지 */
export const FALLBACK_IMG = box;

export const ROOM_IMG: Record<string, string> = {
  안방: roomMaster,
  작은방: roomSmall,
  입구방: roomEntry,
  거실: roomLiving,
  부엌: roomKitchen,
  베란다: roomBalcony,
};

export const VEHICLE_IMG = { truck1t, truck5t, ladder };
export const ENV_IMG = { 계단: envStairs, 엘리베이터: envElevator };

export const CHAR_IMG = { male: charMale, female: charFemale };

/** 3D 에셋 표시용 — 부드러운 바닥 그림자 포함 */
export function Art3D({
  src,
  alt,
  size = 64,
  className = "",
}: {
  src?: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  if (!src) return null;
  return (
    <span
      className={`relative inline-flex items-end justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-[50%] blur-[6px]"
        style={{
          width: size * 0.7,
          height: size * 0.12,
          background: "rgba(7,81,216,0.22)",
        }}
      />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        width={size}
        height={size}
        className="relative w-full h-full object-contain drop-shadow-[0_6px_10px_rgba(15,23,42,0.12)]"
      />
    </span>
  );
}

/** 품목 이름만으로 알맞은 3D 이미지를 자동 매칭 */
const NAME_IMG: { words: string[]; img: string }[] = [
  { words: ["피아노", "디지털피아노", "건반"], img: piano },
  { words: ["김치냉장고", "김치", "쌀통", "장독"], img: kimchi },
  { words: ["냉장고", "냉동고", "와인셀러"], img: fridge },
  { words: ["세탁기", "건조기", "스타일러"], img: washer },
  { words: ["tv", "티비", "텔레비", "모니터", "프로젝터", "게임기"], img: tv },
  { words: ["침대", "매트리스", "이불", "요"], img: bed },
  { words: ["장롱", "옷장", "붙박이", "행거", "옷걸이"], img: wardrobe },
  { words: ["소파", "쇼파", "리클라이너", "안마의자"], img: sofa },
  { words: ["식탁", "테이블", "아일랜드", "대리석"], img: table },
  { words: ["의자", "체어", "스툴"], img: chair },
  { words: ["책상", "데스크", "컴퓨터", "pc", "프린터"], img: desk },
  { words: ["책장", "선반", "진열장", "장식장", "파티션", "그릇장", "tv장", "거실장"], img: shelf },
  { words: ["에어컨", "공기청정", "제습", "가습", "선풍기", "온풍", "히터", "스피커", "오디오"], img: aircon },
  { words: ["전자레인지", "레인지", "오븐", "에어프라이", "밥솥", "인덕션", "토스터", "믹서", "포트", "식기세척"], img: microwave },
  { words: ["정수기", "커피"], img: waterpurifier },
  { words: ["화장대", "거울", "액자", "조명", "스탠드"], img: vanity },
  { words: ["서랍", "협탁", "수납", "신발장", "정리함", "금고"], img: drawer },
  { words: ["박스", "상자", "바구니", "잡화", "비닐", "짐", "가방", "캐리어"], img: box },
];


export function guessItemImg(name: string): string | undefined {
  const n = (name || "").toLowerCase().replace(/\s/g, "");
  for (const { words, img } of NAME_IMG) {
    if (words.some((w) => n.includes(w))) return img;
  }
  return undefined;
}
