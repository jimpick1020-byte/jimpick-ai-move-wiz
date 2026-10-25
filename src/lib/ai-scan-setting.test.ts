import { describe, it, expect } from 'vitest';
import { DEFAULT_AI_SCAN_ENABLED, aiScanSettingKey, parseAiScanSetting, afterWorkConditions, beforeItemSelection, ownerStepProgress } from './ai-scan-setting';

describe('owner AI scan preference', () => {
  it('defaults to off with missing or invalid saved values', () => {
    expect(DEFAULT_AI_SCAN_ENABLED).toBe(false);
    expect(parseAiScanSetting(null)).toBe(false);
    expect(parseAiScanSetting('false')).toBe(false);
    expect(parseAiScanSetting('invalid')).toBe(false);
  });
  it('restores explicit on and scopes storage to the account', () => {
    expect(parseAiScanSetting('true')).toBe(true);
    expect(aiScanSettingKey('owner-a')).not.toBe(aiScanSettingKey('owner-b'));
  });
  it('skips scan in both directions when off', () => {
    expect(afterWorkConditions(false)).toBe('step6');
    expect(beforeItemSelection(false)).toBe('step3');
    expect(ownerStepProgress('step6', false)).toEqual({ current: 4, total: 6 });
  });
  it('includes scan in both directions and sequential progress when on', () => {
    expect(afterWorkConditions(true)).toBe('scan');
    expect(beforeItemSelection(true)).toBe('scan');
    expect(ownerStepProgress('scan', true)).toEqual({ current: 4, total: 7 });
    expect(ownerStepProgress('step6', true)).toEqual({ current: 5, total: 7 });
    expect(ownerStepProgress('step4', true)).toEqual({ current: 6, total: 7 });
    expect(ownerStepProgress('options', true)).toEqual({ current: 7, total: 7 });
  });
});