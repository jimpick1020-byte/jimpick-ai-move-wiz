// 실시간 물건 윤곽 카메라: 휴대폰 안에서만 인식(크레딧 없음). 촬영은 사용자가 버튼을 눌렀을 때만.
import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const DET_MODEL = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";
const SEG_MODEL = "https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite";

const KO: Record<string, string> = {
  bed: "침대", couch: "소파", chair: "의자", "dining table": "식탁", tv: "TV", refrigerator: "냉장고",
  oven: "오븐", microwave: "전자레인지", sink: "싱크대", toilet: "변기", laptop: "노트북", "potted plant": "화분",
  clock: "시계", vase: "꽃병", suitcase: "여행가방", bicycle: "자전거", book: "책", bench: "벤치",
  toaster: "토스터", keyboard: "키보드", bottle: "병", backpack: "가방", "teddy bear": "인형", bowl: "그릇",
};
const IGNORE = new Set(["person", "cat", "dog", "cell phone", "remote", "mouse", "cup", "fork", "knife", "spoon"]);

type Pt = { x: number; y: number };
interface Live { label: string; score: number; contour: Pt[]; stable: boolean }

export function LiveObjectCamera({ room, onCapture, onClose, onFallback }: {
  room: string;
  onCapture: (file: File, name: string) => void;
  onClose: () => void;
  onFallback: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [status, setStatus] = useState("카메라 준비 중…");
  const [name, setName] = useState("");
  const [edited, setEdited] = useState(false);
  const liveRef = useRef<Live | null>(null);

  useEffect(() => {
    let stop = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    const history: { label: string; box: number[] }[] = [];
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
      } catch {
        if (!stop) onFallback();
        return;
      }
      setStatus("물건 인식 준비 중…");
      let detector: any, segmenter: any;
      try {
        const mp = await import("@mediapipe/tasks-vision");
        const fs = await mp.FilesetResolver.forVisionTasks(WASM);
        detector = await mp.ObjectDetector.createFromOptions(fs, { baseOptions: { modelAssetPath: DET_MODEL, delegate: "GPU" }, runningMode: "VIDEO", scoreThreshold: 0.4, maxResults: 5 });
        segmenter = await mp.InteractiveSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: SEG_MODEL }, outputCategoryMask: true, outputConfidenceMasks: false } as any);
      } catch {
        setStatus("실시간 인식을 불러오지 못했습니다. 촬영은 그대로 할 수 있어요.");
        return;
      }
      setStatus("");
      let last = 0;
      const loop = () => {
        if (stop) return;
        raf = requestAnimationFrame(loop);
        const v = videoRef.current;
        const now = performance.now();
        if (!v || v.readyState < 2 || now - last < 350) return;
        last = now;
        const vw = v.videoWidth, vh = v.videoHeight;
        const det = detector.detectForVideo(v, now);
        const best = (det.detections ?? [])
          .map((d: any) => ({ d, c: d.categories?.[0] }))
          .filter((x: any) => x.c && !IGNORE.has(x.c.categoryName))
          .sort((a: any, b: any) => b.d.boundingBox.width * b.d.boundingBox.height - a.d.boundingBox.width * a.d.boundingBox.height)[0];
        if (!best) { history.length = 0; update(null); return; }
        const bb = best.d.boundingBox;
        const box = [bb.originX / vw, bb.originY / vh, (bb.originX + bb.width) / vw, (bb.originY + bb.height) / vh];
        const edge = box[0] < 0.02 || box[1] < 0.02 || box[2] > 0.98 || box[3] > 0.98;
        const label = KO[best.c.categoryName] ?? best.c.categoryName;
        let contour: Pt[] = [];
        try {
          const res = segmenter.segment(v, { keypoint: { x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2 } });
          const mask = res.categoryMask;
          if (mask) { contour = traceContour(mask.getAsUint8Array(), mask.width, mask.height); mask.close(); }
        } catch { /* 윤곽 실패 시 안정 아님 */ }
        history.push({ label, box });
        if (history.length > 3) history.shift();
        const stable = !edge && contour.length >= 8 && best.c.score >= 0.55 && history.length === 3 &&
          history.every((h) => h.label === label && iou(h.box, box) > 0.6);
        update({ label, score: best.c.score, contour, stable });
      };
      loop();
    })();
    const update = (l: Live | null) => {
      liveRef.current = l;
      setLive(l);
      draw(l);
    };
    const draw = (l: Live | null) => {
      const c = canvasRef.current, v = videoRef.current;
      if (!c || !v) return;
      const rect = c.getBoundingClientRect();
      c.width = rect.width; c.height = rect.height;
      const g = c.getContext("2d")!;
      g.clearRect(0, 0, c.width, c.height);
      if (!l || l.contour.length < 3) return;
      // object-cover 좌표 변환
      const s = Math.max(rect.width / v.videoWidth, rect.height / v.videoHeight);
      const ox = (rect.width - v.videoWidth * s) / 2, oy = (rect.height - v.videoHeight * s) / 2;
      g.beginPath();
      l.contour.forEach((p, i) => {
        const x = ox + p.x * v.videoWidth * s, y = oy + p.y * v.videoHeight * s;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.closePath();
      g.lineWidth = 4;
      g.strokeStyle = l.stable ? "rgb(34,197,94)" : "rgba(34,197,94,0.5)";
      g.fillStyle = "rgba(34,197,94,0.12)";
      g.fill(); g.stroke();
    };
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (live && !edited) setName(live.label); }, [live?.label, edited]);

  const lowConf = live && live.score < 0.7;
  const shoot = () => {
    const v = videoRef.current;
    if (!v || v.readyState < 2) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (b) onCapture(new File([b], `live-${Date.now()}.jpg`, { type: "image/jpeg" }), name.trim());
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-[16px] font-black">{room} 촬영</span>
        <button onClick={onClose} aria-label="닫기"><X className="h-7 w-7" /></button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        {live?.stable && (
          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-[rgb(34,197,94)] px-3 py-1 text-[14px] font-black text-white">
            {name || live.label} {Math.round(live.score * 100)}%
          </div>
        )}
        {(status || !live?.stable) && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-4 py-2 text-[14px] font-bold text-white">
            {status || "물건 전체가 보이게 조정해 주세요"}
          </div>
        )}
      </div>
      <div className="space-y-3 bg-black px-4 py-4">
        {live && (
          <label className="flex items-center gap-2 text-white">
            <span className="shrink-0 text-[13px] font-bold">{lowConf ? "품목명 확인" : "품목명"}</span>
            <input value={name} onChange={(e) => { setName(e.target.value); setEdited(true); }}
              className="flex-1 rounded-lg bg-white/15 px-3 py-2 text-[15px] font-bold text-white outline-none" aria-label="품목명 수정" />
          </label>
        )}
        <div className="flex items-center justify-center">
          <button onClick={shoot} aria-label="촬영"
            className={`flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 ${live?.stable ? "border-[rgb(34,197,94)] bg-white" : "border-white/40 bg-white/40"}`}>
            <Camera className="h-8 w-8 text-black" />
          </button>
        </div>
      </div>
    </div>
  );
}

