/**
 * 짐픽 품목 라인 아이콘 세트 (SVG)
 *
 * 모든 품목을 같은 규칙으로 그려 한 세트로 보이게 합니다.
 *   - 64×64 기준, 선 굵기 3.4, 끝·모서리는 둥글게
 *   - 색은 currentColor 를 따라가므로 쓰는 곳에서 색을 정합니다
 *   - 면을 칠하지 않아 작게 줄여도 또렷합니다
 *
 * 새 아이콘을 추가하려면
 *   1) ICONS 에 `이름: () => (<>...</>)` 한 줄 추가
 *   2) ITEM_LINE 에 품목 id 를 연결하거나, NAME_LINE 에 검색 단어를 넣으면 끝입니다.
 */
import type { ReactElement } from "react";

type Icon = () => ReactElement;

/** 바닥에 놓인 느낌을 주는 공통 받침선 */
const Floor = ({ x1 = 10, x2 = 54, y = 55 }: { x1?: number; x2?: number; y?: number }) => (
  <path d={`M${x1} ${y}h${x2 - x1}`} opacity="0.35" />
);

// ============================================================
// 아이콘
// ============================================================
const ICONS: Record<string, Icon> = {
  // ── 냉장·세탁 ───────────────────────────────────────────
  fridge: () => (
    <>
      <rect x="19" y="7" width="26" height="50" rx="5" />
      <path d="M19 26h26" />
      <path d="M25 15v6M25 33v8" />
    </>
  ),
  fridgeWide: () => (
    <>
      <rect x="12" y="9" width="40" height="46" rx="5" />
      <path d="M32 9v46" />
      <path d="M26 18v7M38 18v7" />
    </>
  ),
  washer: () => (
    <>
      <rect x="14" y="8" width="36" height="48" rx="5" />
      <circle cx="32" cy="36" r="11" />
      <circle cx="32" cy="36" r="4" />
      <path d="M20 17h8" />
    </>
  ),
  dryer: () => (
    <>
      <rect x="14" y="8" width="36" height="48" rx="5" />
      <circle cx="32" cy="36" r="11" />
      <path d="M27 33c2 2 3 4 5 3s3-3 5-1" />
      <path d="M20 17h8" />
    </>
  ),
  styler: () => (
    <>
      <rect x="17" y="7" width="30" height="50" rx="5" />
      <path d="M32 18v22" />
      <path d="M25 22h14" />
      <path d="M40 46h3" />
    </>
  ),

  // ── 영상·음향 ───────────────────────────────────────────
  tv: () => (
    <>
      <rect x="8" y="14" width="48" height="30" rx="4" />
      <path d="M32 44v8" />
      <path d="M21 52h22" />
    </>
  ),
  tvWall: () => (
    <>
      <rect x="8" y="16" width="48" height="30" rx="4" />
      <path d="M32 46v4" />
      <path d="M14 54h36" opacity="0.35" />
    </>
  ),
  projector: () => (
    <>
      <rect x="12" y="24" width="30" height="18" rx="4" />
      <circle cx="27" cy="33" r="5" />
      <path d="M46 27l8-5v22l-8-5" />
      <path d="M18 42v6M36 42v6" />
    </>
  ),
  speaker: () => (
    <>
      <rect x="19" y="7" width="26" height="50" rx="4" />
      <circle cx="32" cy="22" r="5" />
      <circle cx="32" cy="42" r="8" />
    </>
  ),
  console: () => (
    <>
      <rect x="8" y="24" width="48" height="20" rx="9" />
      <path d="M19 30v8M15 34h8" />
      <circle cx="43" cy="32" r="2" />
      <circle cx="48" cy="37" r="2" />
    </>
  ),

  // ── 공조·계절 ───────────────────────────────────────────
  aircon: () => (
    <>
      <rect x="20" y="6" width="24" height="46" rx="6" />
      <path d="M20 20h24" />
      <path d="M26 30h12M26 38h12" />
    </>
  ),
  airconWall: () => (
    <>
      <rect x="8" y="18" width="48" height="16" rx="6" />
      <path d="M16 28h32" />
      <path d="M22 40c0 4 4 4 4 8M32 40c0 4 4 4 4 8M42 40c0 4 4 4 4 8" />
    </>
  ),
  purifier: () => (
    <>
      <rect x="18" y="8" width="28" height="48" rx="7" />
      <circle cx="32" cy="24" r="7" />
      <path d="M24 40h16M24 47h16" />
    </>
  ),
  humid: () => (
    <>
      <rect x="20" y="24" width="24" height="32" rx="7" />
      <path d="M32 6c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" />
      <path d="M26 38h12" />
    </>
  ),
  fan: () => (
    <>
      <circle cx="32" cy="22" r="14" />
      <circle cx="32" cy="22" r="3" />
      <path d="M32 36v14" />
      <path d="M22 55h20" />
    </>
  ),
  heater: () => (
    <>
      <rect x="14" y="14" width="36" height="30" rx="6" />
      <path d="M24 22c0 4-3 5-3 8s3 4 3 6M32 22c0 4-3 5-3 8s3 4 3 6M40 22c0 4-3 5-3 8s3 4 3 6" />
      <path d="M22 50h20" />
    </>
  ),
  mat: () => (
    <>
      <rect x="8" y="20" width="48" height="26" rx="5" />
      <path d="M18 28c4 3 4 7 0 10M32 28c4 3 4 7 0 10M46 28c-4 3-4 7 0 10" />
    </>
  ),

  // ── 컴퓨터·사무 ─────────────────────────────────────────
  pc: () => (
    <>
      <rect x="10" y="12" width="44" height="28" rx="4" />
      <path d="M32 40v8" />
      <path d="M22 48h20" />
    </>
  ),
  printer: () => (
    <>
      <path d="M20 20V10h24v10" />
      <rect x="10" y="20" width="44" height="20" rx="5" />
      <path d="M20 40h24v14H20z" />
      <circle cx="46" cy="28" r="2" />
    </>
  ),

  // ── 청소·생활가전 ───────────────────────────────────────
  vacuum: () => (
    <>
      <path d="M18 52c0-14 6-24 16-24" />
      <rect x="34" y="20" width="18" height="16" rx="6" />
      <path d="M10 52h18" />
      <circle cx="18" cy="52" r="4" />
    </>
  ),
  robotvac: () => (
    <>
      <circle cx="32" cy="34" r="18" />
      <circle cx="32" cy="34" r="5" />
      <path d="M20 22l4 4" />
    </>
  ),
  bidet: () => (
    <>
      <path d="M18 18h28v10a12 12 0 0 1-12 12h-4a12 12 0 0 1-12-12z" />
      <path d="M22 40v12h20V40" />
      <path d="M18 14h28" />
    </>
  ),
  sewing: () => (
    <>
      <path d="M10 44h44" />
      <path d="M14 44V26h22l8-10h8v14" />
      <path d="M44 30v10" />
    </>
  ),

  // ── 주방가전 ───────────────────────────────────────────
  microwave: () => (
    <>
      <rect x="8" y="18" width="48" height="28" rx="5" />
      <rect x="14" y="24" width="26" height="16" rx="3" />
      <path d="M46 26v2M46 34v2" />
    </>
  ),
  oven: () => (
    <>
      <rect x="10" y="12" width="44" height="42" rx="5" />
      <path d="M10 24h44" />
      <rect x="17" y="30" width="30" height="16" rx="3" />
      <path d="M18 18h8" />
    </>
  ),
  airfryer: () => (
    <>
      <path d="M18 16h28l-3 34a6 6 0 0 1-6 6H27a6 6 0 0 1-6-6z" />
      <path d="M24 30h16" />
      <path d="M22 10h20" />
    </>
  ),
  gasrange: () => (
    <>
      <rect x="8" y="20" width="48" height="26" rx="5" />
      <circle cx="22" cy="30" r="5" />
      <circle cx="42" cy="30" r="5" />
      <path d="M16 40h32" />
    </>
  ),
  induction: () => (
    <>
      <rect x="8" y="22" width="48" height="20" rx="5" />
      <circle cx="24" cy="32" r="6" />
      <circle cx="42" cy="32" r="4" />
    </>
  ),
  dishwasher: () => (
    <>
      <rect x="12" y="8" width="40" height="48" rx="5" />
      <path d="M12 20h40" />
      <circle cx="32" cy="38" r="8" />
      <path d="M20 14h10" />
    </>
  ),
  purifierWater: () => (
    <>
      <rect x="18" y="8" width="28" height="48" rx="6" />
      <path d="M28 24h10v6a5 5 0 0 1-10 0z" />
      <path d="M33 30v8" />
      <path d="M26 46h12" />
    </>
  ),
  ricecooker: () => (
    <>
      <path d="M12 30h40v14a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8z" />
      <path d="M14 30a18 18 0 0 1 36 0" />
      <path d="M32 12v6" />
    </>
  ),
  coffee: () => (
    <>
      <path d="M14 12h30v14a15 15 0 0 1-30 0z" />
      <path d="M44 16h6a5 5 0 0 1 0 10h-6" />
      <path d="M12 52h34" />
    </>
  ),
  blender: () => (
    <>
      <path d="M22 8h20l-3 26H25z" />
      <path d="M22 34h20v10a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8z" />
      <path d="M27 20h10" />
    </>
  ),
  toaster: () => (
    <>
      <rect x="10" y="24" width="44" height="24" rx="8" />
      <path d="M22 24v-4M32 24v-6M42 24v-4" />
      <circle cx="46" cy="36" r="2" />
    </>
  ),
  kettle: () => (
    <>
      <path d="M18 22h24v22a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8z" />
      <path d="M42 28h6l-4 10" />
      <path d="M24 22v-6h12v6" />
    </>
  ),

  // ── 주방 수납 ──────────────────────────────────────────
  dishrack: () => (
    <>
      <path d="M10 44h44" />
      <path d="M14 44V28M24 44V28M34 44V28M44 44V28" />
      <path d="M10 28h44" />
      <path d="M16 52h32" />
    </>
  ),
  cabinet: () => (
    <>
      <rect x="12" y="8" width="40" height="48" rx="4" />
      <path d="M32 8v48" />
      <path d="M26 28h-2M40 28h2" />
    </>
  ),
  potset: () => (
    <>
      <path d="M14 26h30v18a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8z" />
      <path d="M44 30h8" />
      <path d="M20 26v-4h18v4" />
    </>
  ),
  ricebin: () => (
    <>
      <path d="M16 18h32v30a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6z" />
      <path d="M14 18h36" />
      <path d="M26 32h12" />
    </>
  ),
  pot: () => (
    <>
      <path d="M18 24c0-4 6-6 14-6s14 2 14 6v18c0 6-6 10-14 10s-14-4-14-10z" />
      <path d="M24 14h16" />
    </>
  ),

  // ── 침대·침구 ──────────────────────────────────────────
  bed: () => (
    <>
      <path d="M8 50V22" />
      <path d="M56 50V36" />
      <path d="M8 36h48v10H8z" />
      <rect x="15" y="27" width="16" height="9" rx="4" />
    </>
  ),
  bedBig: () => (
    <>
      <path d="M6 52V20" />
      <path d="M58 52V34" />
      <path d="M6 34h52v12H6z" />
      <rect x="12" y="24" width="16" height="10" rx="4" />
      <rect x="34" y="24" width="16" height="10" rx="4" />
    </>
  ),
  bunkbed: () => (
    <>
      <path d="M10 8v48M54 8v48" />
      <path d="M10 26h44M10 44h44" />
      <path d="M10 20h16M10 38h16" />
    </>
  ),
  babybed: () => (
    <>
      <path d="M12 20v28M52 20v28" />
      <path d="M22 22v22M32 22v22M42 22v22" />
      <path d="M12 44h40" />
      <path d="M12 20h40" />
    </>
  ),
  mattress: () => (
    <>
      <rect x="8" y="24" width="48" height="20" rx="8" />
      <path d="M20 30v8M32 30v8M44 30v8" />
    </>
  ),

  // ── 옷·수납 가구 ───────────────────────────────────────
  wardrobe: () => (
    <>
      <rect x="14" y="6" width="36" height="50" rx="4" />
      <path d="M32 6v50" />
      <path d="M27 28h-2M39 28h2" />
    </>
  ),
  builtin: () => (
    <>
      <rect x="8" y="6" width="48" height="50" rx="4" />
      <path d="M24 6v50M40 6v50" />
      <path d="M20 28h-2M36 28h-2M52 28h-2" />
    </>
  ),
  hanger: () => (
    <>
      <path d="M12 18h40" />
      <path d="M16 18v34M48 18v34" />
      <path d="M24 18v10M32 18v10M40 18v10" />
      <path d="M10 54h44" />
    </>
  ),
  vanity: () => (
    <>
      <rect x="20" y="6" width="24" height="20" rx="10" />
      <path d="M12 32h40v8H12z" />
      <path d="M16 40v14M48 40v14" />
    </>
  ),
  drawer: () => (
    <>
      <rect x="12" y="10" width="40" height="44" rx="4" />
      <path d="M12 25h40M12 40h40" />
      <path d="M28 17h8M28 32h8M28 47h8" />
    </>
  ),
  nightstand: () => (
    <>
      <rect x="16" y="18" width="32" height="28" rx="4" />
      <path d="M16 32h32" />
      <path d="M29 25h6M29 39h6" />
      <path d="M20 46v8M44 46v8" />
    </>
  ),

  // ── 거실 가구 ──────────────────────────────────────────
  sofa: () => (
    <>
      <path d="M12 40V28a6 6 0 0 1 12 0v6h16v-6a6 6 0 0 1 12 0v12" />
      <rect x="8" y="34" width="48" height="16" rx="6" />
      <path d="M16 50v5M48 50v5" />
    </>
  ),
  sofaBig: () => (
    <>
      <path d="M8 40V26a6 6 0 0 1 12 0v8h24v-8a6 6 0 0 1 12 0v14" />
      <rect x="4" y="34" width="56" height="16" rx="6" />
      <path d="M24 34v-2M40 34v-2" />
      <path d="M12 50v5M52 50v5" />
    </>
  ),
  recliner: () => (
    <>
      <path d="M16 42V24a6 6 0 0 1 12 0v10" />
      <path d="M16 34h24l12 8" />
      <rect x="12" y="34" width="32" height="14" rx="6" />
      <path d="M18 48v6M40 48v6" />
    </>
  ),
  floorsofa: () => (
    <>
      <path d="M14 44V30a5 5 0 0 1 10 0v8h20v-8a5 5 0 0 1 10 0v14" />
      <rect x="10" y="38" width="44" height="12" rx="5" />
    </>
  ),
  tvstand: () => (
    <>
      <rect x="8" y="26" width="48" height="20" rx="4" />
      <path d="M32 26v20" />
      <path d="M24 36h-2M42 36h-2" />
      <path d="M14 46v6M50 46v6" />
    </>
  ),
  teatable: () => (
    <>
      <rect x="10" y="26" width="44" height="8" rx="4" />
      <path d="M18 34v18M46 34v18" />
      <path d="M18 44h28" />
    </>
  ),
  displaycase: () => (
    <>
      <rect x="16" y="6" width="32" height="50" rx="4" />
      <path d="M16 22h32M16 38h32" />
      <path d="M24 14h6M24 30h6M24 46h6" />
    </>
  ),
  shoerack: () => (
    <>
      <rect x="14" y="10" width="36" height="44" rx="4" />
      <path d="M14 24h36M14 38h36" />
      <path d="M20 17h10M20 31h10M20 45h10" />
    </>
  ),

  // ── 식탁·책상 ──────────────────────────────────────────
  table: () => (
    <>
      <path d="M6 26h52" />
      <path d="M14 26v26M50 26v26" />
      <path d="M14 40h36" />
    </>
  ),
  island: () => (
    <>
      <path d="M6 24h52" />
      <rect x="12" y="24" width="40" height="28" rx="4" />
      <path d="M32 24v28" />
      <path d="M26 36h-2M40 36h-2" />
    </>
  ),
  chair: () => (
    <>
      <path d="M20 8v28M44 8v28" />
      <path d="M20 16h24M20 26h24" />
      <path d="M14 36h36" />
      <path d="M20 36v18M44 36v18" />
    </>
  ),
  desk: () => (
    <>
      <path d="M6 24h52" />
      <path d="M12 24v28" />
      <rect x="34" y="24" width="18" height="18" rx="3" />
      <path d="M52 42v10" />
      <path d="M40 33h6" />
    </>
  ),
  officechair: () => (
    <>
      <rect x="20" y="8" width="24" height="20" rx="6" />
      <path d="M16 32h32" />
      <path d="M32 32v12" />
      <path d="M18 54l14-10 14 10" />
    </>
  ),
  shelf: () => (
    <>
      <rect x="12" y="8" width="40" height="48" rx="4" />
      <path d="M12 24h40M12 40h40" />
      <path d="M19 14v10M25 14v10M40 30v10M46 30v10" />
    </>
  ),
  wallshelf: () => (
    <>
      <path d="M8 22h48M8 40h48" />
      <path d="M14 22v18M50 22v18" />
      <path d="M22 14v8M30 12v10" />
    </>
  ),
  partition: () => (
    <>
      <path d="M12 12v40M32 12v40M52 12v40" />
      <path d="M12 12h40" />
      <path d="M8 52h48" />
    </>
  ),
  foldtable: () => (
    <>
      <path d="M8 26h48" />
      <path d="M16 26l10 26M48 26L38 52" />
      <path d="M22 40h20" />
    </>
  ),

  // ── 생활용품 ───────────────────────────────────────────
  drying: () => (
    <>
      <path d="M14 52L22 20M50 52L42 20" />
      <path d="M18 30h28M16 40h32" />
      <path d="M22 20h20" />
    </>
  ),
  toolbox: () => (
    <>
      <rect x="10" y="24" width="44" height="26" rx="4" />
      <path d="M24 24v-4a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4" />
      <path d="M10 34h44" />
    </>
  ),
  cleaning: () => (
    <>
      <path d="M22 8v26" />
      <path d="M14 34h16l-2 20H16z" />
      <path d="M40 20h10v34H40z" />
      <path d="M40 30h10" />
    </>
  ),
  ladder2: () => (
    <>
      <path d="M20 8L14 56M44 8l6 48" />
      <path d="M18 20h28M17 32h30M15 44h34" />
    </>
  ),
  standlight: () => (
    <>
      <path d="M20 20l12-12 12 12z" />
      <path d="M32 20v30" />
      <path d="M22 54h20" />
    </>
  ),
  mirror: () => (
    <>
      <rect x="18" y="6" width="28" height="44" rx="14" />
      <path d="M24 18v14" />
      <path d="M22 54h20" />
    </>
  ),
  frame: () => (
    <>
      <rect x="10" y="12" width="44" height="40" rx="4" />
      <path d="M16 42l10-12 8 8 6-6 8 10" />
      <circle cx="42" cy="22" r="3" />
    </>
  ),
  curtain: () => (
    <>
      <path d="M8 12h48" />
      <path d="M16 12c6 12 6 28 0 40M28 12c-6 12-6 28 0 40" />
      <path d="M36 12c6 12 6 28 0 40M48 12c-6 12-6 28 0 40" />
    </>
  ),
  carpet: () => (
    <>
      <rect x="8" y="18" width="48" height="28" rx="6" />
      <path d="M8 26h48M8 38h48" />
      <path d="M14 18v28M50 18v28" opacity="0.4" />
    </>
  ),
  blanket: () => (
    <>
      <path d="M10 22c8-6 36-6 44 0v22c-8 6-36 6-44 0z" />
      <path d="M10 32c8 6 36 6 44 0" />
    </>
  ),
  storagebin: () => (
    <>
      <path d="M14 22h36l-3 30a5 5 0 0 1-5 4H22a5 5 0 0 1-5-4z" />
      <path d="M10 22h44" />
      <path d="M26 14h12" />
    </>
  ),
  luggage: () => (
    <>
      <rect x="14" y="18" width="36" height="32" rx="5" />
      <path d="M26 18v-6h12v6" />
      <path d="M32 22v24" />
      <circle cx="22" cy="54" r="3" />
      <circle cx="42" cy="54" r="3" />
    </>
  ),
  plant: () => (
    <>
      <path d="M20 34h24l-3 20H23z" />
      <path d="M32 34c0-10 6-16 14-16 0 10-6 16-14 16z" />
      <path d="M32 34c0-8-5-13-12-13 0 8 5 13 12 13z" />
    </>
  ),

  // ── 취미·운동 ──────────────────────────────────────────
  bicycle: () => (
    <>
      <circle cx="16" cy="42" r="11" />
      <circle cx="48" cy="42" r="11" />
      <path d="M16 42l10-18h10l8 18" />
      <path d="M26 24h12" />
    </>
  ),
  kickboard: () => (
    <>
      <circle cx="14" cy="48" r="6" />
      <circle cx="50" cy="48" r="6" />
      <path d="M20 48h24" />
      <path d="M44 48L46 16h8" />
    </>
  ),
  golf: () => (
    <>
      <path d="M22 24h20l-2 26a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z" />
      <path d="M26 24l2-14M32 24V8M38 24l-2-14" />
      <path d="M20 34h24" />
    </>
  ),
  camping: () => (
    <>
      <path d="M8 50h48" />
      <path d="M32 12L10 50h44z" />
      <path d="M32 26l-8 24h16z" />
    </>
  ),
  ski: () => (
    <>
      <path d="M16 10l6 40M40 8l8 42" />
      <path d="M12 52c8 4 32 4 40 0" />
      <path d="M22 26h20" />
    </>
  ),
  fitness: () => (
    <>
      <path d="M8 26v12M14 22v20M50 22v20M56 26v12" />
      <path d="M14 32h36" />
    </>
  ),
  treadmill: () => (
    <>
      <path d="M8 50h40a8 8 0 0 0 0-16H16a8 8 0 0 0 0 16z" />
      <path d="M44 34L52 12" />
      <path d="M46 12h12" />
    </>
  ),
  bike2: () => (
    <>
      <circle cx="20" cy="42" r="10" />
      <path d="M20 42l10-16h10" />
      <path d="M44 16v22" />
      <path d="M36 16h14" />
      <path d="M38 50h16" />
    </>
  ),

  // ── 아이·반려동물 ──────────────────────────────────────
  stroller: () => (
    <>
      <path d="M14 30h26a4 4 0 0 1 0 8H22" />
      <path d="M14 14a20 20 0 0 1 20 16" />
      <path d="M22 38l-4 12" />
      <circle cx="16" cy="52" r="4" />
      <circle cx="44" cy="52" r="4" />
      <path d="M40 38l4 12" />
    </>
  ),
  babyitems: () => (
    <>
      <path d="M24 20h16v12a8 8 0 0 1-16 0z" />
      <path d="M28 32v14a4 4 0 0 0 8 0V32" />
      <path d="M26 12c2 4 10 4 12 0" />
    </>
  ),
  petcage: () => (
    <>
      <rect x="12" y="16" width="40" height="36" rx="5" />
      <path d="M22 16v36M32 16v36M42 16v36" />
      <path d="M24 10h16" />
    </>
  ),
  cattower: () => (
    <>
      <path d="M28 20v34M36 26v28" />
      <rect x="14" y="10" width="24" height="10" rx="3" />
      <rect x="26" y="26" width="24" height="8" rx="3" />
      <path d="M16 54h32" />
    </>
  ),

  // ── 특수·중량 ──────────────────────────────────────────
  piano: () => (
    <>
      <rect x="8" y="14" width="48" height="26" rx="4" />
      <path d="M8 30h48" />
      <path d="M18 30v10M26 30v10M34 30v10M42 30v10" />
      <path d="M14 40v10M50 40v10" />
    </>
  ),
  safe: () => (
    <>
      <rect x="10" y="10" width="44" height="44" rx="5" />
      <circle cx="30" cy="32" r="9" />
      <path d="M30 23v6M39 32h6" />
    </>
  ),
  aquarium: () => (
    <>
      <rect x="8" y="16" width="48" height="34" rx="4" />
      <path d="M8 26c8 4 40 4 48 0" />
      <path d="M22 38c4-4 10-4 14 0-4 4-10 4-14 0z" />
      <path d="M36 38l6-4v8z" />
    </>
  ),
  massagechair: () => (
    <>
      <path d="M16 44V18a8 8 0 0 1 16 0v14" />
      <path d="M16 32h22l14 6" />
      <rect x="12" y="32" width="30" height="14" rx="6" />
      <path d="M18 46v8M38 46v8" />
    </>
  ),
  art: () => (
    <>
      <path d="M32 8c12 0 22 9 22 20 0 8-7 10-12 10-4 0-6 2-6 5s2 5 2 8c0 3-3 5-6 5-12 0-22-11-22-24S20 8 32 8z" />
      <circle cx="22" cy="26" r="3" />
      <circle cx="34" cy="20" r="3" />
      <circle cx="44" cy="28" r="3" />
    </>
  ),
  waste: () => (
    <>
      <path d="M14 20h36l-3 32a5 5 0 0 1-5 4H22a5 5 0 0 1-5-4z" />
      <path d="M10 20h44" />
      <path d="M25 14h14" />
      <path d="M27 30v16M37 30v16" />
    </>
  ),

  // ── 박스·포장 ──────────────────────────────────────────
  box: () => (
    <>
      <path d="M10 20h44v30a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5z" />
      <path d="M10 20l6-10h32l6 10" />
      <path d="M32 10v45" />
    </>
  ),
  boxBig: () => (
    <>
      <path d="M8 18h48v32a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5z" />
      <path d="M8 18l7-10h34l7 10" />
      <path d="M32 8v47" />
      <path d="M20 32h8" />
    </>
  ),
  boxSmall: () => (
    <>
      <path d="M16 24h32v26a5 5 0 0 1-5 5H21a5 5 0 0 1-5-5z" />
      <path d="M16 24l5-8h22l5 8" />
      <path d="M32 16v39" />
    </>
  ),
  clothbox: () => (
    <>
      <path d="M12 24h40v26a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5z" />
      <path d="M12 24h40" />
      <path d="M26 24v-6l6 4 6-4v6" />
    </>
  ),
  bookbox: () => (
    <>
      <path d="M12 24h40v26a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5z" />
      <path d="M12 24h40" />
      <path d="M24 24V12h16v12" />
      <path d="M30 12v12M36 12v12" />
    </>
  ),
  kitchenbox: () => (
    <>
      <path d="M12 26h40v24a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5z" />
      <path d="M12 26h40" />
      <path d="M26 26V12M32 12v14M38 26c0-6-2-8-2-14" />
    </>
  ),
  basket: () => (
    <>
      <path d="M10 24h44l-5 26a5 5 0 0 1-5 4H20a5 5 0 0 1-5-4z" />
      <path d="M20 24c0-8 5-12 12-12s12 4 12 12" />
      <path d="M24 34l2 14M40 34l-2 14" />
    </>
  ),
  bag: () => (
    <>
      <path d="M14 22h36l-4 30a5 5 0 0 1-5 4H23a5 5 0 0 1-5-4z" />
      <path d="M24 22v-4a8 8 0 0 1 16 0v4" />
    </>
  ),
  blanketbag: () => (
    <>
      <rect x="10" y="20" width="44" height="30" rx="8" />
      <path d="M10 30h44" />
      <path d="M26 20v-4h12v4" />
      <path d="M24 40h16" />
    </>
  ),
  vinyl: () => (
    <>
      <path d="M16 18h32v32a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6z" />
      <path d="M22 12h20l6 6H16z" />
      <path d="M26 30c4 4 8 0 12 4" opacity="0.5" />
    </>
  ),

  // ── 옵션·작업 ──────────────────────────────────────────
  acWork: () => (
    <>
      <rect x="8" y="14" width="40" height="14" rx="5" />
      <path d="M14 24h28" />
      <path d="M18 34c0 4 4 4 4 8M30 34c0 4 4 4 4 8" />
      <circle cx="48" cy="42" r="8" />
      <path d="M48 38v8M44 42h8" />
    </>
  ),
  washerWork: () => (
    <>
      <rect x="10" y="10" width="32" height="42" rx="5" />
      <circle cx="26" cy="34" r="9" />
      <path d="M16 18h6" />
      <circle cx="50" cy="44" r="8" />
      <path d="M50 40v8M46 44h8" />
    </>
  ),
  cleaningWork: () => (
    <>
      <path d="M26 8L14 34" />
      <path d="M8 34h20l-3 20H11z" />
      <path d="M44 12l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" />
    </>
  ),
  disposal: () => (
    <>
      <path d="M14 20h36l-3 32a5 5 0 0 1-5 4H22a5 5 0 0 1-5-4z" />
      <path d="M10 20h44" />
      <path d="M25 14h14" />
      <path d="M26 30l12 14M38 30L26 44" />
    </>
  ),
  assembly: () => (
    <>
      <path d="M12 44l16-16" />
      <path d="M8 48l4 4 8-8-4-4z" />
      <path d="M40 10l10 10-6 6a8 8 0 0 1-10-10z" />
      <path d="M34 26L18 42" />
    </>
  ),
  packing: () => (
    <>
      <path d="M10 22h44v28a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5z" />
      <path d="M10 22l6-10h32l6 10" />
      <path d="M10 34h44" />
      <path d="M32 12v10" />
    </>
  ),
  parking: () => (
    <>
      <rect x="10" y="8" width="44" height="44" rx="8" />
      <path d="M25 42V20h9a7 7 0 0 1 0 14h-9" />
    </>
  ),

  /** 어디에도 안 걸릴 때 쓰는 기본 아이콘 (짐 보따리) */
  generic: () => (
    <>
      <path d="M12 24h40l-4 28a5 5 0 0 1-5 4H21a5 5 0 0 1-5-4z" />
      <path d="M22 24c0-8 4-12 10-12s10 4 10 12" />
    </>
  ),
};

