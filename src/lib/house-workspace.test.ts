import { describe, expect, it } from 'vitest';
import { switchHouse, seedSecondHouse } from './house-workspace';
import type { Estimate } from './jimpick';

const base = { id: 'e1', houseLinked: true, roomsCustomized: true, fromAddress: '대봉로 260', fromDetail: '105-301', sizeTab: '30~40평', fromFloor: 3, fromEnv: '엘리베이터', ladderFrom: false, ladderFromPrice: 0, lastWritingScreen: 'step6',
  rooms: [{ id: 'a', originId: 'origin-1', name: '첫 번째 집 · 안방', items: { bed: 1 } }] } as unknown as Estimate;

describe('house workspace', () => {
  it('seeds house 2 from its own answer and keeps house 1', () => {
    const e = seedSecondHouse(base, { fromAddress: '학정로 17-26', fromSize: '10~20평', fromFloor: 6, ladderFrom: true, rooms: { 거실: { sofa: { qty: 2 } } } } as never, 'req');
    const two = switchHouse(e, 'origin-2');
    expect(two.fromAddress).toBe('학정로 17-26');
    expect(two.fromFloor).toBe(6);
    expect(two.ladderFrom).toBe(true);
    expect(two.lastWritingScreen).toBe('step1');
    expect(two.rooms.find(r => r.originId === 'origin-2')?.items).toEqual({ sofa: 2 });
    const back = switchHouse({ ...two, lastWritingScreen: 'step4' }, 'origin-1');
    expect(back.fromAddress).toBe('대봉로 260');
    expect(back.sizeTab).toBe('30~40평');
    expect(back.lastWritingScreen).toBe('step6');
    expect(switchHouse(back, 'origin-2').lastWritingScreen).toBe('step4');
  });
  it('does not reseed an already written second house', () => {
    const e = seedSecondHouse(base, { fromAddress: 'x', rooms: {} } as never, 'req');
    expect(seedSecondHouse(e, { fromAddress: 'y', rooms: {} } as never, 'req').extraOrigin?.address).toBe('x');
  });
});
