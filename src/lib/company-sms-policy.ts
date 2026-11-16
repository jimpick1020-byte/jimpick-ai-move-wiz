/** Customer-directed paid transport is never authorized by a company role or a queue. */
export function canUsePaidCustomerSms(isServiceAdmin: boolean): boolean {
  return isServiceAdmin === true;
}

export function hasSavedNoticePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return /^01[016789]\d{7,8}$/.test(digits) && !/^01[016789]0+$/.test(digits);
}

export function savedNoticePhone(previous: string | null, result: { ok: boolean; phone: string }): string | null {
  return result.ok ? result.phone : previous;
}

export const BANK_COLLECTION_RETIRED = "은행 문자 등록은 더 이상 제공하지 않습니다. 실제 계좌를 확인한 뒤 입금을 확인해 주세요.";