// ============================================================
// 품목 ↔ 아이콘 연결
// ============================================================
export const ITEM_LINE: Record<string, string> = {
  // 가전 — 냉장·세탁
  fridge: "fridge",
  kimchi: "fridgeWide",
  minifridge: "fridge",
  freezer: "fridge",
  winecellar: "displaycase",
  washer: "washer",
  drumwasher: "washer",
  dryer: "dryer",
  styler: "styler",
  // 가전 — 영상·음향
  tv: "tv",
  bigtv: "tv",
  walltv: "tvWall",
  projector: "projector",
  speaker: "speaker",
  console: "console",
  // 가전 — 공조
  aircon: "aircon",
  wallaircon: "airconWall",
  airpurifier: "purifier",
  dehumid: "purifier",
  humid: "humid",
  fan: "fan",
  heater: "heater",
  electricmat: "mat",
  // 가전 — 사무·생활
  pc: "pc",
  printer: "printer",
  vacuum: "vacuum",
  robotvac: "robotvac",
  bidet: "bidet",
  sewing: "sewing",
  // 주방
  microwave: "microwave",
  oven: "oven",
  airfryer: "airfryer",
  gasrange: "gasrange",
  induction: "induction",
  dishwasher: "dishwasher",
  waterpurifier: "purifierWater",
  riceCooker: "ricecooker",
  coffee: "coffee",
  blender: "blender",
  toaster: "toaster",
  kettle: "kettle",
  dishrack: "dishrack",
  dishcabinet: "cabinet",
  kitchencabinet: "cabinet",
  potset: "potset",
  ricebin: "ricebin",
  kimchipot: "pot",
  // 가구 — 침대
  bed: "bed",
  bedq: "bedBig",
  bunkbed: "bunkbed",
  babybed: "babybed",
  mattress: "mattress",
  // 가구 — 옷·수납
  wardrobe: "wardrobe",
  builtin: "builtin",
  hanger: "hanger",
  vanity: "vanity",
  drawer: "drawer",
  nightstand: "nightstand",
  // 가구 — 거실
  sofa: "sofa",
  sofabig: "sofaBig",
  recliner: "recliner",
  floorsofa: "floorsofa",
  tvstand: "tvstand",
  teatable: "teatable",
  displaycase: "displaycase",
  shoerack: "shoerack",
  // 가구 — 식탁·책상
  table: "table",
  table6: "table",
  marbletable: "table",
  island: "island",
  chair: "chair",
  desk: "desk",
  officedesk: "desk",
  officechair: "officechair",
  shelf: "shelf",
  wallshelf: "wallshelf",
  partition: "partition",
  foldtable: "foldtable",
  // 생활용품
  drying: "drying",
  toolbox: "toolbox",
  cleaning: "cleaning",
  ladder2: "ladder2",
  standlight: "standlight",
  mirror: "mirror",
  frame: "frame",
  curtain: "curtain",
  carpet: "carpet",
  blanket: "blanket",
  storagebin: "storagebin",
  luggage: "luggage",
  plant: "plant",
  bigplant: "plant",
  bicycle: "bicycle",
  kickboard: "kickboard",
  golf: "golf",
  camping: "camping",
  ski: "ski",
  fitness: "fitness",
  stroller: "stroller",
  babyitems: "babyitems",
  petcage: "petcage",
  cattower: "cattower",
  // 특수
  piano: "piano",
  grandpiano: "piano",
  digitalpiano: "piano",
  safe: "safe",
  aquarium: "aquarium",
  massagechair: "massagechair",
  treadmill: "treadmill",
  bike2: "bike2",
  art: "art",
  waste: "waste",
  // 잔짐·박스
  box: "box",
  clothbox: "clothbox",
  bigbox: "boxBig",
  midbox: "box",
  bookbox: "bookbox",
  kitchenbox: "kitchenbox",
  smallbox: "boxSmall",
  basket: "basket",
  bag: "bag",
  blanketbag: "blanketbag",
  vinyl: "vinyl",
};

