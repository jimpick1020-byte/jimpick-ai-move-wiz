/**
 * 견적서 화면을 그림 파일(PNG)로 저장합니다.
 *
 * 바깥 라이브러리를 쓰지 않습니다.
 * 예전에 화면을 그림으로 뜨는 라이브러리를 넣었다가 앱이 멈춘 적이 있어,
 * 여기서는 브라우저에 원래 있는 기능만으로 만들고 시간 제한을 둡니다.
 *
 * 만드는 순서
 *   1) 견적서 안의 그림들을 글자 자료(data URL)로 바꿔 넣습니다.
 *      (그렇게 하지 않으면 그림이 빠진 채로 저장됩니다)
 *   2) 화면 모양 그대로를 SVG 안에 넣고 캔버스에 그립니다.
 *   3) 캔버스를 PNG 로 만들어 내려받습니다.
 *
 * 정해진 시간 안에 끝나지 않으면 성공한 척하지 않고 실패를 알려 줍니다.
 */

/** 시간이 너무 걸리면 포기합니다 (화면이 멈춘 것처럼 보이지 않게) */
const TIMEOUT_MS = 15000;
/** 너무 큰 그림은 휴대폰에서 못 만듭니다 — 넓이 기준 최대 배율 */
const MAX_PIXELS = 24_000_000;

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      window.setTimeout(() => reject(new Error(`${what}이(가) 너무 오래 걸립니다.`)), ms),
    ),
  ]);
}

/** 그림 하나를 data URL 로 바꿉니다 */
async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("그림을 읽지 못했습니다."));
    fr.readAsDataURL(blob);
  });
}

/** 화면에 쓰인 글꼴·색 규칙을 그대로 옮겨 적습니다 */
function collectCss(): string {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) out.push(rule.cssText);
    } catch {
      /* 다른 곳에서 온 규칙은 읽을 수 없습니다 — 건너뜁니다 */
    }
  }
  return out.join("\n");
}

export interface SaveImageResult {
  ok: boolean;
  error?: string;
  /** 만든 그림 크기 */
  width?: number;
  height?: number;
}

/**
 * 견적서 전체를 세로로 긴 PNG 한 장으로 저장합니다.
 * 화면에 보이는 부분만이 아니라 아래 끝까지 모두 담습니다.
 */
export async function saveSheetAsPng(el: HTMLElement, fileName: string): Promise<SaveImageResult> {
  try {
    return await withTimeout(run(el, fileName), TIMEOUT_MS, "그림 만들기");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "그림을 만들지 못했습니다." };
  }
}

async function run(el: HTMLElement, fileName: string): Promise<SaveImageResult> {
  const width = Math.ceil(el.scrollWidth);
  const height = Math.ceil(el.scrollHeight);
  if (!width || !height) return { ok: false, error: "견적서를 찾지 못했습니다." };

  // 확대해도 흐리지 않게 2배로 그리되, 너무 크면 배율을 낮춥니다
  let scale = 2;
  while (scale > 1 && width * scale * height * scale > MAX_PIXELS) scale -= 0.25;

  // 1) 그림들을 글자 자료로 바꿔 넣습니다
  const clone = el.cloneNode(true) as HTMLElement;
  const originals = Array.from(el.querySelectorAll("img"));
  const copies = Array.from(clone.querySelectorAll("img"));
  await Promise.all(
    copies.map(async (img, i) => {
      const src = originals[i]?.currentSrc || originals[i]?.src || img.src;
      if (!src) return;
      try {
        img.setAttribute("src", await toDataUrl(src));
      } catch {
        // 못 읽은 그림은 빈 자리로 둡니다 (가짜 그림을 넣지 않습니다)
        img.remove();
      }
    }),
  );

  // 2) 화면 모양 그대로 SVG 안에 넣습니다
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.margin = "0";
  // 요즘 CSS 에는 & 같은 글자가 들어 있어 그대로 넣으면 XML 이 깨집니다.
  // CDATA 로 감싸서 있는 그대로 넣습니다.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<foreignObject width="100%" height="100%">
<div xmlns="http://www.w3.org/1999/xhtml">
<style><![CDATA[${collectCss().replace(/]]>/g, "]]&gt;")}]]></style>
${new XMLSerializer().serializeToString(clone)}
</div>
</foreignObject></svg>`;

  // 주소가 너무 길면 data: 로는 열리지 않으므로 파일 조각(blob)으로 만듭니다
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("견적서를 그림으로 옮기지 못했습니다."));
    im.src = url;
  }).finally(() => URL.revokeObjectURL(url));

  // 3) 캔버스에 그려 PNG 로 만듭니다
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: "이 브라우저에서는 그림으로 저장할 수 없습니다." };
  ctx.fillStyle = "#F2F5FA";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.drawImage(image, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return { ok: false, error: "그림 파일을 만들지 못했습니다." };

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 4000);

  return { ok: true, width: canvas.width, height: canvas.height };
}
