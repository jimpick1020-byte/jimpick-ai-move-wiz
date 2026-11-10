import { describe, it, expect } from 'vitest';
import { addSecondOrigin, removeSecondOrigin, extraLadderIncluded, routeLegs } from './multi-origin';
import { newEstimate, calcEstimate, type Estimate } from './jimpick';
import { applyLadderAuto } from './ladder-fee';
import { emptyIntakeForm, mergeIntakeIntoDraft } from './intake';
import { intakeToEstimate, estimateToIntake } from './intake-estimate-adapter';
import { withRoomQuantityStep } from './room-item-state';

describe('두 집 한 견적', () => {
  const submitted = () => ({ ...emptyIntakeForm('두집시험', '010-0000-0000'), fromAddress: '출발주소1', fromDetail: '101호', toAddress: '도착주소', toDetail: '202호', fromSize: '20~30평', toSize: '30~40평', fromFloor: 2, fromFloorEdited: true, ladderFrom: true, toFloor: 2, toFloorEdited: true, ladderTo: true, extraOrigin: { id: 'origin-2' as const, address: '출발주소2', detail: '501호', size: '60~70평', floor: 5, env: '엘리베이터' as const, ladder: false } });
  it('고객 제출과 재복원에 출발 2층 사다리·출발2 5층 엘리베이터·도착2층 사다리를 유지한다', () => {
    const form = submitted();
    const d = mergeIntakeIntoDraft(newEstimate() as unknown as Record<string, unknown>, form, null, { intakeRequestId: 'one-request' }) as unknown as Estimate;
    const restored: Estimate = JSON.parse(JSON.stringify(d));
    expect(restored.fromFloor).toBe(2); expect(restored.ladderFrom).toBe(true);
    expect(restored.extraOrigin).toEqual(form.extraOrigin);
    expect(restored.toFloor).toBe(2); expect(restored.ladderTo).toBe(true);
    expect(restored.intakeRequestId).toBe('one-request');
    expect(estimateToIntake(intakeToEstimate(form), form).extraOrigin).toEqual(form.extraOrigin);
  });
  it('출발1과 도착에만 사다리 15만원씩 한 번 반영하고 반복 계산해도 30만원이다', () => {
    const d = { ...newEstimate(), fromFloor: 2, toFloor: 2, ladderFrom: true, ladderTo: true, truck1t: 3, truck5t: 0, extraOrigin: submitted().extraOrigin };
    const priced = applyLadderAuto(d, { truck1t: 3 });
    expect(priced.ladderFromPrice).toBe(150000); expect(priced.ladderToPrice).toBe(150000);
    expect(extraLadderIncluded(priced)).toBe(0);
    expect(calcEstimate(priced).parts.find(p => p.label === '사다리차 비용')?.amount).toBe(300000);
    expect(calcEstimate(applyLadderAuto(priced, { truck1t: 3 })).parts.find(p => p.label === '사다리차 비용')?.amount).toBe(300000);
  });
  it('각 지점 별도는 합계에서 제외하고 출발2는 해당 작업 차량으로 계산한다', () => {
    const d = applyLadderAuto({ ...newEstimate(), ladderFrom: true, fromFloor: 2, ladderFromSeparate: true, ladderTo: true, toFloor: 2, extraOrigin: { ...submitted().extraOrigin, ladder: true, floor: 2, truck5t: 0, truck1t: 4 } }, { truck1t: 3 });
    expect(d.extraOrigin?.ladderPrice).toBe(180000);
    expect(calcEstimate(d).parts.find(p => p.label === '사다리차 비용')?.amount).toBe(330000);
    expect(extraLadderIncluded({ ...d, extraOrigin: { ...d.extraOrigin, id: 'origin-2', address: '', detail: '', ladder: true, ladderSeparate: true } })).toBe(0);
  });
  it('동일한 안방을 집별 ID로 구분하고 바구니 수량이 섞이지 않는다', () => {
    const e = { ...newEstimate(), rooms: [{ id: 'existing-bedroom', name: '안방', items: { box: 2 }, disposal: { box: true } }] };
    const d = { ...e, ...addSecondOrigin(e) };
    expect(d.rooms[0].id).toBe('existing-bedroom');
    const rooms = withRoomQuantityStep(d.rooms, '출발지 2 · 안방', 'basket', 1);
    expect(rooms[0].items).toEqual({ box: 2 }); expect(rooms[1].items.basket).toBe(1);
    const removed = removeSecondOrigin({ ...d, rooms });
    expect(removed.rooms).toHaveLength(1); expect(removed.rooms?.[0].disposal?.box).toBe(true);
  });
  it('순차 방문은 출발1→출발2→도착, 각각 출발은 두 도착 구간이다', () => {
    const e = { ...newEstimate(), fromX: 1, fromY: 2, toX: 5, toY: 6, extraOrigin: { ...submitted().extraOrigin, x: 3, y: 4 } };
    expect(routeLegs(e)).toEqual([{ from: { x: 1, y: 2 }, to: { x: 3, y: 4 } }, { from: { x: 3, y: 4 }, to: { x: 5, y: 6 } }]);
    expect(routeLegs({ ...e, routeMode: 'separate' })[0].to).toEqual({ x: 5, y: 6 });
  });
  it('기존 한 집을 열기만 하면 금액이나 출발2가 생성되지 않는다', () => {
    const e = { ...newEstimate(), total: 1300000 };
    expect(applyLadderAuto(e, {})).toBe(e); expect(e.extraOrigin).toBeUndefined();
  });
});