/** 이름에 이 말이 들어가면 이 아이콘 (긴 말부터 확인합니다) */
const NAME_LINE: { words: string[]; key: string }[] = [
  { words: ["김치냉장고"], key: "fridgeWide" },
  { words: ["냉장고", "냉동고"], key: "fridge" },
  { words: ["세탁기"], key: "washer" },
  { words: ["건조기"], key: "dryer" },
  { words: ["스타일러"], key: "styler" },
  { words: ["벽걸이"], key: "tvWall" },
  { words: ["tv", "티비", "텔레비"], key: "tv" },
  { words: ["프로젝터", "빔"], key: "projector" },
  { words: ["스피커", "오디오"], key: "speaker" },
  { words: ["에어컨"], key: "aircon" },
  { words: ["공기청정", "제습"], key: "purifier" },
  { words: ["가습"], key: "humid" },
  { words: ["선풍기"], key: "fan" },
  { words: ["히터", "온풍"], key: "heater" },
  { words: ["전기장판", "온수매트"], key: "mat" },
  { words: ["컴퓨터", "모니터", "노트북", "피시"], key: "pc" },
  { words: ["프린터", "복합기"], key: "printer" },
  { words: ["로봇청소"], key: "robotvac" },
  { words: ["청소기"], key: "vacuum" },
  { words: ["비데"], key: "bidet" },
  { words: ["재봉"], key: "sewing" },
  { words: ["전자레인지", "렌지", "레인지"], key: "microwave" },
  { words: ["오븐"], key: "oven" },
  { words: ["에어프라이"], key: "airfryer" },
  { words: ["인덕션", "하이라이트"], key: "induction" },
  { words: ["식기세척"], key: "dishwasher" },
  { words: ["정수기"], key: "purifierWater" },
  { words: ["밥솥"], key: "ricecooker" },
  { words: ["커피", "에스프레소"], key: "coffee" },
  { words: ["믹서", "블렌더"], key: "blender" },
  { words: ["토스터"], key: "toaster" },
  { words: ["포트", "주전자"], key: "kettle" },
  { words: ["건조대"], key: "drying" },
  { words: ["그릇장", "수납장", "찬장"], key: "cabinet" },
  { words: ["냄비", "주방용품"], key: "potset" },
  { words: ["쌀통"], key: "ricebin" },
  { words: ["김치통", "장독", "항아리"], key: "pot" },
  { words: ["2층침대", "이층침대"], key: "bunkbed" },
  { words: ["아기침대", "유아침대"], key: "babybed" },
  { words: ["매트리스"], key: "mattress" },
  { words: ["침대"], key: "bed" },
  { words: ["붙박이"], key: "builtin" },
  { words: ["장롱", "옷장"], key: "wardrobe" },
  { words: ["행거"], key: "hanger" },
  { words: ["화장대"], key: "vanity" },
  { words: ["서랍"], key: "drawer" },
  { words: ["협탁"], key: "nightstand" },
  { words: ["리클라이너"], key: "recliner" },
  { words: ["좌식소파"], key: "floorsofa" },
  { words: ["소파"], key: "sofa" },
  { words: ["티테이블", "티 테이블"], key: "teatable" },
  { words: ["tv장", "거실장"], key: "tvstand" },
  { words: ["장식장", "진열장", "와인"], key: "displaycase" },
  { words: ["신발장"], key: "shoerack" },
  { words: ["아일랜드"], key: "island" },
  { words: ["식탁"], key: "table" },
  { words: ["사무용", "회전의자"], key: "officechair" },
  { words: ["의자"], key: "chair" },
  { words: ["책상"], key: "desk" },
  { words: ["책장"], key: "shelf" },
  { words: ["선반"], key: "wallshelf" },
  { words: ["파티션"], key: "partition" },
  { words: ["접이식"], key: "foldtable" },
  { words: ["공구"], key: "toolbox" },
  { words: ["청소도구", "빗자루", "밀대"], key: "cleaning" },
  { words: ["사다리"], key: "ladder2" },
  { words: ["스탠드", "조명", "전등"], key: "standlight" },
  { words: ["거울"], key: "mirror" },
  { words: ["액자", "그림"], key: "frame" },
  { words: ["커튼", "블라인드"], key: "curtain" },
  { words: ["카펫", "러그", "매트"], key: "carpet" },
  { words: ["이불"], key: "blanket" },
  { words: ["정리함", "수납함"], key: "storagebin" },
  { words: ["캐리어", "여행가방"], key: "luggage" },
  { words: ["화분", "식물"], key: "plant" },
  { words: ["자전거"], key: "bicycle" },
  { words: ["킥보드"], key: "kickboard" },
  { words: ["골프"], key: "golf" },
  { words: ["캠핑", "텐트"], key: "camping" },
  { words: ["스키", "보드"], key: "ski" },
  { words: ["운동기구", "아령", "덤벨", "역기"], key: "fitness" },
  { words: ["러닝머신", "트레드밀"], key: "treadmill" },
  { words: ["실내자전거"], key: "bike2" },
  { words: ["유모차"], key: "stroller" },
  { words: ["아기", "유아"], key: "babyitems" },
  { words: ["케이지", "펫", "강아지", "고양이"], key: "petcage" },
  { words: ["캣타워"], key: "cattower" },
  { words: ["피아노"], key: "piano" },
  { words: ["금고"], key: "safe" },
  { words: ["어항", "수족관"], key: "aquarium" },
  { words: ["안마의자"], key: "massagechair" },
  { words: ["미술품", "조각", "도자기"], key: "art" },
  { words: ["폐기", "쓰레기"], key: "waste" },
  { words: ["옷박스"], key: "clothbox" },
  { words: ["도서", "책박스"], key: "bookbox" },
  { words: ["주방박스"], key: "kitchenbox" },
  { words: ["대박스"], key: "boxBig" },
  { words: ["소박스", "잡화박스"], key: "boxSmall" },
  { words: ["박스", "상자"], key: "box" },
  { words: ["바구니"], key: "basket" },
  { words: ["가방"], key: "bag" },
  { words: ["이불백"], key: "blanketbag" },
  { words: ["비닐"], key: "vinyl" },
];

