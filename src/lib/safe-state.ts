/**
 * "마지막으로 정상 작동했던 상태" 백업.
 *
 * 단계가 바뀔 때마다 작성 중인 견적·고객 입력값을 백업해 두고,
 * 화면에 오류가 났을 때 이 백업으로 되돌릴 수 있게 합니다.
 * 저장된 견적 원본은 지우거나 고치지 않습니다 (되돌리기는 브라우저 안의 값만 바꿉니다).
 */
export const APP_STATE_KEY = "jimpick_v8_state";
export const SAFE_STATE_KEY = "jimpick_v8_state.safe";
export const SAFE_STATE_AT_KEY = "jimpick_v8_state.safe.at";

/** 지금 상태를 안전 백업으로 저장합니다 */
export function saveSafeSnapshot(): void {
  try {
    const raw = localStorage.getItem(APP_STATE_KEY);
    if (!raw) return;
    localStorage.setItem(SAFE_STATE_KEY, raw);
    localStorage.setItem(SAFE_STATE_AT_KEY, String(Date.now()));
  } catch {
    /* 저장 공간이 없으면 그냥 넘어갑니다 */
  }
}

/** 안전 백업이 있는 시각 (없으면 null) */
export function safeSnapshotAt(): number | null {
  try {
    const at = Number(localStorage.getItem(SAFE_STATE_AT_KEY) || 0);
    return at > 0 && localStorage.getItem(SAFE_STATE_KEY) ? at : null;
  } catch {
    return null;
  }
}

/** 안전 백업을 현재 상태로 되돌립니다. 성공하면 true */
export function restoreSafeSnapshot(): boolean {
  try {
    const raw = localStorage.getItem(SAFE_STATE_KEY);
    if (!raw) return false;
    localStorage.setItem(APP_STATE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}
