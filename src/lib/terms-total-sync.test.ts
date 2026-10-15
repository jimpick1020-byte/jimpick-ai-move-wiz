/**
 * 견적 상세 금액 수정 → 견적 내역(estimate_terms) 총액 동기화 규칙.
 *
 * 사장님이 견적 상세에서 금액을 고치면 이미 발송된 견적서의 총액도 함께 맞춰
 * 예약금·잔금 계산이 옛 금액으로 남지 않게 합니다.
 */
import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { staleTermTotalIds } from "./terms.functions";

describe("estimate total sync", () => {
  test("edits fix a stale total (1,070,000 vs stored 920,000)", () =>
    assert.deepEqual(
      staleTermTotalIds(
        [{ id: "t1", total: 920000 }],
        1070000,
      ),
      ["t1"],
    ));
  test("records already matching the edited total are left untouched", () =>
    assert.deepEqual(
      staleTermTotalIds(
        [
          { id: "t1", total: 1070000 },
          { id: "t2", total: 920000 },
        ],
        1070000,
      ),
      ["t2"],
    ));
  test("a null stored total counts as 0 and gets fixed", () =>
    assert.deepEqual(staleTermTotalIds([{ id: "t1", total: null }], 1070000), ["t1"]));
  test("nothing changes when every record already matches", () =>
    assert.deepEqual(staleTermTotalIds([{ id: "t1", total: 1070000 }], 1070000), []));
  test("older sheet versions of the same estimate are synced too", () =>
    assert.deepEqual(
      staleTermTotalIds(
        [
          { id: "old", total: 920000 },
          { id: "new", total: 920000 },
        ],
        1070000,
      ),
      ["old", "new"],
    ));
});