/** 옵션·작업 이름이면 그에 맞는 아이콘 (품목보다 먼저 확인합니다) */
const WORK_LINE: { words: string[]; key: string }[] = [
  {
    words: ["에어컨설치", "에어컨이전", "에어컨철거", "에어컨탈부착", "에어컨이설"],
    key: "acWork",
  },
  { words: ["세탁기설치", "세탁기연결"], key: "washerWork" },
  { words: ["청소", "새집"], key: "cleaningWork" },
  { words: ["폐기", "버릴", "쓰레기", "수거"], key: "disposal" },
  { words: ["분해", "조립", "설치", "철거", "탈부착"], key: "assembly" },
  { words: ["포장자재", "자재비", "박스비", "완충", "뽁뽁이", "테이프"], key: "packing" },
  { words: ["주차", "도로사용", "사용료", "통행"], key: "parking" },
];

const squash = (s: string) => (s || "").toLowerCase().replace(/\s/g, "");

/** 옵션·작업 이름으로 아이콘 찾기 */
export function guessWorkLineKey(name: string): string | undefined {
  const n = squash(name);
  if (!n) return undefined;
  for (const { words, key } of WORK_LINE) if (words.some((w) => n.includes(w))) return key;
  return undefined;
}

/** 품목 이름으로 아이콘 찾기 */
export function guessLineKey(name: string): string | undefined {
  const n = squash(name);
  if (!n) return undefined;
  for (const { words, key } of NAME_LINE) if (words.some((w) => n.includes(w))) return key;
  return undefined;
}

/** 아이콘이 있는지 확인 */
export function hasLineIcon(key: string): boolean {
  return !!ICONS[key];
}

/** 라인 아이콘 한 개 그리기 */
export function LineArt({
  name: key,
  alt,
  size = 64,
  className = "",
  withFloor = false,
}: {
  /** ICONS 의 키 */
  name: string;
  alt: string;
  size?: number;
  className?: string;
  /** 바닥선을 함께 그릴지 */
  withFloor?: boolean;
}) {
  const Draw = ICONS[key] ?? ICONS.generic;
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center text-[#0751D8] ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        role="img"
        aria-label={alt}
        fill="none"
        stroke="currentColor"
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-full w-full"
      >
        <Draw />
        {withFloor && <Floor />}
      </svg>
    </span>
  );
}

/** 만들어 둔 아이콘 이름 목록 (개발 확인용) */
export const LINE_KEYS = Object.keys(ICONS);
