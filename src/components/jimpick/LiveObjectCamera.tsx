// 실시간 물건 윤곽 카메라: 휴대폰 안에서만 인식(크레딧 없음). 촬영은 사용자가 버튼을 눌렀을 때만.
// 큰 가구·가전만 분석하고, 윤곽선·안내 문구·촬영 결과는 같은 detection ID의 최신 결과 하나만 씁니다.
import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { loadVisionModels, traceContour, drawerTiers, fgAt, type Pt } from "@/lib/live-vision";
import { BIG_ITEMS, bigItemLabel, MIN_AREA, ANALYZE_MS, sameTrack, type Box } from "@/lib/live-track";

interface Live { id: number; label: string; choices: string[]; score: number; contour: Pt[]; stable: boolean; box: Box }

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
  // 사용자가 고른 이름은 그 detection ID에만 묶입니다(다른 물건으로 넘어가면 사라짐).
  const [chosen, setChosen] = useState<{ id: number; name: string } | null>(null);
  const liveRef = useRef<Live | null>(null);
  const sessionRef = useRef(0); // 촬영할 때마다 증가 → 이전 분석 결과 폐기
  const resetRef = useRef<() => void>(() => {});

  useEffect(() => {
    let stop = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    let nextId = 1;
    let reqId = 0;
    let track: { id: number; label: string; box: Box; contour: Pt[]; at: number; hits: number; tiers: number | null } | null = null;
    const gctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;

    const draw = (l: Live | null) => {
      const c = canvasRef.current, v = videoRef.current;
      if (!c || !v) return;
      const rect = c.getBoundingClientRect();
      c.width = rect.width; c.height = rect.height;
      const g = c.getContext("2d")!;
      g.clearRect(0, 0, c.width, c.height);
      if (!l || l.contour.length < 3) return;
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
    const update = (l: Live | null) => { liveRef.current = l; setLive(l); draw(l); };
    resetRef.current = () => { track = null; update(null); };

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      const tick = () => {
        if (stop) return;
        const v = videoRef.current;
        if (!v || v.readyState < 2) return;
        const my = ++reqId, session = sessionRef.current;
        const vw = v.videoWidth, vh = v.videoHeight, now = performance.now();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dets = (detector.detectForVideo(v, now).detections ?? []) as any[];
        // 1) 큰 가구·가전 후보만, 2) 화면 면적 기준 이하인 후보는 윤곽 분석 전에 버립니다.
        const cands = dets
          .map((d) => {
            const c = d.categories?.[0], bb = d.boundingBox;
            const box: Box = [bb.originX / vw, bb.originY / vh, (bb.originX + bb.width) / vw, (bb.originY + bb.height) / vh];
            return { cls: c?.categoryName as string, score: (c?.score ?? 0) as number, box, area: (box[2] - box[0]) * (box[3] - box[1]) };
          })
          .filter((x) => x.cls && BIG_ITEMS.has(x.cls) && x.area >= MIN_AREA)
          .sort((a, b) => b.area - a.area);
        const best = cands[0];
        // 감지 후보가 없으면 화면 가운데(사용자가 겨눈 큰 물건, 예: 서랍장)를 분석합니다.
        const box: Box = best ? best.box : [0.5, 0.5, 0.5, 0.5];
        const kp = { x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2 };
        const cls = best?.cls ?? "_center";
        const same = !!track && sameTrack(track.label, track.box, cls, box);
        let contour: Pt[] = [];
        let tiers: number | null = null;
        // 같은 물건이고 거의 안 움직였으면 이전 윤곽을 재사용합니다.
        if (same && track && best && now - track.at < 1500 && sameTrack(track.label, track.box, cls, box, 0.9)) {
          contour = track.contour; tiers = track.tiers;
        } else {
          try {
            const res = segmenter.segment(v, { keypoint: kp });
            const mask = res.categoryMask;
            if (mask) {
              const mw = mask.width, mh = mask.height, md = mask.getAsUint8Array();
              const fg = fgAt(md, mw, mh, kp.x, kp.y);
              contour = traceContour(md, mw, mh, fg);
              if (contour.length) {
                gctx.canvas.width = mw; gctx.canvas.height = mh;
                gctx.drawImage(v, 0, 0, mw, mh);
                const px = gctx.getImageData(0, 0, mw, mh).data, gray = new Uint8Array(mw * mh);
                for (let i = 0; i < gray.length; i++) gray[i] = (px[i * 4] * 3 + px[i * 4 + 1] * 6 + px[i * 4 + 2]) / 10;
                tiers = drawerTiers(gray, md, mw, mh, fg)?.tiers ?? null;
              }
              mask.close();
            }
          } catch (e) { console.error("[LiveObjectCamera] 윤곽 분석 실패:", e); }
        }
        // 늦게 끝난 분석(새 촬영 세션 또는 더 새로운 요청 이후)은 버립니다.
        if (stop || my !== reqId || session !== sessionRef.current) return;
        let cbox = box;
        if (contour.length) {
          const xs = contour.map((p) => p.x), ys = contour.map((p) => p.y);
          cbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
        }
        // 가운데 분석인데 윤곽이 작으면(소품) 제외
        if (!best && (cbox[2] - cbox[0]) * (cbox[3] - cbox[1]) < MIN_AREA) contour = [];
        if (contour.length < 8) { track = null; update(null); return; }
        const id = same && track ? track.id : nextId++;
        const hits = same && track ? track.hits + 1 : 1;
        track = { id, label: cls, box, contour, at: now, hits, tiers };
        const named = bigItemLabel(cls, best?.score ?? 0, tiers);
        const edge = cbox[0] < 0.02 || cbox[1] < 0.02 || cbox[2] > 0.98 || cbox[3] > 0.98;
        const stable = !edge && hits >= 3 && !!named.label;
        update({ id, label: named.label, choices: named.choices, score: named.score, contour, stable, box });
      };
      timer = window.setInterval(tick, ANALYZE_MS);
    })();
    return () => {
      stop = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = live ? (chosen?.id === live.id ? chosen.name : live.label) : "";
  const needsPick = !!live && !name;

  const shoot = () => {
    const v = videoRef.current;
    if (!v || v.readyState < 2) return;
    // 누른 순간의 같은 detection 결과 하나만 사용
    const snapName = name;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    // 새 촬영 세션: 이전 라벨·선택·신뢰도 초기화, 진행 중 분석 폐기
    sessionRef.current++;
    setChosen(null);
    resetRef.current();
    c.toBlob((b) => {
      if (b) onCapture(new File([b], `live-${Date.now()}.jpg`, { type: "image/jpeg" }), snapName);
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
        {live && (
          <div className={`absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[14px] font-black text-white ${name ? "bg-[rgb(34,197,94)]" : "bg-[#D97706]"}`}>
            {name ? `${name}${live.score && chosen?.id !== live.id ? ` ${Math.round(live.score * 100)}%` : ""}` : "품목 확인 필요"}
          </div>
        )}
        {(status || !live?.stable) && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-4 py-2 text-[14px] font-bold text-white">
            {status || "물건 전체가 보이게 조정해 주세요"}
          </div>
        )}
      </div>
      <div className="space-y-3 bg-black px-4 py-4">
        {live && (needsPick || live.choices.length > 1) && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {(live.choices.length ? live.choices : [...BIG_LIST]).map((n) => (
              <button key={n} onClick={() => setChosen({ id: live.id, name: n })}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold ${name === n ? "bg-[rgb(34,197,94)] text-white" : "bg-white/15 text-white"}`}>{n}</button>
            ))}
          </div>
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

const BIG_LIST = ["침대", "책상", "식탁", "소파", "책장", "서랍장", "장롱", "화장대", "거실장", "냉장고", "김치냉장고", "세탁기", "건조기", "스타일러", "TV", "에어컨", "정수기", "전자레인지", "식기세척기", "안마의자", "디지털피아노"];
