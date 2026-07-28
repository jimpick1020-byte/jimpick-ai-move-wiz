import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface KakaoPlace {
  address: string;
  roadAddress: string;
  name: string;
  x: number; // lng
  y: number; // lat
}

/** 카카오맵 JS SDK 로딩용 키 (브라우저에 노출되는 공개용 JavaScript 키) */
export const getKakaoJsKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.KAKAO_MAP_JS_KEY ?? "" };
});

/** 카카오 API 오류를 사용자에게 보여줄 문구로 변환 */
function kakaoErrorMessage(status: number, body: string): string {
  if (body.includes("disabled OPEN_MAP_AND_LOCAL")) {
    return "카카오 개발자 콘솔에서 [카카오맵] 서비스가 꺼져 있습니다. 내 애플리케이션 > 카카오맵 을 ON 으로 켜주세요.";
  }
  if (status === 401) return "카카오 REST API 키가 올바르지 않습니다. (REST API 키인지 확인해 주세요)";
  if (status === 403) return "카카오 API 사용 권한이 없습니다. 앱 설정에서 카카오맵/로컬 서비스를 활성화해 주세요.";
  if (status === 429) return "카카오 API 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.";
  return "주소 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

/** 주소·장소 검색 (카카오 로컬 API) */
export const searchAddress = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ query: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }): Promise<{ places: KakaoPlace[]; error?: string }> => {
    const key = process.env.KAKAO_REST_API_KEY;
    if (!key) return { places: [], error: "카카오 REST API 키가 설정되지 않았습니다." };

    const headers = { Authorization: `KakaoAK ${key}` };
    const q = encodeURIComponent(data.query);

    const [addrRes, kwRes] = await Promise.all([
      fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${q}&size=8`, { headers }),
      fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${q}&size=8`, { headers }),
    ]);

    const places: KakaoPlace[] = [];
    if (addrRes.ok) {
      const j = (await addrRes.json()) as { documents?: any[] };
      for (const d of j.documents ?? []) {
        places.push({
          address: d.address_name,
          roadAddress: d.road_address?.address_name ?? d.address_name,
          name: d.address_name,
          x: Number(d.x),
          y: Number(d.y),
        });
      }
    }
    if (kwRes.ok) {
      const j = (await kwRes.json()) as { documents?: any[] };
      for (const d of j.documents ?? []) {
        places.push({
          address: d.address_name,
          roadAddress: d.road_address_name || d.address_name,
          name: d.place_name,
          x: Number(d.x),
          y: Number(d.y),
        });
      }
    }
    if (!addrRes.ok && !kwRes.ok) {
      const body = await kwRes.text().catch(() => "");
      // 카카오 로컬 서비스가 꺼져 있어도 앱이 동작하도록 OSM 검색으로 대체합니다.
      const fallback = await searchOsm(data.query);
      if (fallback.length > 0) return { places: fallback };
      return { places: [], error: kakaoErrorMessage(kwRes.status, body) };
    }



    const seen = new Set<string>();
    return {
      places: places.filter((p) => {
        const k = `${p.name}|${p.address}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }),
    };
  });

/** 출발지 → 도착지 실제 자동차 경로 거리·시간 (카카오모빌리티) */
export const getRoute = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        originX: z.number(),
        originY: z.number(),
        destX: z.number(),
        destY: z.number(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ distanceKm: number; durationMin: number; error?: string }> => {
    const key = process.env.KAKAO_REST_API_KEY;
    if (!key) return { distanceKm: 0, durationMin: 0, error: "카카오 REST API 키가 없습니다." };

    const url =
      `https://apis-navi.kakaomobility.com/v1/directions?origin=${data.originX},${data.originY}` +
      `&destination=${data.destX},${data.destY}&priority=RECOMMEND&car_fuel=DIESEL`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return { distanceKm: 0, durationMin: 0, error: "경로 조회에 실패했습니다." };

    const j = (await res.json()) as { routes?: { summary?: { distance: number; duration: number } }[] };
    const s = j.routes?.[0]?.summary;
    if (!s) return { distanceKm: 0, durationMin: 0, error: "경로를 찾을 수 없습니다." };
    return {
      distanceKm: Math.round((s.distance / 1000) * 10) / 10,
      durationMin: Math.round(s.duration / 60),
    };
  });
