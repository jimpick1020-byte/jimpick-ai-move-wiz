import { test } from "node:test";
import { strict as assert } from "node:assert";
import { addressWithBuilding } from "./address-label";

test("출발지와 도착지에 검색된 아파트 이름을 보존", () => {
  assert.equal(addressWithBuilding("대구 북구 검단로 115", "시험아파트"), "대구 북구 검단로 115 (시험아파트)");
  assert.equal(addressWithBuilding("대구 북구 구암로32길 14", "시험빌라"), "대구 북구 구암로32길 14 (시험빌라)");
});
test("원룸 이름 보존 및 기존 이름 중복과 없는 이름 추측 금지", () => {
  assert.equal(addressWithBuilding("서울 마포구 시험로 1", "시험원룸"), "서울 마포구 시험로 1 (시험원룸)");
  assert.equal(addressWithBuilding("서울 시험로 1 (시험빌라)", "시험빌라"), "서울 시험로 1 (시험빌라)");
  assert.equal(addressWithBuilding("서울 시험로 1"), "서울 시험로 1");
});