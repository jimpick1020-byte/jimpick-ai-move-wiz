/// <reference lib="webworker" />
/**
 * 물체 분할 계산 전용 Web Worker.
 *
 *  - onnxruntime-web 으로 jimpick-furniture-seg.onnx 를 실행합니다.
 *  - 지원 기기에서는 WebGPU, 안 되면 WASM 으로 자동 전환합니다.
 *  - 무거운 계산이 모두 여기서 돌아 화면이 멈추지 않습니다.
 *  - 모델이 준 마스크에서 실제 외곽선(polygon)을 뽑아 돌려줍니다. 가짜 값은 만들지 않습니다.
 */
import * as ort from "onnxruntime-web";
import type { SegInstance } from "./types";

// WASM 실행 파일 위치 (WebGPU 미지원 기기에서 사용)
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
ort.env.wasm.numThreads = 1;

interface RunMessage {
  type: "run";
  jobId: number;
  modelUrl: string;
  /** 분석할 사진 (ImageBitmap 으로 전달 — 복사 비용 없음) */
  bitmap: ImageBitmap;
  /** 모델 입력 한 변 크기 */
  size: number;
  /** 최소 신뢰도 */
  minScore: number;
  labels: string[];
}

let session: ort.InferenceSession | null = null;
let backend: "webgpu" | "wasm" | null = null;
let loadedUrl = "";

async function ensureSession(modelUrl: string) {
  if (session && loadedUrl === modelUrl) return;
  const head = await fetch(modelUrl, { method: "HEAD" }).catch(() => null);
  if (!head || !head.ok) throw new Error("MODEL_MISSING");

  const tryCreate = async (provider: "webgpu" | "wasm") => {
    session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: [provider],
      graphOptimizationLevel: "all",
    });
    backend = provider;
  };

  const hasWebGpu = typeof (navigator as unknown as { gpu?: unknown }).gpu !== "undefined";
  if (hasWebGpu) {
    try {
      await tryCreate("webgpu");
    } catch {
      await tryCreate("wasm");
    }
  } else {
    await tryCreate("wasm");
  }
  loadedUrl = modelUrl;
}

/** 사진을 정사각형 letterbox 로 맞춘 NCHW float 입력으로 만듭니다 */
function preprocess(bitmap: ImageBitmap, size: number) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#727272";
  ctx.fillRect(0, 0, size, size);
  const scale = Math.min(size / bitmap.width, size / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const dx = Math.round((size - w) / 2);
  const dy = Math.round((size - h) / 2);
  ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, dx, dy, w, h);
  const { data } = ctx.getImageData(0, 0, size, size);
  const out = new Float32Array(size * size * 3);
  const plane = size * size;
  for (let i = 0; i < plane; i += 1) {
    out[i] = data[i * 4] / 255;
    out[plane + i] = data[i * 4 + 1] / 255;
    out[plane * 2 + i] = data[i * 4 + 2] / 255;
  }
  return { tensor: new ort.Tensor("float32", out, [1, 3, size, size]), dx, dy, w, h };
}

function sigmoid(v: number) {
  return 1 / (1 + Math.exp(-v));
}

function iou(a: SegInstance["box"], b: SegInstance["box"]) {
  const x0 = Math.max(a.x0, b.x0);
  const y0 = Math.max(a.y0, b.y0);
  const x1 = Math.min(a.x1, b.x1);
  const y1 = Math.min(a.y1, b.y1);
  if (x1 <= x0 || y1 <= y0) return 0;
  const inter = (x1 - x0) * (y1 - y0);
  const areaA = (a.x1 - a.x0) * (a.y1 - a.y0);
  const areaB = (b.x1 - b.x0) * (b.y1 - b.y0);
  return inter / (areaA + areaB - inter);
}

/**
 * 마스크(0/1 격자)에서 실제 외곽선 좌표를 뽑습니다 (Moore 경계 추적).
 * 결과는 0~1 정규화 좌표이며, 점이 너무 많으면 균일하게 줄입니다.
 */
function maskToPolygon(
  mask: Uint8Array,
  mw: number,
  mh: number,
  toNorm: (x: number, y: number) => { x: number; y: number },
): { x: number; y: number }[] {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= mw || y >= mh ? 0 : mask[y * mw + x]);
  let sx = -1;
  let sy = -1;
  for (let y = 0; y < mh && sx < 0; y += 1)
    for (let x = 0; x < mw; x += 1)
      if (at(x, y)) {
        sx = x;
        sy = y;
        break;
      }
  if (sx < 0) return [];

  const dirs = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];
  const contour: { x: number; y: number }[] = [];
  let cx = sx;
  let cy = sy;
  let dir = 0;
  const limit = mw * mh * 4;
  for (let step = 0; step < limit; step += 1) {
    contour.push({ x: cx, y: cy });
    let moved = false;
    for (let k = 0; k < 8; k += 1) {
      const d = (dir + 6 + k) % 8;
      const nx = cx + dirs[d][0];
      const ny = cy + dirs[d][1];
      if (at(nx, ny)) {
        cx = nx;
        cy = ny;
        dir = d;
        moved = true;
        break;
      }
    }
    if (!moved) break;
    if (cx === sx && cy === sy && contour.length > 8) break;
  }
  if (contour.length < 12) return [];
  const maxPoints = 160;
  const stride = Math.max(1, Math.floor(contour.length / maxPoints));
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < contour.length; i += stride) out.push(toNorm(contour[i].x, contour[i].y));
  return out.length >= 6 ? out : [];
}

