export interface KakaoPlace {
  address: string;
  roadAddress: string;
  name: string;
  x: number; // lng
  y: number; // lat
}

/** 카카오 API 오류를 사용자에게 보여줄 문구로 변환 */
export function kakaoErrorMessage(status: number, body: string): string {
  if (body.includes("disabled OPEN_MAP_AND_LOCAL")) {
    return "카카오 개발자 콘솔에서 [카카오맵] 서비스가 꺼져 있습니다. 내 애플리케이션 > 카카오맵을 ON으로 켜주세요.";
  }
  if (status === 401) return "카카오 REST API 키가 올바르지 않습니다. (REST API 키인지 확인해 주세요)";
  if (status === 403) return "카카오 API 사용 권한이 없습니다. 앱 설정에서 카카오맵/로컬 서비스를 활성화해 주세요.";
  if (status === 429) return "카카오 API 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.";
  return "주소 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

/** 카카오 로컬을 쓸 수 없을 때 사용하는 대체 주소 검색 (OpenStreetMap) */
export async function searchOsm(query: string): Promise<KakaoPlace[]> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=ko&countrycodes=kr&limit=8&q=` +
      encodeURIComponent(query);
    const res = await fetch(url, {
      headers: { "User-Agent": "jimpick-estimate-app/1.0", Accept: "application/json" },
    });
    if (!res.ok) return [];
    const list = (await res.json()) as any[];
    return list.map((d) => {
      const full: string = d.display_name ?? "";
      const parts = full.split(",").map((s: string) => s.trim());
      const address = parts.slice(0, -1).reverse().join(" ") || full;
      return {
        address,
        roadAddress: address,
        name: d.name || parts[0] || address,
        x: Number(d.lon),
        y: Number(d.lat),
      };
    });
  } catch {
    return [];
  }
}

/** 직선 거리(km) — 경로 API를 쓸 수 없을 때의 근사치 */
export function haversineKm(x1: number, y1: number, x2: number, y2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(y2 - y1);
  const dLng = toRad(x2 - x1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(y1)) * Math.cos(toRad(y2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
