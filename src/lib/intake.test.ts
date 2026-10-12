import { describe, expect, it } from "bun:test";
import { emptyIntakeForm, intakeStatusLabel, mergeIntakeIntoDraft, setQty, strictFloor, tapOnce, tapTwice } from "./intake";

describe("고객 링크 층수 (명확한 층만)", () => {
  it("3층·지하 1층·B1은 자동 추출", () => {
    expect(strictFloor("상가 3층")).toBe(3);
    expect(strictFloor("지하 1층")).toBe(-1);
    expect(strictFloor("B1")).toBe(-1);
  });
  it("502호는 층수로 보지 않음 → 방문 확인 예정", () => {
    expect(strictFloor("101동 502호")).toBeNull();
    expect(strictFloor("")).toBeNull();
  });
});

describe("카드 누르기", () => {
  it("한 번 누르면 일반 선택, 다시 누르면 해제", () => {
    const a = tapOnce({}, "bed-01");
    expect(a["bed-01"]).toEqual({ qty: 1, disposal: false });
    expect(tapOnce(a, "bed-01")["bed-01"]).toBeUndefined();
  });
  it("두 번 빠르게 누르면 폐기물, 다시 두 번이면 해제 — 수량은 그대로", () => {
    const a = setQty(tapOnce({}, "bed-01"), "bed-01", 2);
    const w = tapTwice(a, "bed-01");
    expect(w["bed-01"]).toEqual({ qty: 2, disposal: true });
    expect(tapTwice(w, "bed-01")["bed-01"]).toEqual({ qty: 2, disposal: false });
  });
});

describe("견적 초안 합치기", () => {
  const base = { id: "est_x", rooms: [{ id: "r_거실", name: "거실", items: { "sofa-01": 1 } }], workers: 4, fromFloor: 1 };
  it("다시 제출해도 수량이 겹치지 않고 사장님 칸은 유지", () => {
    const f = { ...emptyIntakeForm("홍길동", "010-1234-5678"), fromDetail: "3층", rooms: { 거실: { "television-01": { qty: 1, disposal: false } } } };
    const once = mergeIntakeIntoDraft(base, f, null, { intakeRequestId: "r1" });
    const f2 = { ...f, rooms: { 거실: { "television-01": { qty: 2, disposal: true } } } };
    const twice = mergeIntakeIntoDraft(once, f2, f.rooms, { intakeRequestId: "r1" });
    const room = (twice.rooms as { name: string; items: Record<string, number>; disposal: Record<string, boolean> }[]).find((r) => r.name === "거실")!;
    expect(room.items["television-01"]).toBe(2);
    expect(room.disposal["television-01"]).toBe(true);
    expect(room.items["sofa-01"]).toBe(1);
    expect(twice.workers).toBe(4);
    expect(twice.fromFloor).toBe(3);
    expect(twice.intakeToFloor).toBe("방문 확인 예정");
  });
});

describe("링크 상태", () => {
  it("취소·만료 표시", () => {
    expect(intakeStatusLabel({ status: "cancelled", expires_at: "2099-01-01" })).toBe("링크 취소");
    expect(intakeStatusLabel({ status: "sent", expires_at: "2000-01-01" })).toBe("링크 만료");
  });
});
