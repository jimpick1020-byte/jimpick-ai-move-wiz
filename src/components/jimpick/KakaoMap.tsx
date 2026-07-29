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
        className="rounded-xl bg-gradient-to-br from-[#DDE9FF] to-[#EEF4FF] flex items-center justify-center text-xs text-[#6B7280] text-center px-4"
        style={{ height }}
      >
        카카오 지도를 불러오지 못했습니다. 카카오 개발자센터에서 현재 도메인이 등록되어 있는지 확인해 주세요.
      </div>
    );
  }


  return (
    <div
      ref={ref}
      className="rounded-xl overflow-hidden border border-[#E7EBF2]"
      style={{ height }}
    />
  );
}
