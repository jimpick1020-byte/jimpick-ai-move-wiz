/// <reference lib="webworker" />
/**
 * 촬영 사진 준비 (화면이 멈추지 않도록 별도 작업자에서 처리)
 * - 1280px 로 줄이고 JPEG 로 압축
 * - 어둡기/흔들림 검사
 * - 중복 사진 판별용 해시
 */
import { prepPhotoCore } from "./photo-prep-core";

self.onmessage = async (e: MessageEvent<{ id: number; file: Blob }>) => {
  const { id, file } = e.data;
  try {
    const out = await prepPhotoCore(file, (w, h) => new OffscreenCanvas(w, h));
    (self as unknown as Worker).postMessage({ id, ok: true, ...out });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : "사진을 읽지 못했습니다.",
    });
  }
};
