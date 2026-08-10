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
