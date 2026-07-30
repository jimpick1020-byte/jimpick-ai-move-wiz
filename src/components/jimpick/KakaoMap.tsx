import { useEffect, useRef, useState } from "react";
import { getKakaoJsKey } from "@/lib/kakao.functions";

declare global {
  interface Window {
    kakao: any;
  }
}

let loadPromise: Promise<boolean> | null = null;

async function loadKakaoSdk(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.kakao?.maps) return true;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { key } = await getKakaoJsKey();
    if (!key) return false;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("kakao sdk load failed"));
      document.head.appendChild(s);
    });
    await new Promise<void>((resolve) => window.kakao.maps.load(() => resolve()));
    return true;
  })().catch(() => false);

  return loadPromise;
}

export interface LatLng {
  x: number;
  y: number;
}

/** 출발지·도착지와 실제 자동차 경로를 표시하는 카카오 지도 */
export function KakaoMap({
  from,
  to,
  path,
  height = 200,
}: {
  from?: LatLng | null;
  to?: LatLng | null;
  path?: LatLng[] | null;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await loadKakaoSdk();
      if (cancelled) return;
      setReady(ok);
      if (!ok || !ref.current) return;

      const kakao = window.kakao;
      const center = from ?? to ?? { x: 126.978, y: 37.5665 };
      const map = new kakao.maps.Map(ref.current, {
        center: new kakao.maps.LatLng(center.y, center.x),
        level: 6,
      });

      const bounds = new kakao.maps.LatLngBounds();
      const add = (p: LatLng, label: string, color: string) => {
        const pos = new kakao.maps.LatLng(p.y, p.x);
        new kakao.maps.Marker({ map, position: pos });
        new kakao.maps.CustomOverlay({
          map,
          position: pos,
          yAnchor: 2.1,
          content: `<div style="background:${color};color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.2)">${label}</div>`,
        });
        bounds.extend(pos);
      };
      if (from) add(from, "출발", "#0751D8");
      if (to) add(to, "도착", "#EF4444");

      const line = path && path.length > 1 ? path : from && to ? [from, to] : null;
      if (line) {
        const latlngs = line.map((p) => new kakao.maps.LatLng(p.y, p.x));
        new kakao.maps.Polyline({
          map,
          path: latlngs,
          strokeWeight: 5,
          strokeColor: "#287BFF",
          strokeOpacity: 0.9,
          strokeStyle: path && path.length > 1 ? "solid" : "shortdash",
        });
        for (const ll of latlngs) bounds.extend(ll);
        map.setBounds(bounds, 30, 30, 30, 30);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from?.x, from?.y, to?.x, to?.y, path?.length]);


  if (ready === false) {
    return (
      <div
        className="rounded-xl border border-[#FFD9A8] bg-[#FFF8EE] p-4 text-xs text-[#92400E] flex flex-col justify-center gap-1"
        style={{ minHeight: height }}
      >
        <div className="font-bold text-sm">지도를 표시할 수 없습니다</div>
        <div>카카오 지도 키가 없거나 도메인이 등록되지 않았습니다.</div>
        <div>
          카카오 개발자센터 &gt; 내 애플리케이션 &gt; 플랫폼 &gt; Web 사이트 도메인에{" "}
          <span className="font-semibold break-all">https://jimpick-ai-move-wiz.lovable.app</span> 을
          등록해 주세요.
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        className="rounded-xl overflow-hidden border border-[#E7EBF2]"
        style={{ height }}
      />
      {ready === null && (
        <div
          className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#EEF4FF] to-[#F5F7FB] animate-pulse flex items-center justify-center text-xs font-semibold text-[#6B7280]"
        >
          지도를 불러오는 중입니다
        </div>
      )}
      {ready && from && !to && (
        <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-white/95 border border-[#E7EBF2] px-3 py-2 text-[11px] font-semibold text-[#0751D8] text-center shadow-sm">
          도착지를 선택하면 이동 경로가 표시됩니다
        </div>
      )}
    </div>
  );
}

