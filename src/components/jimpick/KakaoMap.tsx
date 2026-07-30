import { useEffect, useRef, useState } from "react";
import { getKakaoJsKey } from "@/lib/kakao.functions";

declare global {
  interface Window {
    kakao: any;
  }
}

let loadPromise: Promise<boolean> | null = null;

/** SDK 스크립트를 동적 삽입하고 kakao.maps.load() 완료까지 대기 */
function loadKakaoSdk(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.kakao?.maps?.Map) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { key } = await getKakaoJsKey();
    if (!key) {
      console.error("[KakaoMap] JavaScript 키가 비어 있습니다. KAKAO_MAP_JS_KEY를 확인하세요.");
      throw new Error("missing kakao javascript key");
    }

    let script = document.querySelector<HTMLScriptElement>("script[data-kakao-sdk]");
    if (!script) {
      script = document.createElement("script");
      script.dataset.kakaoSdk = "1";
      script.async = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false`;
      const loaded = new Promise<void>((resolve, reject) => {
        script!.onload = () => resolve();
        script!.onerror = (e) => {
          console.error("[KakaoMap] SDK 스크립트 로드 실패", script!.src, e);
          reject(new Error("kakao sdk script load failed"));
        };
      });
      document.head.appendChild(script);
      await loaded;
    }

    for (let i = 0; i < 50 && !window.kakao?.maps; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!window.kakao?.maps) {
      console.error("[KakaoMap] window.kakao.maps 네임스페이스를 찾을 수 없습니다.");
      throw new Error("kakao namespace missing");
    }

    await new Promise<void>((resolve) => window.kakao.maps.load(() => resolve()));
    return true;
  })().catch((err) => {
    console.error("[KakaoMap] 지도 초기화 실패:", err);
    loadPromise = null;
    return false;
  });

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
  height = 320,
}: {
  from?: LatLng | null;
  to?: LatLng | null;
  path?: LatLng[] | null;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    loadKakaoSdk().then((ok) => {
      if (cancelled) return;
      setReady(ok);
      if (!ok || !ref.current) return;

      try {
        const kakao = window.kakao;
        const center = from ?? to ?? { x: 126.978, y: 37.5665 };

        // 지도 인스턴스는 kakao.maps.load() 콜백 이후 한 번만 생성
        if (!mapRef.current) {
          mapRef.current = new kakao.maps.Map(ref.current, {
            center: new kakao.maps.LatLng(center.y, center.x),
            level: 6,
          });
        }
        const map = mapRef.current;

        // 이전 마커/오버레이/경로 정리
        overlaysRef.current.forEach((o) => o.setMap(null));
        overlaysRef.current = [];

        const bounds = new kakao.maps.LatLngBounds();
        let hasPoint = false;

        const add = (p: LatLng, label: string, color: string) => {
          const pos = new kakao.maps.LatLng(p.y, p.x);
          const marker = new kakao.maps.Marker({ map, position: pos });
          const overlay = new kakao.maps.CustomOverlay({
            map,
            position: pos,
            yAnchor: 2.1,
            content: `<div style="background:${color};color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.2)">${label}</div>`,
          });
          overlaysRef.current.push(marker, overlay);
          bounds.extend(pos);
          hasPoint = true;
        };
        if (from) add(from, "출발", "#0751D8");
        if (to) add(to, "도착", "#EF4444");

        const line = path && path.length > 1 ? path : from && to ? [from, to] : null;
        if (line) {
          const latlngs = line.map((p) => new kakao.maps.LatLng(p.y, p.x));
          const poly = new kakao.maps.Polyline({
            map,
            path: latlngs,
            strokeWeight: 5,
            strokeColor: "#287BFF",
            strokeOpacity: 0.9,
            strokeStyle: path && path.length > 1 ? "solid" : "shortdash",
          });
          overlaysRef.current.push(poly);
          for (const ll of latlngs) bounds.extend(ll);
          hasPoint = true;
        }

        // 컨테이너 크기 확정 후 재계산 (0px 렌더 방지)
        requestAnimationFrame(() => {
          map.relayout();
          if (hasPoint && from && to) map.setBounds(bounds, 30, 30, 30, 30);
          else map.setCenter(new kakao.maps.LatLng(center.y, center.x));
        });
      } catch (err) {
        console.error("[KakaoMap] 지도 렌더링 오류:", err);
        setReady(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [from?.x, from?.y, to?.x, to?.y, path?.length, attempt]);

  return (
    <div className="relative w-full block" style={{ height, minHeight: height }}>
      <div
        ref={ref}
        className="w-full h-full block rounded-xl overflow-hidden border border-[#E7EBF2] bg-[#F5F7FB]"
        style={{ height, minHeight: height }}
      />
      {ready === null && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#EEF4FF] to-[#F5F7FB] animate-pulse flex items-center justify-center text-xs font-semibold text-[#6B7280]">
          지도를 불러오는 중입니다
        </div>
      )}
      {ready === false && (
        <div className="absolute inset-0 rounded-xl bg-[#F5F7FB] flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              setReady(null);
              setAttempt((a) => a + 1);
            }}
            className="rounded-full bg-[#0751D8] px-4 py-2 text-xs font-bold text-white shadow-sm"
          >
            지도 다시 불러오기
          </button>
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
