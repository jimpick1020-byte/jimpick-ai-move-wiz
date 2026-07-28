import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { kakaoErrorMessage, searchOsm, haversineKm, type KakaoPlace } from "./kakao.server";

export type { KakaoPlace };

/** 카카오맵 JS SDK 로딩용 키 (브라우저에 노출되는 공개용 JavaScript 키) */
export const getKakaoJsKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.KAKAO_MAP_JS_KEY ?? "" };
});

/** 주소·장소 검색 (카카오 로컬 API, 실패 시 OSM 대체) */
export const searchAddress = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ query: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }): Promise<{ places: KakaoPlace[]; error?: string }> => {
    const key = process.env.KAKAO_REST_API_KEY;
    if (!key) {
      const fallback = await searchOsm(data.query);
      if (fallback.length > 0) return { places: fallback };
      return { places: [], error: "카카오 REST API 키가 설정되지 않았습니다." };
    }

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
      // 카카오 로컬 서비스가 꺼져 있어도 앱이 동작하도록 대체 검색을 사용합니다.
      const fallback = await searchOsm(data.query);
      if (fallback.length > 0) return { places: fallback };
      return { places: [], error: kakaoErrorMessage(kwRes.status, body) };
    }

    const seen = new Set<string>();
    const unique = places.filter((p) => {
      const k = `${p.name}|${p.address}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (unique.length === 0) {
      const fallback = await searchOsm(data.query);
      if (fallback.length > 0) return { places: fallback };
    }
    return { places: unique };
  });

/** 출발지 → 도착지 실제 자동차 경로 거리·시간·경로선 (실패 시 직선거리 근사) */
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
  .handler(
    async ({
      data,
    }): Promise<{
      distanceKm: number;
      durationMin: number;
      path: { x: number; y: number }[];
      approx?: boolean;
      error?: string;
    }> => {
      const approx = () => {
        const straight = haversineKm(data.originX, data.originY, data.destX, data.destY);
        const km = Math.round(straight * 1.3 * 10) / 10;
        return {
          distanceKm: km,
          durationMin: Math.max(5, Math.round((km / 40) * 60)),
          path: [
            { x: data.originX, y: data.originY },
            { x: data.destX, y: data.destY },
          ],
          approx: true,
        };
      };

      const key = process.env.KAKAO_REST_API_KEY;
      if (!key) return approx();

      try {
        const url =
          `https://apis-navi.kakaomobility.com/v1/directions?origin=${data.originX},${data.originY}` +
          `&destination=${data.destX},${data.destY}&priority=RECOMMEND&car_fuel=DIESEL`;
        const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
        if (!res.ok) return approx();

        const j = (await res.json()) as {
          routes?: {
            result_code?: number;
            summary?: { distance: number; duration: number };
            sections?: { roads?: { vertexes?: number[] }[] }[];
          }[];
        };
        const route = j.routes?.[0];
        const s = route?.summary;
        if (!s || (route?.result_code ?? 0) !== 0) return approx();

        const path: { x: number; y: number }[] = [];
        for (const sec of route?.sections ?? []) {
          for (const road of sec.roads ?? []) {
            const v = road.vertexes ?? [];
            for (let i = 0; i + 1 < v.length; i += 2) path.push({ x: v[i], y: v[i + 1] });
          }
        }

        return {
          distanceKm: Math.round((s.distance / 1000) * 10) / 10,
          durationMin: Math.round(s.duration / 60),
          path: path.length > 1 ? path : [
            { x: data.originX, y: data.originY },
            { x: data.destX, y: data.destY },
          ],
        };
      } catch {
        return approx();
      }
    },
  );

