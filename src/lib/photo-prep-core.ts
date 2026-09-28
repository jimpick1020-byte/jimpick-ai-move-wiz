type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

export interface PreparedPhoto {
  blob: Blob;
  hash: string;
  quality: { ok: boolean; reason?: string };
  width: number;
  height: number;
}

async function toBlob(c: AnyCanvas): Promise<Blob> {
  if ("convertToBlob" in c) return c.convertToBlob({ type: "image/jpeg", quality: 0.85 });
  return new Promise((res, rej) =>
    (c as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error("사진 변환 실패"))), "image/jpeg", 0.85),
  );
}

export async function prepPhotoCore(
  file: Blob,
  makeCanvas: (w: number, h: number) => AnyCanvas,
  maxSize = 1280,
): Promise<PreparedPhoto> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); // 사진 방향 바로잡기
  if (bmp.width < 320 || bmp.height < 240) {
    bmp.close?.();
    throw new Error("사진 해상도가 너무 낮습니다. 다시 찍어 주세요.");
  }
  const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bmp, 0, 0, w, h);

  // 품질 검사용 축소본
  const sw = 200;
  const sh = Math.max(1, Math.round((h / w) * sw));
  const small = makeCanvas(sw, sh);
  const sctx = small.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  sctx.drawImage(bmp, 0, 0, sw, sh);
  bmp.close?.();
  const d = sctx.getImageData(0, 0, sw, sh).data;
  const gray = new Float32Array(sw * sh);
  let sum = 0;
  for (let i = 0; i < sw * sh; i++) {
    const g = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
    gray[i] = g;
    sum += g;
  }
  const mean = sum / (sw * sh);
  let ls = 0;
  let lq = 0;
  let n = 0;
  for (let y = 1; y < sh - 1; y++)
    for (let x = 1; x < sw - 1; x++) {
      const i = y * sw + x;
      const v = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - sw] - gray[i + sw];
      ls += v;
      lq += v * v;
      n++;
    }
  const variance = n ? lq / n - (ls / n) ** 2 : 0;
  let quality: PreparedPhoto["quality"] = { ok: true };
  if (mean < 0.16) quality = { ok: false, reason: "사진이 너무 어둡습니다. 불을 켜고 다시 찍어 주세요." };
  else if (mean > 0.94) quality = { ok: false, reason: "사진이 너무 밝습니다. 다시 찍어 주세요." };
  else if (variance < 0.0012) quality = { ok: false, reason: "사진이 흔들렸습니다. 멈춘 뒤 다시 찍어 주세요." };

  // 8x8 평균 해시
  const cells: number[] = [];
  for (let gy = 0; gy < 8; gy++)
    for (let gx = 0; gx < 8; gx++) {
      const x = Math.floor(((gx + 0.5) * sw) / 8);
      const y = Math.floor(((gy + 0.5) * sh) / 8);
      cells.push(gray[y * sw + x]);
    }
  const avg = cells.reduce((a, b) => a + b, 0) / cells.length;
  const hash = cells.map((c) => (c > avg ? "1" : "0")).join("");

  return { blob: await toBlob(canvas), hash, quality, width: w, height: h };
}

let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, { res: (p: PreparedPhoto) => void; rej: (e: Error) => void }>();

/** 가능하면 Web Worker 에서, 지원하지 않는 기기는 화면 쪽에서 처리합니다. */
let workerBroken = false;
const onMain = (file: Blob) =>
  prepPhotoCore(file, (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h })).catch((e) => {
    // HEIC 등 브라우저가 읽지 못하는 사진은 실제 원인을 알립니다
    throw new Error(e instanceof Error && /해상도|어둡|밝|흔들/.test(e.message) ? e.message : `이 사진 형식을 읽지 못했습니다(${file.type || "알 수 없음"}). 카메라 설정에서 JPEG로 저장하거나 다른 사진을 골라 주세요.`);
  });

export function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  const canWorker = !workerBroken && typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";
  if (!canWorker) return onMain(file);
  // 작업자가 응답하지 않으면(일부 갤럭시 브라우저) 화면 쪽 처리로 바꿉니다
  return Promise.race([
    viaWorker(file),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("worker_timeout")), 12000)),
  ]).catch((e) => {
    if (e instanceof Error && /해상도|어둡|밝|흔들/.test(e.message)) throw e;
    workerBroken = true;
    return onMain(file);
  });
}

function viaWorker(file: Blob): Promise<PreparedPhoto> {
  if (!worker) {
    worker = new Worker(new URL("./photo-prep.worker.ts", import.meta.url), { type: "module" });
    worker.onerror = () => {
      workerBroken = true;
      for (const [, w] of waiting) w.rej(new Error("worker_error"));
      waiting.clear();
    };
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data as { id: number; ok: boolean; error?: string } & PreparedPhoto;
      const w = waiting.get(m.id);
      if (!w) return;
      waiting.delete(m.id);
      if (m.ok) w.res(m);
      else w.rej(new Error(m.error || "사진을 읽지 못했습니다."));
    };
  }
  const id = ++seq;
  return new Promise((res, rej) => {
    waiting.set(id, { res, rej });
    worker!.postMessage({ id, file });
  });
}

export function hashDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) d++;
  return d;
}
