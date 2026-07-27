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
  desk, shelf, aircon, microwave, waterpurifier, kimchi, vanity, drawer,
};

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
