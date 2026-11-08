import { describe, expect, it } from 'vitest';
import { newEstimate } from './jimpick';
import { editedSheet } from './sheet-edit';
import { finalSavedEstimate, mergeSavedSheet } from './saved-sheet';

describe('saved sheet history amounts', () => {
  for (const [before, after] of [[1400000, 1500000], [1500000, 1300000]]) {
    it(`final completion persists ${before} → ${after} after a cost edit`, () => {
      const original = { ...editedSheet(newEstimate(), { transportOverride: before }), sheetSavedRevision: 10 };
      const saved = finalSavedEstimate({ ...original, transportOverride: after }, 11);
      const restored = mergeSavedSheet(original, JSON.parse(JSON.stringify(saved)));
      expect(restored.total).toBe(after);
      expect(restored.sheetSnapshot?.total).toBe(after);
      expect(restored.sheetSnapshot?.parts.reduce((sum, part) => sum + part.amount, 0)).toBe(after);
      expect(restored.sheetSavedRevision).toBe(11);
      expect(restored.id).toBe(original.id);
      expect(original.total).toBe(before);
    });
  }
  it('final completion preserves the manually set deposit and ignores an older restore', () => {
    const before = editedSheet(newEstimate(), { transportOverride: 1400000, depositOverride: 100000 });
    const saved = finalSavedEstimate({ ...before, transportOverride: 1300000 }, 12);
    expect(saved.depositOverride).toBe(100000);
    expect(saved.deposit).toBe(100000);
    expect(mergeSavedSheet(saved, { ...before, sheetSavedRevision: 11 })).toBe(saved);
  });
  for (const account of ['admin', 'company']) {
    it(`${account}: saves 1400000 → 1500000 and restores the same ID`, () => {
      const current = { ...newEstimate(), totalOverride: 1400000, total: 1400000 };
      const saved = { ...editedSheet(current, { totalOverride: 1500000 }), sheetSavedRevision: 1 };
      const restored = mergeSavedSheet(current, JSON.parse(JSON.stringify(saved)));
      expect(restored.total).toBe(1500000);
      expect(restored.sheetSnapshot?.total).toBe(1500000);
      expect(restored.id).toBe(current.id);
      expect(current.total).toBe(1400000);
    });
    it(`${account}: saves 1500000 → 1300000 and restores the same ID`, () => {
      const current = { ...newEstimate(), totalOverride: 1500000, total: 1500000 };
      const saved = { ...editedSheet(current, { totalOverride: 1300000 }), sheetSavedRevision: 2 };
      expect(mergeSavedSheet(current, JSON.parse(JSON.stringify(saved))).total).toBe(1300000);
      expect(saved.sheetSnapshot?.total).toBe(1300000);
    });
  }
  it('recalculates cost edits using the existing calculation', () => {
    const before = editedSheet(newEstimate(), { transportOverride: 1400000 });
    expect(editedSheet(before, { transportOverride: 1500000 }).total).toBe(1500000);
    expect(editedSheet(before, { transportOverride: 1300000 }).total).toBe(1300000);
  });
  it('never replaces another ID', () => {
    const current = { ...newEstimate(), id: 'one', total: 1400000 };
    expect(mergeSavedSheet(current, { ...current, id: 'two', total: 1500000, sheetSavedRevision: 2 })).toBe(current);
  });
  it('ignores delayed responses from an older successful save', () => {
    const current = { ...newEstimate(), total: 1300000, sheetSavedRevision: 2 };
    expect(mergeSavedSheet(current, { ...current, total: 1500000, sheetSavedRevision: 1 })).toBe(current);
  });
});