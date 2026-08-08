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

/**
 * 문자에 담을 이사 정보.
 * 견적 결과 화면의 「이사 정보」 카드와 같은 내용·같은 순서로 채웁니다.
 */
export interface EstimateSmsInput {
  customerName: string;
  phone: string;
  moveDateText: string;
  moveType: string;
  fromAddress: string;
  toAddress: string;
  distanceKm: number;
  durationMin: number;
  workEnv: string;
  fromFloor: number;
  toFloor: number;
  truck1t: number;
  truck5t: number;
  ladder: number;
  /** 사다리차 위치 표기 — 예) "출발지·도착지" */
  ladderWhere?: string;
  workers: number;
  kitchenStaff: number;
  /** 보관 정보 한 줄 (없으면 생략) */
  storageText?: string;
  /** 켜 둔 옵션 — 화면과 같게 "이름 · 금액" */
  options?: string[];
  memo?: string;
  totalText: string;
  /** 견적서 공유 주소 (있으면 마지막에 붙습니다) */
  shareUrl?: string;
}

/**
 * 고객에게 보낼 견적 문자 내용.
 * 화면의 「이사 정보」와 글자 그대로 같게 맞춰, 문자로 받아도 내용이 달라지지 않습니다.
 */
export function buildEstimateMessage(e: EstimateSmsInput): string {
  const lines: string[] = [
    `[JIMPICK 이사 견적]`,
    ``,
    `👤 ${e.customerName || "이름 미입력"} · ${e.phone || "연락처 미입력"}`,
    `📅 ${e.moveDateText}`,
    `🚚 ${e.moveType}`,
    `출발: ${e.fromAddress}`,
    `도착: ${e.toAddress}`,
    `실거리 ${e.distanceKm}km${e.durationMin ? ` · 약 ${e.durationMin}분` : ""} · ${e.workEnv} · ${e.fromFloor}층→${e.toFloor}층`,
    `1톤 ${e.truck1t} · 5톤 ${e.truck5t} · 사다리 ${e.ladder}${e.ladderWhere ? ` (${e.ladderWhere})` : ""}`,
    `작업 인원: 남자 ${e.workers}명 · 주방 ${e.kitchenStaff}명`,
  ];
  if (e.storageText) lines.push(e.storageText);
  for (const o of e.options ?? []) lines.push(`➕ ${o}`);
  if (e.memo) lines.push(`메모: ${e.memo}`);

  lines.push(``, `예상 견적 금액: ${e.totalText}`);
  if (e.shareUrl) lines.push(``, `자세한 내역: ${e.shareUrl}`);
  return lines.join("\n");
}
