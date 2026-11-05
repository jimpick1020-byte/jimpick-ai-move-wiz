import { describe, it, expect } from "vitest";
import { ladderAutoFee, applyLadderAuto } from "./ladder-fee";

const base = {
  fromFloor: 3, toFloor: 3, truck1t: 0, truck5t: 0, ladderFrom: true, ladderTo: false,
  ladderFromPrice: 0, ladderToPrice: 0, ladderFromSeparate: false, ladderToSeparate: false,
};

describe("사다리차 자동 요금", () => {
  it("2~5층 1톤 3대→4대→5대는 15만→18만→21만", () => {
    expect(ladderAutoFee(4, 0, 3).amount).toBe(150000);
    expect(ladderAutoFee(4, 0, 4).amount).toBe(180000);
    expect(ladderAutoFee(4, 0, 5).amount).toBe(210000);
  });
  it("5톤1+1톤1: 14층 23만, 15층 25만", () => {
    expect(ladderAutoFee(14, 1, 1).amount).toBe(230000);
    expect(ladderAutoFee(15, 1, 1).amount).toBe(250000);
  });
  it("20~24층 기본요금", () => {
    expect(ladderAutoFee(20, 1, 0).amount).toBe(280000);
    expect(ladderAutoFee(24, 1, 0).amount).toBe(400000);
  });
  it("25층과 5톤 2대는 금액을 확정하지 않는다", () => {
    expect(ladderAutoFee(25, 1, 0).amount).toBeNull();
    expect(ladderAutoFee(10, 2, 0).amount).toBeNull();
  });
  it("차량 대수 변경 시 자동값을 교체하고 반복해도 누적되지 않는다", () => {
    let d = applyLadderAuto({ ...base, truck1t: 4 }, { truck1t: 4 });
    expect(d.ladderFromPrice).toBe(180000);
    d = applyLadderAuto({ ...d, truck1t: 4 }, { truck1t: 4 });
    expect(d.ladderFromPrice).toBe(180000);
    d = applyLadderAuto({ ...d, truck1t: 3 }, { truck1t: 3 });
    expect(d.ladderFromPrice).toBe(150000);
  });
  it("한쪽을 엘리베이터로 바꾸면 그쪽만 0원", () => {
    let d = applyLadderAuto({ ...base, ladderTo: true, truck5t: 1, truck1t: 1, fromFloor: 14, toFloor: 15 }, { truck1t: 1 });
    expect(d.ladderFromPrice + d.ladderToPrice).toBe(480000);
    d = applyLadderAuto({ ...d, ladderFrom: false }, { ladderFrom: false });
    expect(d.ladderFromPrice).toBe(0);
    expect(d.ladderToPrice).toBe(250000);
  });
});
