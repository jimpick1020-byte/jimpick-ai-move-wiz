import { z } from "zod";

export interface ScanPoint { x: number; y: number }
export interface ScanBox { x: number; y: number; w: number; h: number }
export interface ShelfLine { start: ScanPoint; end: ScanPoint }

const pointSchema = z.object({ x: z.number(), y: z.number() });
export const scanOutputSchema = z.object({
  photo_ok: z.boolean(),
  photo_problem: z.string().nullable(),
  items: z.array(z.object({
    name: z.string(), qty: z.number(), confidence: z.number().nullable(), item_id: z.string().nullable(),
    box: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).nullable(),
    contour: z.array(pointSchema).nullable(),
    shelf_lines: z.array(z.object({ start: pointSchema, end: pointSchema })).nullable(),
    shelves_complete: z.boolean().nullable(),
    shelf_confidence: z.number().nullable(),
  })),
});

export const SCAN_GEOMETRY_PROMPT = `
- contour: 물건 자체의 실제 보이는 외곽을 시계 방향으로 따라가는 4~48개 {x,y} 꼭짓점. 좌표는 입력 사진 가로·세로 각각 0~1000. 사각형 box를 복사하지 말고 원근·모서리·다리의 모양을 따르세요. 책·장식·옆 물건·배경은 경계에 포함하지 않습니다. 윤곽이 가려져 확인 불가하면 null, 가려진 외곽을 지어내지 않습니다.
- 책장 shelf_lines: 좌우 기둥 사이 실제 내부 가로 선반의 앞쪽 모서리만 {start:{x,y},end:{x,y}}로 표시. 상판·바닥판은 제외, 같은 선반 두께의 위아래 선은 한 개로 셉니다. 책의 가장자리·벽·주변 가구는 선반이 아닙니다. 책장이 아니면 null.
- shelves_complete: 책장 내부 전체 높이를 확인했고 모든 내부 선반을 셀 수 있을 때만 true. 가림·잘림·불확실하면 false. 내부 선반 N개는 수납 공간 N+1단입니다. shelf_confidence는 선반 판정의 실제 확신도 0~1, 모르면 null. 빈 shelf_lines와 shelves_complete=true는 내부 선반 없는 1단 책장에만 사용합니다.`;

export function normalizeContour(points: ScanPoint[] | null | undefined): ScanPoint[] | null {
  if (!points || points.length < 3 || points.length > 96) return null;
  if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1000 || p.y < 0 || p.y > 1000)) return null;
  const clean = points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
  const area = Math.abs(clean.reduce((a, p, i) => {
    const next = clean[(i + 1) % clean.length];
    return a + p.x * next.y - next.x * p.y;
  }, 0)) / 2;
  return clean.length >= 3 && area >= 100 ? clean : null;
}

export function normalizeShelfLines(lines: ShelfLine[] | null | undefined): ShelfLine[] {
  return (lines ?? []).filter((l) =>
    [l.start.x, l.start.y, l.end.x, l.end.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1000) &&
    Math.abs(l.end.x - l.start.x) >= 20 && Math.abs(l.end.y - l.start.y) <= Math.abs(l.end.x - l.start.x) * 0.5,
  ).sort((a, b) => (a.start.y + a.end.y) - (b.start.y + b.end.y))
    .filter((l, i, all) => i === 0 || Math.abs((l.start.y + l.end.y - all[i - 1].start.y - all[i - 1].end.y) / 2) > 10);
}

export function shelfTierCount(name: string, lines: ShelfLine[] | null | undefined, complete: boolean | null | undefined, confidence: number | null | undefined): number | null {
  if (!/책장/.test(name) || complete !== true || confidence == null || !Number.isFinite(confidence) || confidence < 0.8 || confidence > 1 || lines == null) return null;
  return normalizeShelfLines(lines).length + 1;
}

export function scanDisplayLabel(item: { name: string; confidence: number | null; shelf_count?: number | null; shelf_confidence?: number | null }): string {
  const hasTiers = /책장/.test(item.name) && Number.isInteger(item.shelf_count) && (item.shelf_count ?? 0) > 0;
  const name = hasTiers ? `${item.shelf_count}단 ${item.name.replace(/^\d+\s*단\s*/, "")}` : item.name;
  const confidence = hasTiers && item.confidence != null && item.shelf_confidence != null ? Math.min(item.confidence, item.shelf_confidence) : item.confidence;
  return `${name} ${confidence == null ? "신뢰도 없음" : `${Math.round(confidence * 100)}%`}`;
}

/** Exact pixel crop bounds shared by JPEG cropping and crop-to-photo coordinate mapping. */
export function scanCropBounds(box: ScanBox, width: number, height: number): ScanBox {
  const x = Math.max(0, Math.min(width - 1, Math.floor((box.x - box.w * 0.15) / 1000 * width)));
  const y = Math.max(0, Math.min(height - 1, Math.floor((box.y - box.h * 0.15) / 1000 * height)));
  const right = Math.max(x + 1, Math.min(width, Math.ceil((box.x + box.w * 1.15) / 1000 * width)));
  const bottom = Math.max(y + 1, Math.min(height, Math.ceil((box.y + box.h * 1.15) / 1000 * height)));
  return { x, y, w: right - x, h: bottom - y };
}

export function mapCropPoint(p: ScanPoint, crop: ScanBox, width: number, height: number): ScanPoint {
  return { x: (crop.x + p.x / 1000 * crop.w) / width * 1000, y: (crop.y + p.y / 1000 * crop.h) / height * 1000 };
}