async function run(msg: RunMessage) {
  const started = performance.now();
  await ensureSession(msg.modelUrl);
  if (!session) throw new Error("NO_SESSION");

  const { tensor, dx, dy, w, h } = preprocess(msg.bitmap, msg.size);
  const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]]: tensor };
  const outputs = await session.run(feeds);
  const tensors = session.outputNames.map((n) => outputs[n]).filter(Boolean);
  const det = tensors.find((t) => t.dims.length === 3 && t.dims[1] > 6);
  const proto = tensors.find((t) => t.dims.length === 4);
  if (!det) throw new Error("UNEXPECTED_OUTPUT");

  const detData = det.data as Float32Array;
  const ch = det.dims[1];
  const num = det.dims[2];
  const maskDim = proto ? proto.dims[1] : 0;
  const numClasses = ch - 4 - maskDim;
  const get = (c: number, i: number) => detData[c * num + i];

  const raw: (SegInstance & { coeffs: number[] })[] = [];
  for (let i = 0; i < num; i += 1) {
    let best = -1;
    let bestScore = 0;
    for (let c = 0; c < numClasses; c += 1) {
      const s = get(4 + c, i);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    if (best < 0 || bestScore < msg.minScore) continue;
    const cx = get(0, i);
    const cy = get(1, i);
    const bw = get(2, i);
    const bh = get(3, i);
    const x0 = (cx - bw / 2 - dx) / w;
    const y0 = (cy - bh / 2 - dy) / h;
    const x1 = (cx + bw / 2 - dx) / w;
    const y1 = (cy + bh / 2 - dy) / h;
    if (!(x1 > x0 && y1 > y0)) continue;
    const coeffs: number[] = [];
    for (let m = 0; m < maskDim; m += 1) coeffs.push(get(4 + numClasses + m, i));
    raw.push({
      rawLabel: msg.labels[best] ?? `class_${best}`,
      confidence: Math.min(1, bestScore),
      box: {
        x0: Math.max(0, Math.min(1, x0)),
        y0: Math.max(0, Math.min(1, y0)),
        x1: Math.max(0, Math.min(1, x1)),
        y1: Math.max(0, Math.min(1, y1)),
      },
      polygon: [],
      coeffs,
    });
  }

  raw.sort((a, b) => b.confidence - a.confidence);
  const kept: typeof raw = [];
  for (const cand of raw) {
    if (kept.some((k) => iou(k.box, cand.box) > 0.55)) continue;
    kept.push(cand);
    if (kept.length >= 30) break;
  }

  // 마스크 계수 × prototype → 실제 물체 마스크 → 외곽선
  if (proto && maskDim > 0) {
    const protoData = proto.data as Float32Array;
    const ph = proto.dims[2];
    const pw = proto.dims[3];
    for (const inst of kept) {
      const px0 = Math.floor(((inst.box.x0 * w + dx) / msg.size) * pw);
      const px1 = Math.ceil(((inst.box.x1 * w + dx) / msg.size) * pw);
      const py0 = Math.floor(((inst.box.y0 * h + dy) / msg.size) * ph);
      const py1 = Math.ceil(((inst.box.y1 * h + dy) / msg.size) * ph);
      const bwp = Math.max(2, Math.min(pw, px1) - Math.max(0, px0));
      const bhp = Math.max(2, Math.min(ph, py1) - Math.max(0, py0));
      const mask = new Uint8Array(bwp * bhp);
      for (let y = 0; y < bhp; y += 1) {
        for (let x = 0; x < bwp; x += 1) {
          const gx = Math.max(0, px0) + x;
          const gy = Math.max(0, py0) + y;
          let sum = 0;
          for (let m = 0; m < maskDim; m += 1)
            sum += inst.coeffs[m] * protoData[m * ph * pw + gy * pw + gx];
          if (sigmoid(sum) > 0.5) mask[y * bwp + x] = 1;
        }
      }
      inst.polygon = maskToPolygon(mask, bwp, bhp, (x, y) => {
        // prototype 격자 → letterbox 좌표 → 원본 사진 비율
        const lx = ((Math.max(0, px0) + x) / pw) * msg.size;
        const ly = ((Math.max(0, py0) + y) / ph) * msg.size;
        return {
          x: Math.max(0, Math.min(1, (lx - dx) / w)),
          y: Math.max(0, Math.min(1, (ly - dy) / h)),
        };
      });
    }
  }

  const instances: SegInstance[] = kept.map(({ coeffs: _c, ...rest }) => rest);
  return { instances, backend: backend!, elapsedMs: Math.round(performance.now() - started) };
}

self.onmessage = async (event: MessageEvent<RunMessage>) => {
  const msg = event.data;
  if (msg?.type !== "run") return;
  try {
    const result = await run(msg);
    (self as unknown as Worker).postMessage({ jobId: msg.jobId, ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    (self as unknown as Worker).postMessage({ jobId: msg.jobId, ok: false, code });
  } finally {
    msg.bitmap.close?.();
  }
};
