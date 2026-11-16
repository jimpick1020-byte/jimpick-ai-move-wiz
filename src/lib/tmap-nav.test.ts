import { describe, expect, test } from "vitest";
import { baseAddress, navPlatform, tmapUrl, validCoord } from "./tmap-nav";

describe("tmap-nav", () => {
  test("좌표 있으면 경도 goalx, 위도 goaly 경로", () => {
    expect(tmapUrl("서울 강남구 테헤란로 152", 127.0364, 37.5000)).toBe(
      `tmap://route?goalname=${encodeURIComponent("서울 강남구 테헤란로 152")}&goalx=127.0364&goaly=37.5`);
  });
  test("좌표 없거나 뒤바뀌면 주소 검색", () => {
    expect(tmapUrl("서울 강남구 테헤란로 152")).toMatch(new RegExp("^" + "tmap://search?name=".replace(/[?]/g, "\\?")));
    expect(validCoord(37.5, 127.03)).toBeNull();
    expect(tmapUrl("부산 해운대구 우동 1408", 37.5, 127)).toMatch(new RegExp("^" + "tmap://search?name=".replace(/[?]/g, "\\?")));
  });
  test("빈 주소는 비활성", () => { expect(tmapUrl("  ")).toBeNull(); expect(tmapUrl(undefined)).toBeNull(); });
  test("합쳐진 상세 제거, 도로/지번/산번지 보존", () => {
    expect(baseAddress("서울 강남구 테헤란로 152 101동 1203호 공동현관 1234#")).toBe("서울 강남구 테헤란로 152");
    expect(baseAddress("서울 중구 세종대로21길 5-3 2층")).toBe("서울 중구 세종대로21길 5-3");
    expect(baseAddress("경기 성남시 분당구 정자동 178-1 302동 501호")).toBe("경기 성남시 분당구 정자동 178-1");
    expect(baseAddress("강원 홍천군 서면 팔봉리 산 12-3")).toBe("강원 홍천군 서면 팔봉리 산 12-3");
    expect(baseAddress("서울 송파구 올림픽로 300 (롯데월드타워) 3동 202호")).toBe("서울 송파구 올림픽로 300 (롯데월드타워)");
    expect(baseAddress("서울 송파구 올림픽로 300 (101동 202호)")).toBe("서울 송파구 올림픽로 300");
  });
  test("상세 주소 문자는 URL에 없음", () => {
    const url = decodeURIComponent(tmapUrl("서울 강남구 테헤란로 152 101동 1203호", 127.03, 37.5)!);
    expect(url).not.toContain("101동"); expect(url).not.toContain("1203");
  });
  test("플랫폼", () => {
    expect(navPlatform("Mozilla/5.0 (Linux; Android 14; SM-S918N)")).toBe("android");
    expect(navPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("ios");
    expect(navPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
  });
});
