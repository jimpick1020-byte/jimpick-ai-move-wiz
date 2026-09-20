/**
 * 직원용 카카오톡 공유 — 화면(브라우저)에서 쓰는 타입과 도우미.
 *
 * - 카카오톡 공유는 Kakao JavaScript SDK의 Kakao.Share.sendDefault 를 씁니다.
 * - 카카오톡이 없거나 실패하면 navigator.share → 링크 복사 순서로 대체합니다.
 * - 공유창을 연 것은 「전달 완료」가 아닙니다. 화면 문구도 그렇게 씁니다.
 */
import {
  ensureKakaoSdk,
  shareLinkCardToKakao,
  type KakaoShareCode,
  type ShareMethod,
} from "./kakao-share";


/** 직원 업무용 화면에 그리는 내용 (금액은 넣지 않습니다) */
export interface StaffSheetSnapshot {
  sheetNo?: string;
  customerName: string;
  customerPhone: string;
  moveDate: string;
  moveTime: string;
  moveType: string;
  fromAddress: string;
  fromDetail: string;
  toAddress: string;
  toDetail: string;
  fromFloor: number;
  toFloor: number;
  workEnv: string;
  /** 출발지·도착지 작업 조건 (층수 · 엘리베이터 · 사다리차) */
  fromEnv?: string;
  toEnv?: string;
  /** 추가 옵션 이름 (금액 없이) */
  options?: string[];
  /** 특약사항 */
  specialTerms?: string;
  truckText: string;
  distanceKm: number;
  durationMin: number;
  /** 추가 작업 (켠 것만, 금액 없이 이름만) */
  extraWork: string[];
  /** 현장 안내사항 */
  note: string;
  staffName: string;
  staffPhone: string;
  rooms: {
    name: string;
    items: { id?: string; name: string; qty: number; icon?: string }[];
  }[];
}

/** 카카오톡 미리보기에 넣는 값 (민감정보 없음) */
export interface StaffShareCard {
  sheetNo: string;
  moveDate: string;
  maskedCustomer: string;
  fromArea: string;
  toArea: string;
  truckText: string;
  moveType: string;
  staffName: string;
  url: string;
  /** 카카오톡에 실제로 보낼 본문 줄 (없으면 기본 요약을 씁니다) */
  lines?: string[];
}

/** 직원 카카오톡 본문에 넣을 실제 이사정보 — 값이 없는 줄은 넣지 않습니다 */
export interface StaffKakaoInput {
  customerName?: string;
  customerPhone?: string;
  /** "2026년 9월 26일 오전 08:00" 처럼 이미 만들어 둔 문구 */
  moveDateText?: string;
  moveType?: string;
  fromAddress?: string;
  fromEnv?: string;
  toAddress?: string;
  toEnv?: string;
  distanceKm?: number;
  durationMin?: number;
  truckText?: string;
  /** "1대(도착지)" */
  ladderText?: string;
  workers?: number;
  kitchenStaff?: number;
  /** "정수기냉장고 · 120,000원" 형태의 추가 품목 줄 */
  extraItems?: string[];
  memo?: string;
  url?: string;
}

/** 화면의 「이사 정보」 카드와 같은 순서·같은 데이터로 카카오톡 본문을 만듭니다 */
export function buildStaffKakaoLines(v: StaffKakaoInput): string[] {
  const out: string[] = [];
  const add = (label: string, value?: string) => {
    const t = (value ?? "").trim();
    if (t) out.push(`${label}: ${t}`);
  };
  add("고객", v.customerName);
  add("연락처", v.customerPhone);
  add("이사일", v.moveDateText);
  add("이사 유형", v.moveType);
  add("출발지", v.fromAddress);
  add("출발지 조건", v.fromEnv);
  add("도착지", v.toAddress);
  add("도착지 조건", v.toEnv);
  if (v.distanceKm && v.distanceKm > 0) add("이동 거리", `${v.distanceKm}km`);
  if (v.durationMin && v.durationMin > 0) add("예상 시간", `약 ${v.durationMin}분`);
  add("차량", v.truckText);
  add("사다리차", v.ladderText);
  const staff = [
    v.workers && v.workers > 0 ? `남자 ${v.workers}명` : "",
    v.kitchenStaff && v.kitchenStaff > 0 ? `주방 ${v.kitchenStaff}명` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  add("작업 인원", staff);
  add("추가 품목", (v.extraItems ?? []).filter(Boolean).join(" / "));
  add("고객 메모", v.memo);
  add("견적서 확인", v.url);
  return out;
}


/** 김보경 → 김*경 처럼 이름 일부를 가립니다 */
export function maskName(name: string): string {
  const n = (name ?? "").trim();
  if (!n) return "고객";
  if (n.length <= 1) return n;
  if (n.length === 2) return `${n[0]}*`;
  return `${n[0]}${"*".repeat(n.length - 2)}${n[n.length - 1]}`;
}

/** "서울특별시 강남구 …" → "서울 강남구" 처럼 지역만 남깁니다 */
export function areaOf(address: string): string {
  const parts = (address ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "미정";
  const si = parts[0]
    .replace("특별자치도", "")
    .replace("특별시", "")
    .replace("광역시", "")
    .replace("자치도", "")
    .replace(/도$/, "");
  return [si, parts[1]].filter(Boolean).join(" ");
}

/**
 * Kakao JavaScript SDK 로드 + 1회 초기화 (공통 모듈 kakao-share.ts 사용)
 */
export async function loadKakaoShareSdk(): Promise<boolean> {
  const r = await ensureKakaoSdk();
  return r.ok;
}

export type { ShareMethod };

/**
 * 직원용 업무지시서 공유 — 카카오톡에는 링크 카드 한 개만 보냅니다.
 * (긴 노란색 텍스트 메시지는 보내지 않습니다. 실제 작업 내용은 링크를 열어 봅니다.)
 */
export async function shareToKakao(
  card: StaffShareCard,
): Promise<{ ok: boolean; method: ShareMethod; error?: string; code?: KakaoShareCode }> {
  return shareLinkCardToKakao({
    title: "JIMPICK 직원용 작업 지시서",
    description: "현장 작업에 필요한 이사 정보를 확인하세요.",
    url: card.url,
    buttonTitle: "작업 지시서 보기",
  });
}
