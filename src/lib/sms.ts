/**
 * 견적 문자 보내기.
 *
 * 휴대폰에서는 문자 앱이 내용까지 채워진 채로 열립니다. 보내기는 사장님이 직접 누릅니다.
 * (컴퓨터에는 문자 앱이 없으므로 내용을 복사해 드립니다)
 *
 * 통신사 API 로 자동 발송하려면 발신번호 사전등록이 필요합니다 — sms.functions.ts 참고.
 */

/** 숫자만 남깁니다 (010-1234-5678 → 01012345678) */
export function normalizePhone(phone: string): string {
  return (phone || "").replace(/[^0-9]/g, "");
}

/** 문자로 보낼 수 있는 번호인지 (국내 휴대폰 기준) */
export function isSendablePhone(phone: string): boolean {
  const n = normalizePhone(phone);
  return /^01[016789][0-9]{7,8}$/.test(n);
}

/**
 * 문자 앱을 여는 주소를 만듭니다.
 * iOS 는 `&body=`, 안드로이드는 `?body=` 를 씁니다.
 */
export function smsHref(phone: string, body: string): string {
  const n = normalizePhone(phone);
  const encoded = encodeURIComponent(body);
  const isIOS =
    typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent || "");
  return `sms:${n}${isIOS ? "&" : "?"}body=${encoded}`;
}

/** 이 기기에 문자 앱이 있을 가능성이 높은지 (휴대폰인지) */
export function hasSmsApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPad|iPhone|iPod|Mobile/i.test(navigator.userAgent || "");
}

export interface EstimateSmsInput {
  customerName: string;
  moveDateText: string;
  fromAddress: string;
  toAddress: string;
  totalText: string;
  /** 견적서 공유 주소 (있으면 마지막 줄에 붙습니다) */
  shareUrl?: string;
}

/** 고객에게 보낼 견적 문자 내용 */
export function buildEstimateMessage(e: EstimateSmsInput): string {
  const lines = [
    `[JIMPICK 이사 견적]`,
    `${e.customerName}님, 견적이 나왔습니다.`,
    ``,
    `· 이사일: ${e.moveDateText}`,
    `· 출발: ${e.fromAddress}`,
    `· 도착: ${e.toAddress}`,
    `· 예상 견적: ${e.totalText}`,
  ];
  if (e.shareUrl) {
    lines.push(``, `자세한 내역: ${e.shareUrl}`);
  }
  lines.push(``, `문의 주시면 자세히 안내해 드리겠습니다.`);
  return lines.join("\n");
}
