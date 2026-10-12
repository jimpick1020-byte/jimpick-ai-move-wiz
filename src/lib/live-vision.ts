// 모든 방 촬영 화면이 함께 쓰는 휴대폰 내 실시간 인식 모듈(크레딧 없음).
// 모델은 앱이 켜져 있는 동안 한 번만 불러와 재사용합니다.
const MP_VERSION = "1.1.0"; // 설치된 @mediapipe/tasks-vision 버전과 WASM 버전을 맞춤
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
export const DET_MODEL = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";
export const SEG_MODEL = "https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite";

export type Pt = { x: number; y: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface VisionModels { detector: any; segmenter: any; delegate: "GPU" | "CPU" }

let cached: Promise<VisionModels> | null = null;

/** 카메라 영상이 준비된 뒤 호출. 실패하면 다음 호출 때 다시 시도합니다. */
export function loadVisionModels(): Promise<VisionModels> {
  if (cached) return cached;
  cached = (async () => {
    const mp = await import("@mediapipe/tasks-vision");
    const fs = await mp.FilesetResolver.forVisionTasks(WASM);
    let delegate: "GPU" | "CPU" = "GPU";
    let detector;
    try {
      detector = await mp.ObjectDetector.createFromOptions(fs, { baseOptions: { modelAssetPath: DET_MODEL, delegate }, runningMode: "VIDEO", scoreThreshold: 0.4, maxResults: 5 });
    } catch (e) {
      console.warn("[live-vision] GPU 실패, CPU로 재시도:", e);
      delegate = "CPU";
      detector = await mp.ObjectDetector.createFromOptions(fs, { baseOptions: { modelAssetPath: DET_MODEL, delegate }, runningMode: "VIDEO", scoreThreshold: 0.4, maxResults: 5 });
    }
    // magic_touch 단일 모델은 Legacy API 전용입니다(새 API는 .task 묶음 파일을 요구).
    const segmenter = await mp.InteractiveSegmenterLegacy.createFromOptions(fs, {
      baseOptions: { modelAssetPath: SEG_MODEL },
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });
    return { detector, segmenter, delegate };
  })();
  cached.catch(() => { cached = null; });
  return cached;
}

/** 마스크에서 물건 쪽 값(적은 쪽)을 고릅니다. */
export function maskForeground(m: Uint8Array): number {
  let ones = 0;
  for (let i = 0; i < m.length; i++) if (m[i]) ones++;
  return ones <= m.length / 2 ? 1 : 0;
}

/** 사용자가 겨눈 지점(0~1)의 마스크 값을 물건 값으로 씁니다. */
export function fgAt(m: Uint8Array, w: number, h: number, px: number, py: number): number {
  return m[Math.min(h - 1, Math.round(py * h)) * w + Math.min(w - 1, Math.round(px * w))] ? 1 : 0;
}

/** 마스크 중심에서 48방향으로 가장 먼 경계점을 찾아 윤곽선을 만듭니다. */
export function traceContour(m: Uint8Array, w: number, h: number, fg = maskForeground(m)): Pt[] {
  const isFg = (x: number, y: number) => (m[y * w + x] ? 1 : 0) === fg;
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (isFg(x, y)) { sx += x; sy += y; n++; }
  if (n < 50) return [];
  const cx = sx / n, cy = sy / n, R = Math.hypot(w, h);
  const pts: Pt[] = [];
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    let far = -1;
    for (let r = 0; r < R; r += 2) {
      const x = Math.round(cx + dx * r), y = Math.round(cy + dy * r);
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      if (isFg(x, y)) far = r;
    }
    if (far > 0) pts.push({ x: (cx + dx * far) / w, y: (cy + dy * far) / h });
  }
  return pts;
}

/**
 * 서랍장 단수: 물건 영역 안에서 폭의 60% 이상을 가로지르는 가로 경계선(서랍 사이 틈)을 셉니다.
 * 위·아래 바깥 테두리는 빼고, 간격이 고르지 않으면 null(추측하지 않음).
 */
export function drawerTiers(gray: Uint8Array, m: Uint8Array, w: number, h: number, fg = maskForeground(m)): { tiers: number; lines: number[] } | null {
  let top = h, bot = -1;
  const left = new Int32Array(h).fill(w), right = new Int32Array(h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if ((m[y * w + x] ? 1 : 0) !== fg) continue;
    if (y < top) top = y; if (y > bot) bot = y;
    if (x < left[y]) left[y] = x; if (x > right[y]) right[y] = x;
  }
  const H = bot - top;
  if (H < 40) return null;
  const margin = Math.max(3, Math.round(H * 0.06));
  const hits: number[] = [];
  for (let y = top + margin; y <= bot - margin; y++) {
    const l = left[y], r = right[y];
    if (r - l < 20) continue;
    let edge = 0, tot = 0;
    for (let x = l + 2; x <= r - 2; x++) {
      tot++;
      if (Math.abs(gray[(y + 1) * w + x] - gray[(y - 1) * w + x]) > 22) edge++;
    }
    if (tot && edge / tot >= 0.6) hits.push(y);
  }
  const lines: number[] = [];
  for (const y of hits) {
    if (lines.length && y - lines[lines.length - 1] <= 3) lines[lines.length - 1] = y; else lines.push(y);
  }
  if (lines.length < 1 || lines.length > 9) return null;
  const bounds = [top, ...lines, bot];
  const gaps = bounds.slice(1).map((b, i) => b - bounds[i]);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
  if (sd / mean > 0.35) return null;
  return { tiers: lines.length + 1, lines: lines.map((y) => y / h) };
}
