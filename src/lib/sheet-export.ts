/**
 * 견적서를 A4 로 인쇄·저장합니다.
 *
 * 브라우저 내장 인쇄를 씁니다.
 *   - 안드로이드 크롬: 인쇄 → 대상에서 "PDF로 저장"
 *   - 아이폰 사파리: 공유 → "PDF로 저장"
 *   - 컴퓨터: 대상에서 "PDF로 저장"
 *
 * 화면을 그림으로 떠서 PDF 를 만드는 방법(html-to-image)도 해 봤지만,
 * 3배 크기로 그리는 동안 화면이 멈춰 버려서 쓰지 않습니다.
 * 인쇄 방식은 글씨가 벡터로 남아 확대해도 더 또렷합니다.
 */

/** 인쇄할 때 견적서만 남기고 나머지는 숨기는 규칙 */
const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 10mm; }
  html, body { background: var(--card) !important; }
  body .jp-print-hidden { display: none !important; }
  html, body, body .jp-print-ancestor {
    display: block !important; position: static !important;
    width: auto !important; max-width: none !important; min-width: 0 !important;
    height: auto !important; min-height: 0 !important; max-height: none !important;
    overflow: visible !important; contain: none !important; transform: none !important;
    padding: 0 !important; margin: 0 !important;
    border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
  }
  #jp-print-area {
    position: static !important; width: 100% !important;
    height: auto !important; min-height: 0 !important;
    max-height: none !important; overflow: visible !important; display: block !important;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  /* 긴 영역은 여러 페이지로 이어지고 개별 옵션 행만 함께 출력합니다. */
  #jp-print-area > div > div { break-inside: auto !important; }
  #jp-print-area tr,
  #jp-print-area .jp-option-row {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  #jp-print-area p { orphans: 2; widows: 2; }
  /* 그림이 반으로 잘리지 않게 */
  #jp-print-area img { break-inside: avoid; page-break-inside: avoid; }
}
`;

let styleEl: HTMLStyleElement | null = null;

function ensureStyle() {
  if (styleEl) return;
  styleEl = document.createElement("style");
  styleEl.id = "jp-print-style";
  styleEl.textContent = PRINT_CSS;
  document.head.appendChild(styleEl);
}

/**
 * 안에 있는 그림이 다 그려질 때까지 기다립니다.
 *
 * 3D 아이콘은 화면 밖에 있으면 나중에 불러오도록(lazy) 되어 있어,
 * 그대로 기다리면 영영 끝나지 않습니다. 먼저 바로 불러오도록 바꾼 뒤
 * 기다리고, 그래도 안 오면 3초 뒤 그냥 진행합니다.
 */
async function waitImages(el: HTMLElement): Promise<void> {
  const imgs = [...el.querySelectorAll("img")];
  for (const img of imgs) img.loading = "eager";
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 3000);
          }),
    ),
  );
}

/**
 * 견적서를 A4 로 인쇄합니다.
 * 인쇄 대화상자에서 「PDF로 저장」을 고르면 파일로 남습니다.
 */
export async function printSheet(el: HTMLElement): Promise<void> {
  if (document.querySelector(".jp-print-ancestor")) return;
  ensureStyle();
  await waitImages(el);
  await document.fonts.ready;
  const prev = el.id;
  el.id = "jp-print-area";
  const ancestors: Element[] = [];
  const hidden: Element[] = [];
  let child: Element = el;
  let parent = child.parentElement;
  while (parent) {
    parent.classList.add("jp-print-ancestor");
    ancestors.push(parent);
    for (const sibling of parent.children) {
      if (sibling !== child && !sibling.classList.contains("jp-print-hidden")) {
        sibling.classList.add("jp-print-hidden");
        hidden.push(sibling);
      }
    }
    child = parent;
    parent = parent.parentElement;
  }
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    el.id = prev;
    ancestors.forEach((node) => node.classList.remove("jp-print-ancestor"));
    hidden.forEach((node) => node.classList.remove("jp-print-hidden"));
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  try {
    window.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}
