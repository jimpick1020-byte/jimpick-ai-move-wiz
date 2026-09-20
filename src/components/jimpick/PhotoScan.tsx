/**
 * AI 품목 인식 화면 — 실제 카메라 + 실제 AI 분석.
 *
 *  ① 공간을 한 번 고르고 촬영합니다.
 *  ② 촬영한 사진을 AI가 두 번 봅니다 (빠른 1차 → 정밀 2차: 놓친 물건 다시 찾기).
 *  ③ 물체마다 실제 외곽 모양을 따라 얇은 윤곽선을 그립니다 (AI 마스크 사용).
 *  ④ 기존 품목과 자동 연결하고, 목록에 없는 품목은 자동 등록 + 3D 아이콘을 뒤에서 만듭니다.
 *
 * 가짜 인식 결과는 만들지 않습니다. AI가 못 찾으면 못 찾았다고 알려 줍니다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Camera, RefreshCw, Loader2, Check, X } from "lucide-react";
import { useApp } from "@/lib/jimpick";
import { registerCustomIcons } from "@/lib/jimpick-icon3d";
import { segmentPhotoItems, type SegmentedObject } from "@/lib/ai-vision.functions";
import { generateItemIcon } from "@/lib/item-icon.functions";
import { matchCatalogItem, guessCategory, normalizeLabel } from "@/lib/item-aliases";
import { itemGroup } from "@/lib/item-groups";
import { segmentImage } from "@/lib/segmentation/segmenter";
import type { SegRunResult } from "@/lib/segmentation/types";

interface ScanObject extends SegmentedObject {
  /** 연결된 기존 품목 id (없으면 새로 만들어야 하는 품목) */
  matchId: string | null;
  /** 화면에 보여 줄 한글 이름 */
  name: string;
  cat: string;
  /** 추천 품목 그룹 (침대 / 옷장·장롱 / TV / 냉장고 …) */
  group: string;
  /** 목록에 없는 새 품목인지 */
  isNew: boolean;
  /** 사진에서 잘라낸 임시 이미지 */
  crop?: string;
  /** 제외한 품목 (윤곽선을 숨깁니다) */
  excluded: boolean;
  /** 이름을 확신하지 못한 품목 */
  needConfirm: boolean;
}

const STEP_TEXT = [
  "사진 확인 중",
  "가구·가전 찾는 중",
  "빠진 물건 다시 확인 중",
  "기존 품목과 연결 중",
  "품목 확인 완료",
];

/** 신뢰도별 윤곽선 색 */
function outlineColor(confidence: number): string {
  if (confidence >= 0.8) return "#1E6BFF";
  if (confidence >= 0.55) return "#F5C400";
  return "#9AA3AF";
}

