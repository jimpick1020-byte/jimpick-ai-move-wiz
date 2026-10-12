import { useState } from "react";
import type { ScanDetection } from "@/lib/room-scan.functions";
import { normalizeContour, scanDisplayLabel } from "@/lib/scan-geometry";
import { AUTO_CONF, CHECK_CONF } from "@/lib/scan-rules";

/** The image and SVG share the natural aspect ratio, including object-cover cropping. */
export function ScanOutline({ url, room, items }: { url: string; room: string; items: ScanDetection[] }) {
  const [imageSize, setImageSize] = useState({ url: "", w: 4, h: 3 });
  const size = imageSize.url === url ? imageSize : { w: 4, h: 3 };
  return (
    <svg viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-label={`${room} 사진 인식`}>
      <image href={url} width={size.w} height={size.h} />
      <foreignObject width="0" height="0">
        <img src={url} alt="" onLoad={(e) => setImageSize({ url, w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
      </foreignObject>
      {items.map((det, i) => {
        const contour = normalizeContour(det.contour);
        if (!contour || (det.confidence != null && det.confidence < CHECK_CONF)) return null;
        const points = contour.map((p) => `${p.x / 1000 * size.w},${p.y / 1000 * size.h}`).join(" ");
        const anchor = contour.reduce((a, p) => p.y < a.y ? p : a);
        const fontSize = size.w / 36;
        return (
          <g key={i} className={det.confidence != null && det.confidence >= AUTO_CONF ? "jp-scan-outline-auto" : "jp-scan-outline-check"}>
            <polygon points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <text x={Math.min(700, Math.max(20, anchor.x)) / 1000 * size.w} y={Math.max(fontSize * 1.3, anchor.y / 1000 * size.h - fontSize * 0.3)} fontSize={fontSize} className="jp-scan-outline-label" paintOrder="stroke" strokeWidth={fontSize * 0.18}>
              {scanDisplayLabel(det)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}