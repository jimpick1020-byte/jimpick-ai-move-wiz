import { itemNameById } from "./jimpick";
import { ICON3D, guessIcon3d } from "./jimpick-icon3d";
import type { BuiltinOf } from "./shared-item-repair";

/** 기본 품목 — 작성 카드가 쓰는 같은 그림 리소스(ICON3D, 이사박스·바구니 포함) */
export const builtinItemOf: BuiltinOf = (id, name) => {
  const known = itemNameById(id);
  const icon = ICON3D[id];
  if (!known && !icon) return null;
  return { name: known, icon: icon ?? guessIcon3d(name || known || "") ?? "/assets/items-3d/packing/moving-box-medium.webp" };
};