/** 캔버스로 사진 크기를 줄입니다 (분석용) */
async function shrink(src: string, maxSide: number, quality = 0.85): Promise<string> {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

/** 물체 영역만 잘라 임시 이미지를 만듭니다 */
async function cropObject(src: string, box: SegmentedObject["box"], size = 256): Promise<string> {
  const img = await loadImage(src);
  const pad = 0.04;
  const x0 = Math.max(0, (box.x0 - pad)) * img.width;
  const y0 = Math.max(0, (box.y0 - pad)) * img.height;
  const x1 = Math.min(1, box.x1 + pad) * img.width;
  const y1 = Math.min(1, box.y1 + pad) * img.height;
  const w = Math.max(8, x1 - x0);
  const h = Math.max(8, y1 - y0);
  const scale = Math.min(1, size / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, x0, y0, w, h, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** 두 상자가 얼마나 겹치는지 (중복 물체 합치기) */
function iou(a: SegmentedObject["box"], b: SegmentedObject["box"]): number {
  const x0 = Math.max(a.x0, b.x0);
  const y0 = Math.max(a.y0, b.y0);
  const x1 = Math.min(a.x1, b.x1);
  const y1 = Math.min(a.y1, b.y1);
  if (x1 <= x0 || y1 <= y0) return 0;
  const inter = (x1 - x0) * (y1 - y0);
  const areaA = (a.x1 - a.x0) * (a.y1 - a.y0);
  const areaB = (b.x1 - b.x0) * (b.y1 - b.y0);
  return inter / (areaA + areaB - inter);
}

/**
 * 물체 외곽선 그리기.
 *  - 분할 모델이 준 실제 외곽선(polygon)이 있으면 그 모양을 따라 얇게 그립니다.
 *  - 외곽선이 없으면 임시로 네모 상자를 그리고 "정밀 외곽선 처리 중" 으로 표시합니다.
 */
function drawOutlines(canvas: HTMLCanvasElement, objects: ScanObject[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  for (const o of objects) {
    if (o.excluded) continue;
    const color = outlineColor(o.confidence);
    const bx = o.box.x0 * W;
    const by = o.box.y0 * H;
    const bw = (o.box.x1 - o.box.x0) * W;
    const bh = (o.box.y1 - o.box.y0) * H;
    const poly = o.polygon ?? [];

    if (poly.length >= 6) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(poly[0].x * W, poly[0].y * H);
      for (const p of poly.slice(1)) ctx.lineTo(p.x * W, p.y * H);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      const r = Math.min(10, bw / 6, bh / 6);
      ctx.moveTo(bx + r, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
      ctx.arcTo(bx, by + bh, bx, by, r);
      ctx.arcTo(bx, by, bx + bw, by, r);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 작은 한글 라벨 (외곽선이 없으면 처리 중임을 밝힙니다)
    const shape = poly.length >= 6 ? "" : " · 정밀 외곽선 처리 중";
    const label = `${o.needConfirm ? `${o.name} 추정` : o.name} ${Math.round(o.confidence * 100)}%${shape}`;
    ctx.font = "600 13px system-ui, -apple-system, sans-serif";
    const tw = ctx.measureText(label).width + 14;
    const ly = Math.max(0, by - 22);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(bx, ly, tw, 20, 10);
    ctx.fill();
    ctx.fillStyle = o.confidence >= 0.55 && o.confidence < 0.8 ? "#1B2430" : "#FFFFFF";
    ctx.fillText(label, bx + 7, ly + 14);
  }
}

export function PhotoScan({ onClose }: { onClose: () => void }) {
  const { draft, updateDraft, currentRoomId, setCurrentRoom } = useApp();
  const rooms = draft.rooms;
  const [roomId, setRoomId] = useState(() => currentRoomId || rooms[0]?.id || "");
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0];

  const [phase, setPhase] = useState<"camera" | "analyzing" | "result">("camera");
  const [stepIndex, setStepIndex] = useState(0);
  const [cameraError, setCameraError] = useState("");
  const [shot, setShot] = useState<string>("");
  const [objects, setObjects] = useState<ScanObject[]>([]);
  const [applying, setApplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pendingIcons, setPendingIcons] = useState<string[]>([]);
  /** 기기 안 분할 모델 상태 — 모델 파일이 없으면 여기서 그대로 알려 드립니다 */
  const [seg, setSeg] = useState<SegRunResult | null>(null);
  const [refining, setRefining] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const photoRef = useRef<HTMLImageElement | null>(null);
  const appliedRef = useRef(false);

  /** 후면 카메라 우선 */
  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setCameraError("카메라를 열 수 없습니다. 아래에서 사진을 불러와 주세요.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (phase === "camera") void startCamera();
    else stopCamera();
    return stopCamera;
  }, [phase, startCamera, stopCamera]);

  /**
   * 촬영 완료 후 원본 사진으로 실제 외곽선을 다시 계산합니다 (기기 안 분할 모델, Web Worker).
   * 모델 파일이 없으면 네모 상자 표시를 그대로 유지합니다.
   */
  const refineOutlines = useCallback(async (full: string, count: number) => {
    if (count === 0) return;
    setRefining(true);
    try {
      const result = await segmentImage(full, { cacheKey: `${full.length}:${full.slice(-96)}` });
      setSeg(result);
      if (result.status !== "ready" || result.instances.length === 0) return;
      setObjects((prev) =>
        prev.map((o) => {
          let best: { polygon: { x: number; y: number }[]; score: number } | null = null;
          for (const inst of result.instances) {
            if (inst.polygon.length < 6) continue;
            const score = iou(o.box, inst.box);
            if (score > 0.35 && (!best || score > best.score))
              best = { polygon: inst.polygon, score };
          }
          return best ? { ...o, polygon: best.polygon } : o;
        }),
      );
    } finally {
      setRefining(false);
    }
  }, []);

  /** 사진 한 장을 실제로 분석합니다 (1차 빠른 → 2차 정밀) */
  const analyze = useCallback(async (full: string) => {
    setPhase("analyzing");
    setStepIndex(0);
    setObjects([]);
    try {
      const quick = await shrink(full, 768, 0.8);
      setStepIndex(1);
      const first = await segmentPhotoItems({ data: { image: quick } });
      const found = [...first.objects];
      setStepIndex(2);

      // 2차 정밀 — 고화질 원본으로 놓친 물건을 다시 찾습니다
      try {
        const fineImage = await shrink(full, 1280, 0.9);
        const second = await segmentPhotoItems({
          data: { image: fineImage, fine: true, known: found.map((o) => o.label).slice(0, 40) },
        });
        for (const o of second.objects) {
          const dup = found.find(
            (f) => iou(f.box, o.box) > 0.5 || (normalizeLabel(f.label) === normalizeLabel(o.label) && iou(f.box, o.box) > 0.25),
          );
          if (dup) {
            if (o.confidence > dup.confidence) {
              dup.confidence = o.confidence;
              if (o.mask) dup.mask = o.mask;
            }
            continue;
          }
          found.push(o);
        }
      } catch {
        /* 정밀 분석이 안 되면 1차 결과로 진행합니다 */
      }

      if (found.length === 0) {
        setPhase("result");
        toast.error(first.error || "사진에서 가구·가전을 찾지 못했습니다.");
        return;
      }

      setStepIndex(3);
      const custom = (draft.customItems ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        cat: c.cat,
        active: c.active,
      }));
      const mapped: ScanObject[] = [];
      for (const o of found) {
        const match = matchCatalogItem(o.label, custom) ?? matchCatalogItem(o.rawLabel, custom);
        const crop = await cropObject(full, o.box).catch(() => undefined);
        mapped.push({
          ...o,
          matchId: match?.id ?? null,
          name: match?.name ?? o.label,
          cat: match?.cat ?? guessCategory(o.label),
          group: itemGroup(match?.name ?? o.label, match?.cat).label,
          isNew: !match,
          crop,
          excluded: false,
          needConfirm: o.confidence < 0.55 || (!match && o.confidence < 0.8),
        });
      }
      setObjects(mapped);
      setStepIndex(4);
      setPhase("result");
      void refineOutlines(full, mapped.length);
    } catch {
      setPhase("result");
      toast.error("사진을 분석하지 못했습니다. 다시 촬영해 주세요.");
    }
  }, [draft.customItems, refineOutlines]);

  /** 촬영 */
  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error("카메라가 아직 준비되지 않았습니다.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const full = canvas.toDataURL("image/jpeg", 0.92);
    setShot(full);
    appliedRef.current = false;
    await analyze(full);
  }, [analyze]);

  /** 사진 불러오기 (카메라를 못 쓰는 기기) */
  const pickFile = useCallback(
    async (file: File) => {
      const reader = new FileReader();
      const data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      setShot(data);
      appliedRef.current = false;
      await analyze(data);
    },
    [analyze],
  );

  const active = useMemo(() => objects.filter((o) => !o.excluded), [objects]);
  const kinds = useMemo(() => new Set(active.map((o) => o.matchId ?? normalizeLabel(o.name))).size, [active]);

  // 윤곽선 다시 그리기
  useEffect(() => {
    if (phase !== "result" || !shot) return;
    const img = photoRef.current;
    const canvas = overlayRef.current;
    if (!img || !canvas) return;
    const paint = () => {
      const w = img.clientWidth;
      const h = img.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      drawOutlines(canvas, objects);
    };
    if (img.complete) paint();
    else img.onload = paint;
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [phase, shot, objects]);

  /** 인식된 품목 담기 — 기존 품목은 바로, 없는 품목은 자동 등록 + 3D는 뒤에서 */
  const apply = async () => {
    if (appliedRef.current || !room) return;
    if (active.length === 0) {
      toast.error("담을 품목이 없습니다.");
      return;
    }
    appliedRef.current = true;
    setApplying(true);
    try {
      // ① 기존 품목 연결 — 같은 품목은 개수로 합칩니다
      const counts = new Map<string, number>();
      for (const o of active) if (o.matchId) counts.set(o.matchId, (counts.get(o.matchId) ?? 0) + 1);
      if (counts.size > 0) {
        const nextRooms = rooms.map((r) =>
          r.id === room.id
            ? {
                ...r,
                items: (() => {
                  const items = { ...r.items };
                  for (const [id, qty] of counts) items[id] = (items[id] ?? 0) + qty;
                  return items;
                })(),
              }
            : r,
        );
        updateDraft({ rooms: nextRooms });
      }
      setCurrentRoom(room.id);
      const unknown = active.filter((o) => !o.matchId);
      toast.success(
        `「${room.name}」에 ${kinds}종 · ${active.length}개를 담았습니다${
          unknown.length ? ` (새 품목 ${unknown.length}개는 3D 이미지를 만들고 있습니다)` : ""
        }`,
      );

      // ② 목록에 없는 품목 — 사진에서 잘라낸 이미지로 3D 아이콘을 뒤에서 만듭니다
      const seen = new Set<string>();
      for (const o of unknown) {
        const key = normalizeLabel(o.name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        setPendingIcons((p) => [...p, o.name]);
        void generateItemIcon({
          data: { name: o.name.slice(0, 24), cat: o.cat, room: room.name, photo: o.crop },
        })
          .then((res) => {
            setPendingIcons((p) => p.filter((n) => n !== o.name));
            if (!res.ok || !res.itemId) {
              toast.error(`${o.name} 3D 이미지 생성 실패 — 품목은 그대로 담겨 있습니다.`);
              return;
            }
            registerCustomIcons([{ id: res.itemId, icon: res.iconUrl ?? o.crop ?? "" }]);
            toast.success(`${res.name ?? o.name} 3D 이미지 완성`);
          })
          .catch(() => {
            setPendingIcons((p) => p.filter((n) => n !== o.name));
          });
      }
      onClose();
    } finally {
      setApplying(false);
    }
  };

  const toggleExclude = (trackingId: string) =>
    setObjects((prev) =>
      prev.map((o) => (o.trackingId === trackingId ? { ...o, excluded: !o.excluded } : o)),
    );

  const confirmName = (trackingId: string) =>
    setObjects((prev) =>
      prev.map((o) => (o.trackingId === trackingId ? { ...o, needConfirm: false } : o)),
    );

  return (
    <div className="min-h-dvh bg-background">
      {/* 상단 */}
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b bg-card px-3 py-3">
        <button aria-label="뒤로" onClick={onClose} className="rounded-full p-1 text-foreground">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex-1 text-center text-lg font-bold">AI 품목 인식</div>
        <div className="w-8" />
      </div>

      {/* 공간 선택 */}
      <div className="border-b bg-card px-3 pb-3">
        <div className="mb-2 text-center">
          <span className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground">
            현재 공간: {room?.name ?? "미정"}
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => setRoomId(r.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                r.id === roomId
                  ? "border-primary bg-primary/10 font-semibold text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      {/* 카메라 */}
      {phase === "camera" && (
        <div className="p-3">
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} playsInline muted className="h-[58dvh] w-full object-cover" />
          </div>
          {cameraError && <p className="mt-2 text-center text-sm text-destructive">{cameraError}</p>}
          <p className="mt-3 text-center text-sm text-muted-foreground">
            방 전체가 보이도록 찍으면 가구·가전을 자동으로 찾아 「{room?.name}」에 담아 드립니다.
          </p>
          <button
            onClick={() => void capture()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-lg font-bold text-primary-foreground"
          >
            <Camera className="h-5 w-5" /> 촬영하기
          </button>
          <label className="mt-2 block text-center text-sm font-semibold text-primary">
            사진 불러오기
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickFile(f);
              }}
            />
          </label>
        </div>
      )}

      {/* 분석 중 */}
      {phase === "analyzing" && (
        <div className="p-4">
          {shot && <img src={shot} alt="촬영한 사진" className="w-full rounded-2xl" />}
          <div className="mt-4 space-y-2">
            {STEP_TEXT.map((t, i) => (
              <div
                key={t}
                className={`flex items-center gap-2 text-sm ${
                  i <= stepIndex ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {i < stepIndex ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : i === stepIndex ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <span className="h-4 w-4" />
                )}
                {t}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 결과 */}
      {phase === "result" && (
        <div className="pb-28">
          {shot && (
            <div className="relative">
              <img ref={photoRef} src={shot} alt="촬영한 사진" className="w-full" />
              <canvas ref={overlayRef} className="pointer-events-none absolute left-0 top-0" />
            </div>
          )}

          <div className="-mt-4 rounded-t-3xl bg-card p-4 shadow-lg">
            {active.length > 0 ? (
              <h2 className="text-xl font-bold">
                {room?.name}에서 <span className="text-primary">{kinds}종 · {active.length}개</span>를 찾았습니다
              </h2>
            ) : (
              <h2 className="text-lg font-bold">담을 품목이 없습니다. 다시 촬영해 주세요.</h2>
            )}

            {refining && (
              <p className="mt-2 text-sm text-muted-foreground">
                원본 사진으로 정밀 외곽선을 계산하는 중입니다…
              </p>
            )}
            {!refining && seg && seg.status !== "ready" && (
              <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                {seg.message} 지금은 물체 위치를 네모 상자로만 표시합니다.
              </p>
            )}
            {!refining && seg?.status === "ready" && (
              <p className="mt-2 text-sm text-muted-foreground">
                실제 외곽선 계산 완료 ({seg.backend === "webgpu" ? "WebGPU" : "WASM"} ·{" "}
                {seg.elapsedMs}ms)
              </p>
            )}

            <div className="mt-3 grid grid-cols-4 gap-2">
              {objects.map((o) => (
                <div
                  key={o.trackingId}
                  className={`rounded-xl border p-2 text-center ${
                    o.excluded ? "border-dashed opacity-40" : "border-border"
                  }`}
                >
                  {o.crop && <img src={o.crop} alt={o.name} className="mx-auto h-12 w-12 rounded object-contain" />}
                  <div className="mt-1 truncate text-xs font-semibold">{o.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {o.group}
                    {o.isNew ? " · 새 품목" : ""}
                  </div>
                  <div className="text-xs text-primary">
                    {o.needConfirm ? "확인 필요" : `${Math.round(o.confidence * 100)}%`}
                  </div>
                  {editing && (
                    <div className="mt-1 flex justify-center gap-1">
                      <button
                        aria-label="맞아요"
                        onClick={() => confirmName(o.trackingId)}
                        className="rounded bg-primary/10 p-1 text-primary"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        aria-label="제외"
                        onClick={() => toggleExclude(o.trackingId)}
                        className="rounded bg-muted p-1 text-muted-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {pendingIcons.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                3D 이미지 만드는 중: {pendingIcons.join(", ")} — 기다리지 않고 계속 작업할 수 있습니다.
              </p>
            )}

            <button
              disabled={applying || active.length === 0}
              onClick={() => void apply()}
              className="mt-4 w-full rounded-2xl bg-primary py-4 text-lg font-bold text-primary-foreground disabled:opacity-50"
            >
              {applying ? "담는 중…" : "인식된 품목 담기"}
            </button>
            <div className="mt-2 flex justify-center gap-4 text-sm font-semibold text-primary">
              <button onClick={() => setEditing((v) => !v)}>
                {editing ? "수정 끝내기" : "잘못된 품목만 수정"}
              </button>
              <button
                onClick={() => {
                  setObjects([]);
                  setShot("");
                  setPhase("camera");
                }}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-4 w-4" /> 다시 촬영
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
