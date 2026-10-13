import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { emptyIntakeForm, intakeStatusLabel, mergeIntakeIntoDraft, setQty, strictFloor, tapOnce, tapTwice } from "./intake";

describe("고객 링크 층수 (명확한 층만)", () => {
  it("3층·지하 1층·B1은 자동 추출", () => {
    assert.equal(strictFloor("상가 3층"), 3);
    assert.equal(strictFloor("지하 1층"), -1);
    assert.equal(strictFloor("B1"), -1);
  });
  it("동과 호수를 구분해 101동 502호는 5층, 105-1001은 10층", () => {
    assert.equal(strictFloor("101동 502호"), 5);
    assert.equal(strictFloor("105-1001"), 10);
    assert.equal(strictFloor("101동"), null);
    assert.equal(strictFloor("판교역로 235"), null);
    assert.equal(strictFloor(""), null);
  });
});

describe("카드 누르기", () => {
  it("한 번 누르면 일반 선택, 다시 누르면 해제", () => {
    const a = tapOnce({}, "bed-01");
    assert.deepEqual(a["bed-01"], { qty: 1, disposal: false });
    assert.equal(tapOnce(a, "bed-01")["bed-01"], undefined);
  });
  it("두 번 빠르게 누르면 폐기물, 다시 두 번이면 해제 — 수량은 그대로", () => {
    const a = setQty(tapOnce({}, "bed-01"), "bed-01", 2);
    const w = tapTwice(a, "bed-01");
    assert.deepEqual(w["bed-01"], { qty: 2, disposal: true });
    assert.deepEqual(tapTwice(w, "bed-01")["bed-01"], { qty: 2, disposal: false });
  });
});

describe("견적 초안 합치기", () => {
  const base = { id: "est_x", rooms: [{ id: "r_거실", name: "거실", items: { "sofa-01": 1 } }], workers: 4, fromFloor: 1 };
  it("다시 제출해도 수량이 겹치지 않고 사장님 칸은 유지", () => {
    const f = { ...emptyIntakeForm("홍길동", "010-1234-5678"), fromDetail: "3층", rooms: { 거실: { "television-01": { qty: 1, disposal: false } } } };
    const once = mergeIntakeIntoDraft(base, f, null, { intakeRequestId: "r1" });
    const f2 = { ...f, rooms: { 거실: { "television-01": { qty: 2, disposal: true } } } };
    const twice = mergeIntakeIntoDraft(once, f2, f.rooms, { intakeRequestId: "r1" });
    const room = (twice.rooms as { name: string; items: Record<string, number>; disposal: Record<string, boolean> }[]).find((r) => r.name === "거실");
    assert.ok(room);
    assert.equal(room.items["television-01"], 2);
    assert.equal(room.disposal["television-01"], true);
    assert.equal(room.items["sofa-01"], 1);
    assert.equal(twice.workers, 4);
    assert.equal(twice.fromFloor, 3);
    assert.equal(twice.intakeToFloor, "방문 확인 예정");
  });
});

describe("링크 상태", () => {
  it("취소·만료 표시", () => {
    assert.equal(intakeStatusLabel({ status: "cancelled", expires_at: "2099-01-01" }), "링크 취소");
    assert.equal(intakeStatusLabel({ status: "sent", expires_at: "2000-01-01" }), "링크 만료");
  });
});

import { fitsSize, intakeItemName, intakeSmsText, INTAKE_BASE_ITEMS } from "./intake";

describe("평수 추천과 품목", () => {
  it("5평 이하에는 킹 침대를 추천하지 않고, 30~40평에는 추천", () => {
    const king = INTAKE_BASE_ITEMS.find((b) => b.id === "king-bed-01")!;
    assert.equal(fitsSize(king.sizes, "5평 이하"), false);
    assert.equal(fitsSize(king.sizes, "30~40평"), true);
    assert.equal(fitsSize(king.sizes, ""), true);
  });
  it("침대 8종·소파 6종·TV 6종", () => {
    const n = (k: string) => INTAKE_BASE_ITEMS.filter((b) => b.kind === k).length;
    assert.equal(n("침대"), 8); assert.equal(n("소파"), 6); assert.equal(n("TV"), 6);
  });
  it("예전 품목 이름도 표시", () => assert.equal(intakeItemName("bed-01"), "침대"));
});

describe("문자 문구", () => {
  it("이름 없이 보내면 「고객님」으로 시작", () => {
    assert.match(intakeSmsText({ customerName: "", link: "x", contact: "y" }), /\n\n고객님, 방문견적/);
  });
});
