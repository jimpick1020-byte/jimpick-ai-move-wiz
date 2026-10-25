import { describe, expect, it } from 'vitest';
import { newEstimate, calcEstimate, roundUpOptionPrice } from './jimpick';

describe('option cost is raised in 10,000 KRW units', () => {
  it('rounds an option price up to the next 10,000 KRW and keeps clean prices', () => {
    expect(roundUpOptionPrice(155000)).toBe(160000);
    expect(roundUpOptionPrice(150000)).toBe(150000);
    expect(roundUpOptionPrice(1)).toBe(10000);
    expect(roundUpOptionPrice(0)).toBe(0);
    expect(roundUpOptionPrice(-5000)).toBe(0);
  });

  it('charges the rounded option cost in the estimate total', () => {
    const base = { ...newEstimate() };
    const e = {
      ...base,
      options: [{ id: 'op1', name: '정수기냉장고', enabled: true, separate: false, price: 155000 }],
    };
    const { total, parts } = calcEstimate(e);
    expect(parts.find((p) => p.label === '옵션 비용')?.amount).toBe(160000);
    expect(total).toBe(calcEstimate({ ...base, options: [] }).total + 160000);
  });

  it('sums each option rounded on its own and keeps separate options out of the total', () => {
    const base = { ...newEstimate() };
    const e = {
      ...base,
      options: [
        { id: 'op1', name: '포함', enabled: true, separate: false, price: 10000 },
        { id: 'op2', name: '별도', enabled: true, separate: true, price: 155000 },
      ],
    };
    expect(calcEstimate(e).total).toBe(calcEstimate({ ...base, options: [] }).total + 10000);
  });
});
