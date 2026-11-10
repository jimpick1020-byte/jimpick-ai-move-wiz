import { describe, expect, it } from 'vitest';
import { houseForm, mergeHouseDestination, mergeHouseEstimate } from './intake-house';
import { emptyIntakeForm } from './intake';
import { calcEstimate, newEstimate } from './jimpick';
import { applyLadderAuto } from './ladder-fee';

describe('집별 링크 입력', () => {
  it('새 집은 출발지와 짐이 비어 있고 공통 도착지만 표시한다', () => {
    const f = houseForm({}, '010-0000-0000', { toAddress: '공통 도착지' });
    expect(f.fromAddress).toBe(''); expect(f.rooms).toEqual({}); expect(f.toAddress).toBe('공통 도착지');
  });
  it('빈칸을 나중에 저장해도 먼저 저장된 도착지와 층수를 지우지 않는다', () => {
    const destination = mergeHouseDestination({}, { ...emptyIntakeForm(), toAddress: '공통 도착지', toFloor: 2, ladderTo: true });
    expect(mergeHouseDestination(destination, emptyIntakeForm())).toEqual(destination);
  });
  it('첫 집과 둘째 집의 같은 방 품목을 별도 ID로 보존한다', () => {
    const a = { ...emptyIntakeForm(), fromAddress: '첫 집', fromSize: '20~30평', rooms: { 안방: { 'desk-01': { qty: 3, disposal: false } } } };
    const b = { ...emptyIntakeForm(), fromAddress: '둘째 집', fromSize: '60~70평', rooms: { 안방: { 'desk-01': { qty: 8, disposal: true } } } };
    const result = mergeHouseEstimate(newEstimate(), a, b, 'request-1');
    expect(result.fromAddress).toBe('첫 집'); expect(result.extraOrigin?.address).toBe('둘째 집');
    const r1 = result.rooms.find(r => r.originId === 'origin-1' && r.kind === '안방');
    const r2 = result.rooms.find(r => r.originId === 'origin-2' && r.kind === '안방');
    expect(r1?.items['desk-01']).toBe(3); expect(r2?.items['desk-01']).toBe(8); expect(r1?.id).not.toBe(r2?.id);
    expect(r2?.disposal?.['desk-01']).toBe(true);
  });
  it('오래된 도착지 입력은 거부하고 현재 도착지를 읽은 뒤 수정한 값은 반영한다', () => {
    const saved = { toAddress: '공통 도착지', toFloor: 2 };
    expect(mergeHouseDestination(saved, { ...emptyIntakeForm(), toAddress: '오래된 주소', toFloor: 5 }).toAddress).toBe('공통 도착지');
    const edited = { ...emptyIntakeForm(), toAddress: '수정 도착지', toFloor: 5, destinationSnapshot: saved };
    expect(mergeHouseDestination(saved, edited).toAddress).toBe('수정 도착지');
    expect(mergeHouseDestination(saved, edited).toFloor).toBe(5);
  });
  it('출발 두 곳 사다리와 공통 도착 사다리만 각각 한 번 계산한다', () => {
    const a = { ...emptyIntakeForm(), fromFloor: 2, fromFloorEdited: true, ladderFrom: true, toFloor: 2, toFloorEdited: true, ladderTo: true };
    const b = { ...a, fromFloor: 5 };
    const d = applyLadderAuto(mergeHouseEstimate(newEstimate(), a, b, 'one-estimate'), { truck1t: 3 });
    expect(d.ladderFromPrice).toBe(150000); expect(d.extraOrigin?.ladderPrice).toBe(150000); expect(d.ladderToPrice).toBe(150000);
    expect(calcEstimate(d).parts.find(p => p.label === '사다리차 비용')?.amount).toBe(450000);
  });
});