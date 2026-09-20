/**
 * 물체 분할 실행기 (화면 쪽 연결부).
 *
 *  - 계산은 Web Worker 에서 돌아 화면이 멈추지 않습니다.
 *  - 모델 파일(/models/jimpick-furniture-seg.onnx)이 없으면 status="model_missing" 을 돌려줍니다.
 *    이때 가짜 외곽선을 만들지 않고, 화면은 기존 네모 상자 표시를 그대로 씁니다.
 *  - 새 프레임이 들어오면 이전 계산은 버리고 가장 최근 것만 씁니다.
 *  - 같은 사진은 한 번만 계산하고 결과를 재사용합니다 (캐시).
 */
import {
  SEG_MODEL_MISSING_TEXT,
  SEG_MODEL_URL,
  type SegRunResult,
  type SegStatus,
} from "./types";

let worker: Worker | null = null;
let jobSeq = 0;
let latestJob = 0;
let availability: Promise<boolean> | null = null;
const cache = new Map<string, SegRunResult>();

/** 기본 라벨 — 전용 모델과 함께 labels.json 을 두면 그것을 씁니다 */
const DEFAULT_LABELS = [
  "sofa",
  "bed",
  "wardrobe",
  "drawer",
  "desk",
  "chair",
  "dining table",
  "tv",
  "tv stand",
  "refrigerator",
  "kimchi refrigerator",
  "washing machine",
  "dryer",
  "styler",
  "air conditioner",
  "bookshelf",
  "cat tower",
  "potted plant",
  "mirror",
  "piano",
];
let labels: string[] | null = null;

async function loadLabels(): Promise<string[]> {
  if (labels) return labels;
  try {
    const res = await fetch("/models/jimpick-furniture-seg.labels.json");
    if (res.ok) {
      const parsed = await res.json();
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
        labels = parsed;
        return labels;
      }
    }
  } catch {
    /* labels 파일이 없으면 기본 라벨을 씁니다 */
  }
  labels = DEFAULT_LABELS;
  return labels;
}

/** 전용 분할 모델 파일이 실제로 있는지 확인합니다 */
export function checkSegModelAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const res = await fetch(SEG_MODEL_URL, { method: "HEAD" });
        return res.ok;
      } catch {
        return false;
      }
    })();
  }
  return availability;
}

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./seg.worker.ts", import.meta.url), { type: "module" });
  }
  return worker;
}

function statusFromCode(code: string): { status: SegStatus; message: string } {
  if (code === "MODEL_MISSING") return { status: "model_missing", message: SEG_MODEL_MISSING_TEXT };
  if (code === "UNEXPECTED_OUTPUT")
    return { status: "error", message: "분할 모델 출력 형식을 읽을 수 없습니다." };
  return { status: "error", message: `외곽선 계산 실패 (${code})` };
}

/**
 * 사진 한 장의 실제 외곽선을 계산합니다.
 * @param src  사진 (data URL 또는 URL)
 * @param cacheKey 같은 사진을 다시 계산하지 않기 위한 키
 */
export async function segmentImage(
  src: string,
  opts: { cacheKey?: string; size?: number; minScore?: number } = {},
): Promise<SegRunResult> {
  const key = opts.cacheKey ?? src.slice(-256);
  const hit = cache.get(key);
  if (hit) return hit;

  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
    return { status: "unsupported", instances: [], message: "이 브라우저에서는 정밀 외곽선을 계산할 수 없습니다." };
  }
  if (!(await checkSegModelAvailable())) {
    const result: SegRunResult = {
      status: "model_missing",
      instances: [],
      message: SEG_MODEL_MISSING_TEXT,
    };
    cache.set(key, result);
    return result;
  }

  const blob = await (await fetch(src)).blob();
  const bitmap = await createImageBitmap(blob);
  const jobId = ++jobSeq;
  latestJob = jobId;
  const w = ensureWorker();
  const labelList = await loadLabels();

  return new Promise<SegRunResult>((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | { jobId: number; ok: true; instances: SegRunResult["instances"]; backend: "webgpu" | "wasm"; elapsedMs: number }
        | { jobId: number; ok: false; code: string };
      if (data.jobId !== jobId) return;
      w.removeEventListener("message", onMessage);
      // 더 최근 프레임이 들어왔으면 이 결과는 버립니다
      if (jobId !== latestJob) {
        resolve({ status: "error", instances: [], message: "새 사진으로 다시 계산했습니다." });
        return;
      }
      if (data.ok) {
        const result: SegRunResult = {
          status: "ready",
          backend: data.backend,
          instances: data.instances,
          elapsedMs: data.elapsedMs,
        };
        cache.set(key, result);
        resolve(result);
        return;
      }
      const mapped = statusFromCode(data.code);
      const result: SegRunResult = { ...mapped, instances: [] };
      if (mapped.status === "model_missing") cache.set(key, result);
      resolve(result);
    };
    w.addEventListener("message", onMessage);
    w.postMessage(
      {
        type: "run",
        jobId,
        modelUrl: SEG_MODEL_URL,
        bitmap,
        size: opts.size ?? 640,
        minScore: opts.minScore ?? 0.3,
        labels: labelList,
      },
      [bitmap],
    );
  });
}

/** 촬영 중 빠른 확인용 — 낮은 해상도로 위치만 빠르게 봅니다 */
export function segmentPreviewFrame(src: string, cacheKey: string) {
  return segmentImage(src, { cacheKey, size: 416, minScore: 0.35 });
}
