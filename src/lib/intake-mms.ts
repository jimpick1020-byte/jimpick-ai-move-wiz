import image from "@/assets/message-previews/intake-preview-v2.webp.asset.json";

export interface IntakeMmsMessage { to: string; body: string }
export function intakeMmsPayload(file: File, body: string): ShareData {
  return { files: [file], text: body };
}
export function canShareIntakeMms(nav: Pick<Navigator, "share" | "canShare">, file: File, body: string): boolean {
  try { return typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare(intakeMmsPayload(file, body)); }
  catch { return false; }
}

/** Preserve the existing artwork, transcode only for native MMS attachment compatibility. */
export async function prepareIntakeMmsImage(): Promise<File> {
  const response = await fetch(image.url);
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error("안내 그림을 불러오지 못했습니다.");
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("안내 그림을 준비하지 못했습니다.");
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("안내 그림을 준비하지 못했습니다.")), "image/jpeg", 0.95));
    return new File([blob], "견적잇-사전정보-안내.jpg", { type: "image/jpeg" });
  } finally { bitmap.close(); }
}