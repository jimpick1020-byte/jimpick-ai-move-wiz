import { describe, expect, test } from "bun:test";
import { roomArtKey } from "./room-art";

describe("roomArtKey", () => {
  test("화장실 계열", () => {
    for (const n of ["화장실", "욕실 2", "욕실2", "안방 화장실", "안방화장실"]) expect(roomArtKey(n)).toBe("bathroom");
  });
  test("공간별", () => {
    expect(roomArtKey("주방")).toBe("kitchen");
    expect(roomArtKey("부엌")).toBe("kitchen");
    expect(roomArtKey("거실")).toBe("living");
    expect(roomArtKey("안방")).toBe("bedroom");
    expect(roomArtKey("침실 1")).toBe("bedroom");
    expect(roomArtKey("작은방")).toBe("small");
    expect(roomArtKey("서재")).toBe("study");
    expect(roomArtKey("공부방")).toBe("study");
    expect(roomArtKey("드레스룸")).toBe("dress");
    expect(roomArtKey("옷방")).toBe("dress");
    expect(roomArtKey("세탁실")).toBe("laundry");
    expect(roomArtKey("발코니")).toBe("balcony");
    expect(roomArtKey("베란다 2")).toBe("balcony");
    expect(roomArtKey("창고")).toBe("storage");
  });
  test("알 수 없는 이름은 중립", () => {
    expect(roomArtKey("공간 3")).toBe("neutral");
    expect(roomArtKey("")).toBe("neutral");
  });
});
