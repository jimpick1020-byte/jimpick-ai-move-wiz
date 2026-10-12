// 실시간 물건 윤곽 카메라: 휴대폰 안에서만 인식(크레딧 없음). 촬영은 사용자가 버튼을 눌렀을 때만.
import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { loadVisionModels, traceContour, drawerTiers, fgAt, type Pt } from "@/lib/live-vision";

const KO: Record<string, string> = {
  bed: "침대", couch: "소파", chair: "의자", "dining table": "식탁", tv: "TV", refrigerator: "냉장고",
  oven: "오븐", microwave: "전자레인지", sink: "싱크대", toilet: "변기", laptop: "노트북", "potted plant": "화분",
  clock: "시계", vase: "꽃병", suitcase: "여행가방", bicycle: "자전거", book: "책", bench: "벤치",
  toaster: "토스터", keyboard: "키보드", bottle: "병", backpack: "가방", "teddy bear": "인형", bowl: "그릇",
};
const IGNORE = new Set(["person", "cat", "dog", "cell phone", "remote", "mouse", "cup", "fork", "knife", "spoon"]);

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
    const gctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
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
        ({ detector, segmenter } = await loadVisionModels());
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[LiveObjectCamera] 모델 초기화 실패:", e);
        setStatus(`실시간 인식을 불러오지 못했습니다: ${msg.slice(0, 120)}`);
        return;
      }
      if (stop) return;
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
        // 감지된 물건이 없으면 화면 가운데(사용자가 겨눈 곳)를 분석합니다.
        let box = [0.5, 0.5, 0.5, 0.5];
        if (best) { const bb = best.d.boundingBox; box = [bb.originX / vw, bb.originY / vh, (bb.originX + bb.width) / vw, (bb.originY + bb.height) / vh]; }
        const kp = { x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2 };
        let contour: Pt[] = [];
        let tiers: number | null = null;
        try {
          const res = segmenter.segment(v, { keypoint: kp });
          const mask = res.categoryMask;
          if (mask) {
            const mw = mask.width, mh = mask.height, md = mask.getAsUint8Array();
            const fg = fgAt(md, mw, mh, kp.x, kp.y);
            contour = traceContour(md, mw, mh, fg);
            if (!best || contour.length) {
              gctx.canvas.width = mw; gctx.canvas.height = mh;
              gctx.drawImage(v, 0, 0, mw, mh);
              const px = gctx.getImageData(0, 0, mw, mh).data, gray = new Uint8Array(mw * mh);
              for (let i = 0; i < gray.length; i++) gray[i] = (px[i * 4] * 3 + px[i * 4 + 1] * 6 + px[i * 4 + 2]) / 10;
              tiers = drawerTiers(gray, md, mw, mh, fg)?.tiers ?? null;
            }
            if (!best && contour.length) {
              const xs = contour.map((p) => p.x), ys = contour.map((p) => p.y);
              box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
            }
            mask.close();
          }
        } catch (e) { console.error("[LiveObjectCamera] 윤곽 분석 실패:", e); }
        const coco = best ? KO[best.c.categoryName] ?? best.c.categoryName : null;
        const label = tiers && tiers >= 2 && (!coco || coco === "식탁" || coco === "벤치") ? `${tiers}단 서랍장` : coco;
        if (!label || contour.length < 8) { history.length = 0; update(contour.length >= 8 ? { label: "", score: 0, contour, stable: false } : null); return; }
        const edge = box[0] < 0.02 || box[1] < 0.02 || box[2] > 0.98 || box[3] > 0.98;
        history.push({ label, box });
        if (history.length > 3) history.shift();
        const agree = history.length === 3 && history.every((h) => h.label === label && iou(h.box, box) > 0.6);
        // 서랍장 확신도: 3프레임 연속 같은 단수일 때만 표시(가짜 수치 없음)
        const score = best && coco === label ? best.c.score : agree ? 0.6 : 0.4;
        const stable = !edge && score >= 0.55 && agree;
        update({ label, score, contour, stable });
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

  useEffect(() => { if (live?.label && !edited) setName(live.label); }, [live?.label, edited]);

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
        {live?.label && (
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

