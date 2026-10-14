import { useEffect, useState } from "react";
import { clearWhiteBackdrop } from "./item-cutout";

const cache = new Map<string, Promise<string>>();
function cutout(src: string): Promise<string> {
  const existing = cache.get(src);
  if (existing) return existing;
  const result = (async () => {
    const image = new Image(); image.crossOrigin = "anonymous"; image.src = src;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return src;
    context.drawImage(image, 0, 0);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    frame.data.set(clearWhiteBackdrop(frame.data, canvas.width, canvas.height));
    context.putImageData(frame, 0, 0);
    let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (frame.data[(y * canvas.width + x) * 4 + 3] <= 16) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < left) return src;
    const cropped = document.createElement("canvas");
    cropped.width = right - left + 1; cropped.height = bottom - top + 1;
    cropped.getContext("2d")?.drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
    return cropped.toDataURL("image/png");
  })().catch(() => src);
  cache.set(src, result);
  return result;
}
export function useItemCutout(src: string, enabled: boolean): string {
  const [result, setResult] = useState({ src: "", url: "" });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void cutout(src).then(url => { if (alive) setResult({ src, url }); });
    return () => { alive = false; };
  }, [src, enabled]);
  return enabled && result.src === src ? result.url : src;
}