function iou(a: number[], b: number[]) {
  const x = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const y = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const i = x * y, u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i;
  return u > 0 ? i / u : 0;
}

/** 마스크(물건=0 또는 1) 중심에서 48방향으로 가장 먼 경계점을 찾아 윤곽선을 만듭니다. */
export function traceContour(m: Uint8Array, w: number, h: number): Pt[] {
  let sx = 0, sy = 0, n = 0;
  // magic_touch 마스크: 선택 영역 값이 0이 아닌 쪽이 적은 쪽을 물건으로 봄
  let ones = 0;
  for (let i = 0; i < m.length; i++) if (m[i]) ones++;
  const fg = ones <= m.length / 2 ? 1 : 0;
  const isFg = (x: number, y: number) => (m[y * w + x] ? 1 : 0) === fg;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (isFg(x, y)) { sx += x; sy += y; n++; }
  if (n < 50) return [];
  const cx = sx / n, cy = sy / n, R = Math.hypot(w, h);
  const pts: Pt[] = [];
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    let far = -1;
    for (let r = 0; r < R; r += 2) {
      const x = Math.round(cx + dx * r), y = Math.round(cy + dy * r);
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      if (isFg(x, y)) far = r;
    }
    if (far > 0) pts.push({ x: (cx + dx * far) / w, y: (cy + dy * far) / h });
  }
  return pts;
}
