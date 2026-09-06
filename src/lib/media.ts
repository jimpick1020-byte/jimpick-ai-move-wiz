/**
 * 파일 → data URL (이미지 리사이즈 포함)
 *
 * 1024px·품질 0.82 로 줄입니다. 휴대폰 사진을 그대로 보내면
 * base64 로 1MB 가까이 되어 업로드만 몇 초씩 걸렸습니다.
 * 가구·가전을 알아보는 데는 1024px 이면 충분하고 크기는 1/5 로 줄어듭니다.
 */
export async function fileToDataUrl(file: File, maxSize = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** 간단한 평균 밝기 해시 — 거의 같은 장면을 걸러내는 데 사용합니다 */
function frameHash(ctx: CanvasRenderingContext2D, w: number, h: number): string {
  const grid = 8;
  const data = ctx.getImageData(0, 0, w, h).data;
  const cells: number[] = [];
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const x = Math.floor(((gx + 0.5) * w) / grid);
      const y = Math.floor(((gy + 0.5) * h) / grid);
      const i = (y * w + x) * 4;
      cells.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    }
  }
  const avg = cells.reduce((a, b) => a + b, 0) / cells.length;
  return cells.map((c) => (c > avg ? "1" : "0")).join("");
}

function hamming(a: string, b: string) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/**
 * 동영상에서 1초 간격으로 프레임을 추출하고 중복 장면을 제거합니다.
 * 장면 수와 크기를 줄여 업로드 시간을 크게 낮췄습니다 (8장·1440px → 5장·960px).
 */
export async function videoToFrames(file: File, maxFrames = 5, maxSize = 960): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("동영상을 읽을 수 없습니다."));
  });

  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, maxSize / Math.max(video.videoWidth || 1, video.videoHeight || 1));
  canvas.width = Math.round((video.videoWidth || 640) * scale);
  canvas.height = Math.round((video.videoHeight || 480) * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  // 1초 간격 타임스탬프 (영상이 길면 균등 분포로 maxFrames개까지만)
  const seconds = Math.max(1, Math.floor(duration));
  let times: number[] = [];
  for (let t = 0.3; t < seconds; t += 1) times.push(t);
  if (times.length === 0) times = [0];
  if (times.length > maxFrames) {
    const step = times.length / maxFrames;
    times = Array.from({ length: maxFrames }, (_, i) => times[Math.floor(i * step)]);
  }

  const frames: string[] = [];
  const hashes: string[] = [];
  for (const t of times) {
    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
      video.currentTime = Math.min(t, Math.max(0, duration - 0.05));
    });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const hash = frameHash(ctx, canvas.width, canvas.height);
    // 이전 장면과 거의 같으면 건너뜁니다 (중복 제거)
    if (hashes.some((h) => hamming(h, hash) <= 5)) continue;
    hashes.push(hash);
    frames.push(canvas.toDataURL("image/jpeg", 0.8));
    if (frames.length >= maxFrames) break;
  }

  URL.revokeObjectURL(url);
  return frames.length > 0 ? frames : [canvas.toDataURL("image/jpeg", 0.8)];
}

/** data URL → 이미지 엘리먼트 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("사진을 읽을 수 없습니다."));
    img.src = dataUrl;
  });
}

/**
 * 사진을 격자로 잘라 확대 조각을 만듭니다.
 * 작거나 가려진 물건을 다시 확인하기 위한 「확대 분석」용입니다.
 */
export async function tileDataUrl(dataUrl: string, grid = 2, tileSize = 768): Promise<string[]> {
  const img = await loadImage(dataUrl);
  const out: string[] = [];
  const cw = img.width / grid;
  const ch = img.height / grid;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      // 이웃 조각과 10% 겹치게 잘라, 경계에 걸친 물건이 잘려 사라지지 않게 합니다
      const ox = Math.max(0, cw * gx - cw * 0.1);
      const oy = Math.max(0, ch * gy - ch * 0.1);
      const ow = Math.min(img.width - ox, cw * 1.2);
      const oh = Math.min(img.height - oy, ch * 1.2);
      const scale = Math.min(1.6, tileSize / Math.max(ow, oh));
      canvas.width = Math.max(1, Math.round(ow * scale));
      canvas.height = Math.max(1, Math.round(oh * scale));
      ctx.drawImage(img, ox, oy, ow, oh, 0, 0, canvas.width, canvas.height);
      out.push(canvas.toDataURL("image/jpeg", 0.82));
    }
  }
  return out;
}

/**
 * 너무 어둡거나 흔들린 사진인지 미리 봅니다.
 * (밝기 평균과 이웃 화소 차이로 판단 — 서버에 보내기 전 걸러 냅니다)
 */
export async function photoQuality(
  dataUrl: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const img = await loadImage(dataUrl);
    const w = 200;
    const h = Math.max(1, Math.round((img.height / img.width) * w));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);
    let sum = 0;
    for (let i = 0; i < w * h; i++) {
      const g = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
      gray[i] = g;
      sum += g;
    }
    const mean = sum / (w * h);
    // 라플라시안 분산 근사 — 선명하면 값이 큽니다
    let lapSum = 0;
    let lapSq = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const v =
          4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
        lapSum += v;
        lapSq += v * v;
        n++;
      }
    }
    const variance = n ? lapSq / n - (lapSum / n) ** 2 : 0;
    if (mean < 0.16) return { ok: false, reason: "사진이 너무 어둡습니다. 불을 켜고 다시 찍어주세요." };
    if (mean > 0.94) return { ok: false, reason: "사진이 너무 밝아 물건이 안 보입니다. 다시 찍어주세요." };
    if (variance < 0.0012)
      return { ok: false, reason: "사진이 흔들렸습니다. 잠시 멈춘 뒤 다시 찍어주세요." };
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
