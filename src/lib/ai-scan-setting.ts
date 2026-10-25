import type { Screen } from './jimpick';

export const DEFAULT_AI_SCAN_ENABLED = false;
export function aiScanSettingKey(userId: string) { return `jimpick.ai-scan.${userId}`; }
export function parseAiScanSetting(value: string | null) { return value === 'true'; }
export function afterWorkConditions(enabled: boolean): Screen { return enabled ? 'scan' : 'step6'; }
export function beforeItemSelection(enabled: boolean): Screen { return enabled ? 'scan' : 'step3'; }
export function ownerStepProgress(screen: Screen, enabled: boolean) {
  const steps: Screen[] = ['step1', 'step2', 'step3', ...(enabled ? ['scan' as const] : []), 'step6', 'step4', 'plan'];
  const index = steps.indexOf(screen === 'options' ? 'plan' : screen);
  return { current: index + 1, total: steps.length };
}