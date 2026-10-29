import { describe, expect, it } from 'vitest';
import { newEstimate, calcEstimate } from './jimpick';
import { editedSheet, sheetRoomsOf, toggleSheetDisposal, isDoubleTap } from './sheet-edit';

describe('owner sheet edits', () => {
  it('persists a manually edited deposit and recalculates balance without changing the total', () => {
    const before = { ...newEstimate(), totalOverride: 1480000 };
    const edited = editedSheet(before, { depositOverride: 200000 });
    const reopened = editedSheet(JSON.parse(JSON.stringify(edited)), { customerName: '수정 고객' });
    expect(reopened.total).toBe(1480000);
    expect(reopened.deposit).toBe(200000);
    expect(reopened.total - (reopened.deposit ?? 0)).toBe(1280000);
  });
  it('keeps zero deposit and prevents negative or above-total deposits', () => {
    const before = { ...newEstimate(), totalOverride: 1480000 };
    expect(editedSheet(before, { depositOverride: 0 }).deposit).toBe(0);
    expect(editedSheet(before, { depositOverride: -10000 }).deposit).toBe(0);
    expect(editedSheet(before, { depositOverride: 2000000 }).deposit).toBe(1480000);
    expect(editedSheet(before, {}).deposit).toBe(140000);
  });
  it('edits only the selected estimate and keeps image IDs and other quantities', () => {
    const before = { ...newEstimate(), rooms: [{ id: 'living', name: '거실', items: { sofa: 2, tv: 1 } }] };
    const next = editedSheet(before, { customerName: '수정 고객', itemNames: { sofa: '내 소파' }, rooms: [{ ...before.rooms[0], items: { sofa: 3, tv: 1 } }] });
    expect(next.id).toBe(before.id);
    expect(next.customerName).toBe('수정 고객');
    expect(sheetRoomsOf(next)[0].items[0]).toMatchObject({ id: 'sofa', name: '내 소파', qty: 3 });
    expect(before.rooms[0].items.sofa).toBe(2);
    expect(next.rooms[0].items.tv).toBe(1);
  });
  it('keeps option ID and image and uses existing separate-cost calculation', () => {
    const before = { ...newEstimate(), options: [{ id: 'op1', catalogItemId: 'sofa', imageUrl: '/existing.jpg', name: '옵션', enabled: true, separate: true, price: 50000 }] };
    const next = editedSheet(before, { options: before.options.map(o => ({ ...o, name: '옵션 수정', price: 70000 })) });
    expect(next.options[0]).toMatchObject({ id: 'op1', catalogItemId: 'sofa', imageUrl: '/existing.jpg', separate: true, price: 70000 });
    expect(next.total).toBe(calcEstimate(before).total);
    expect(editedSheet(next, { options: next.options.map(o => ({ ...o, separate: false })) }).total).toBe(next.total + 70000);
  });
  it('toggles only room-specific disposal, retaining original quantity and item ID after reload', () => {
    const before = { ...newEstimate(), rooms: [{ id: 'a', name: '거실', items: { sofa: 2 } }, { id: 'b', name: '안방', items: { sofa: 1 } }] };
    const next = editedSheet(before, toggleSheetDisposal(before, 'a', 'sofa'));
    const reloaded = JSON.parse(JSON.stringify(next));
    expect(sheetRoomsOf(reloaded)[0].items[0]).toMatchObject({ id: 'sofa', qty: 2, disposal: true });
    expect(sheetRoomsOf(reloaded)[1].items[0].disposal).toBe(false);
    expect(editedSheet(next, toggleSheetDisposal(next, 'a', 'sofa')).rooms[0].disposal?.sofa).toBe(false);
  });
  it('updates confirmed sheet projection without modifying consent or bank evidence', () => {
    const before = { ...newEstimate(), rooms: [{ id: 'a', name: '거실', items: { sofa: 1 } }], termsAcceptedAt: 123, sheetSnapshot: { sheetNo: 'JP-test', version: 1, confirmedAt: 50, total: 1, parts: [], rooms: [] } };
    const next = editedSheet(before, toggleSheetDisposal(before, 'a', 'sofa'));
    expect(next.termsAcceptedAt).toBe(123);
    expect(next.sheetSnapshot?.rooms[0].items[0]).toMatchObject({ id: 'sofa', disposal: true });
    expect(next.sheetSnapshot?.confirmedAt).toBe(50);
  });
  it('recognizes consecutive taps but rejects slow taps and scrolling movement', () => {
    const first = { at: 1000, x: 100, y: 100 };
    expect(isDoubleTap(first, { at: 1200, x: 104, y: 102 })).toBe(true);
    expect(isDoubleTap(first, { at: 1400, x: 100, y: 100 })).toBe(false);
    expect(isDoubleTap(first, { at: 1200, x: 100, y: 140 })).toBe(false);
  });
});