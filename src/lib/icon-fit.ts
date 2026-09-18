/**
 * 품목 3D 그림을 「같은 크기」로 보이게 맞추는 도우미.
 *
 * 그림 파일마다 물체 주변 투명 여백이 달라, 같은 칸에 넣어도
 * 어떤 물건은 크고 어떤 물건은 아주 작게 보였습니다.
 * 그래서 그림이 처음 보일 때 실제 물체가 차지하는 범위를 한 번 재고,
 * 물체가 칸의 약 80%를 채우도록 확대 비율을 계산해 둡니다.
 * (비율은 그대로 유지하므로 찌그러지지 않습니다)
 *
 * 한 번 잰 값은 브라우저에 저장해 다음부터는 바로 씁니다.
 */
import { useEffect, useState } from "react";

/** 물체가 칸에서 차지하길 바라는 비율 */
const TARGET = 0.85;
/** 확대 한도 — 너무 키우면 흐릿해집니다 */
const MAX_SCALE = 2.4;
const CACHE_KEY = "jp_icon_fit_v1";

const memory = new Map<string, number>();
let loaded = false;

function loadCache() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, number>;
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "number" && v > 0) memory.set(k, v);
      }
    }
  } catch {
    /* 저장 값이 깨져 있어도 다시 재면 됩니다 */
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveCache() {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(memory)));
    } catch {
      /* 저장 공간이 없으면 화면만 잠깐 기준 크기로 보입니다 */
    }
  }, 400);
}

/** 그림에서 실제 물체가 차지하는 범위를 재서 확대 비율을 구합니다 */
async function measure(src: string): Promise<number> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = src;
  await img.decode();
  const side = 96;
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 1;
  // 원본 비율 그대로 정사각형 안에 그려 넣습니다
  const ratio = Math.min(side / img.naturalWidth, side / img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * ratio));
  const h = Math.max(1, Math.round(img.naturalHeight * ratio));
  ctx.drawImage(img, (side - w) / 2, (side - h) / 2, w, h);
  const data = ctx.getImageData(0, 0, side, side).data;
  let minX = side;
  let minY = side;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const i = (y * side + x) * 4;
      const a = data[i + 3];
      // 투명하거나 거의 흰 배경은 물체가 아닌 것으로 봅니다
      const nearWhite = a > 16 && data[i] > 246 && data[i + 1] > 246 && data[i + 2] > 246;
      if (a <= 16 || nearWhite) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return 1;
  const fill = Math.max((maxX - minX + 1) / side, (maxY - minY + 1) / side);
  if (!Number.isFinite(fill) || fill <= 0) return 1;
  return Math.min(MAX_SCALE, Math.max(1, TARGET / fill));
}

/**
 * 그림 한 장의 확대 비율 — 처음에는 1(원래 크기)로 보여 주고,
 * 재는 것이 끝나면 물체가 칸을 고르게 채우도록 값을 바꿉니다.
 */
export function useIconFit(src: string): number {
  loadCache();
  const [scale, setScale] = useState(() => memory.get(src) ?? 1);

  useEffect(() => {
    const cached = memory.get(src);
    if (cached != null) {
      setScale(cached);
      return;
    }
    let alive = true;
    measure(src)
      .then((v) => {
        memory.set(src, v);
        saveCache();
        if (alive) setScale(v);
      })
      .catch(() => {
        // 다른 서버 그림이라 못 읽는 경우 — 기준 크기로 보여 줍니다
        memory.set(src, 1);
        if (alive) setScale(1);
      });
    return () => {
      alive = false;
    };
  }, [src]);

  return scale;
}
