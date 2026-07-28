/** 파일 → data URL (이미지 리사이즈 포함) */
export async function fileToDataUrl(file: File, maxSize = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** 동영상에서 균등 간격으로 프레임을 추출해 data URL 배열로 반환 */
export async function videoToFrames(file: File, count = 5, maxSize = 1024): Promise<string[]> {
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
  const ctx = canvas.getContext("2d")!;

  const frames: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = duration ? (duration * (i + 0.5)) / count : 0;
    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
      video.currentTime = Math.min(t, Math.max(0, duration - 0.05));
    });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL("image/jpeg", 0.8));
  }

  URL.revokeObjectURL(url);
  return frames;
}
