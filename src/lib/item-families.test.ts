import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  itemFamily,
  effectiveCat5,
  effectiveGroup,
  layoutSort,
  buildMovePatch,
  type ItemLayout,
  type LayoutItem,
} from "./item-families";

describe("품목 묶음 분류", () => {
  it("요청한 대표 품목이 알맞은 묶음에 들어갑니다", () => {
    assert.equal(itemFamily("장롱", "").label, "옷장·장롱");
    assert.equal(itemFamily("슬라이딩 옷장", "").label, "옷장·장롱");
    assert.equal(itemFamily("붙박이장", "").label, "옷장·장롱");
    assert.equal(itemFamily("6단 서랍장", "").label, "서랍장");
    assert.equal(itemFamily("침대(퀸)", "").label, "침대·매트리스");
    assert.equal(itemFamily("2층침대", "").label, "침대·매트리스");
    assert.equal(itemFamily("돌침대", "").label, "침대·매트리스");
    assert.equal(itemFamily("3인용 소파", "").label, "소파");
    assert.equal(itemFamily("화장대", "").label, "화장대");
    assert.equal(itemFamily("책상", "").label, "책상");
    assert.equal(itemFamily("식탁(4인)", "").label, "식탁");
    assert.equal(itemFamily("의자", "").label, "의자");
    assert.equal(itemFamily("책장", "").label, "책장·선반");
    assert.equal(itemFamily("장식장", "").label, "거실장·장식장");
    assert.equal(itemFamily("행거", "").label, "행거");
    assert.equal(itemFamily("4도어 냉장고", "").label, "냉장고");
    assert.equal(itemFamily("김치냉장고", "").label, "냉장고");
    assert.equal(itemFamily("통돌이세탁기", "").label, "세탁기");
    assert.equal(itemFamily("드럼세탁기", "").label, "세탁기");
    assert.equal(itemFamily("건조기", "").label, "건조기");
    assert.equal(itemFamily("TV", "").label, "TV·영상·음향");
    assert.equal(itemFamily("에어컨", "").label, "에어컨");
    assert.equal(itemFamily("로봇청소기", "").label, "청소기");
    assert.equal(itemFamily("공기청정기", "").label, "공기청정기");
    assert.equal(itemFamily("의류관리기", "").label, "스타일러·의류관리기");
  });

  it("빨래건조대는 전기 건조기와 다른 묶음입니다", () => {
    assert.equal(itemFamily("빨래건조대", "").label, "빨래건조대");
    assert.notEqual(itemFamily("빨래건조대", "").label, itemFamily("건조기", "").label);
  });

  it("화분받침대는 침대 묶음에 들어가지 않습니다", () => {
    assert.notEqual(itemFamily("화분받침대", "").label, "침대·매트리스");
  });
});

describe("배치 덮어쓰기", () => {
  const items: LayoutItem[] = [
    { id: "a", name: "침대(퀸)", cat5: "가구" },
    { id: "b", name: "서랍장", cat5: "가구" },
    { id: "c", name: "냉장고", cat5: "가전" },
  ];

  it("직접 옮긴 분류·묶음이 자동 분류보다 우선합니다", () => {
    const layout: ItemLayout = { c: { cat5: "가구", group: "서랍장" } };
    assert.equal(effectiveCat5(items[2], layout), "가구");
    assert.equal(effectiveGroup(items[2], layout), "서랍장");
    // 덮어쓰지 않은 품목은 자동 분류 그대로
    assert.equal(effectiveCat5(items[0], layout), "가구");
    assert.equal(effectiveGroup(items[0], layout), "침대·매트리스");
  });

  it("직접 정한 순서는 같은 묶음 안에서 적용됩니다", () => {
    const sameGroup: LayoutItem[] = [
      { id: "a", name: "침대(퀸)", cat5: "가구" },
      { id: "b", name: "침대(싱글)", cat5: "가구" },
    ];
    const layout: ItemLayout = { b: { order: 0 }, a: { order: 10 } };
    const sorted = layoutSort(sameGroup, layout);
    assert.deepEqual(sorted.map((i) => i.id), ["b", "a"]);
  });

  it("이동 조각은 대상 묶음 전체 순서를 함께 저장합니다", () => {
    const patch = buildMovePatch("c", { cat5: "가구", group: "침대·매트리스" }, ["a", "b"], 1, {});
    assert.equal(patch.c.cat5, "가구");
    assert.equal(patch.c.group, "침대·매트리스");
    assert.equal(patch.c.order, 10);
    assert.equal(patch.a.order, 0);
    assert.equal(patch.b.order, 20);
    // 옮긴 품목은 한 번만 나타납니다
    const merged: ItemLayout = { ...patch };
    const sorted = layoutSort(items, merged);
    assert.deepEqual(sorted.map((i) => i.id), ["a", "c", "b"]);
    assert.equal(new Set(sorted.map((i) => i.id)).size, 3);
  });
});
