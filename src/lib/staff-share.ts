/**
 * 직원용 카카오톡 공유 — 화면(브라우저)에서 쓰는 타입과 도우미.
 *
 * - 카카오톡 공유는 Kakao JavaScript SDK의 Kakao.Share.sendDefault 를 씁니다.
 * - 카카오톡이 없거나 실패하면 navigator.share → 링크 복사 순서로 대체합니다.
 * - 공유창을 연 것은 「전달 완료」가 아닙니다. 화면 문구도 그렇게 씁니다.
 */
import { getKakaoJsKey } from "./kakao.functions";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Kakao?: any;
  }
}

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
  rooms: { name: string; items: { name: string; qty: number }[] }[];
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
  sheetNo?: string;
  moveDate?: string;
  moveTime?: string;
  customerName?: string;
  customerPhone?: string;
  fromAddress?: string;
  fromEnv?: string;
  toAddress?: string;
  toEnv?: string;
  truckText?: string;
  moveType?: string;
  rooms?: { name: string; items: { name: string; qty: number }[] }[];
  options?: string[];
  extraWork?: string[];
  ladderFeeText?: string;
  specialTerms?: string;
  totalText?: string;
  staffName?: string;
  url?: string;
}

/** 공유 시점의 실제 견적정보로 카카오톡 본문을 만듭니다 (빈 항목은 줄 자체를 생략) */
export function buildStaffKakaoLines(v: StaffKakaoInput): string[] {
  const out: string[] = [];
  const add = (label: string, value?: string) => {
    const t = (value ?? "").trim();
    if (t) out.push(`${label} ${t}`);
  };
  add("견적번호", v.sheetNo);
  add("이사일", [v.moveDate, v.moveTime].filter(Boolean).join(" "));
  add("고객", v.customerName);
  add("고객 연락처", v.customerPhone);
  add("출발지", v.fromAddress);
  add("출발지 조건", v.fromEnv);
  add("도착지", v.toAddress);
  add("도착지 조건", v.toEnv);
  add("차량", v.truckText);
  add("이사 유형", v.moveType);
  for (const r of v.rooms ?? []) {
    if (!r.items.length) continue;
    out.push(`[${r.name}] ${r.items.map((i) => `${i.name} ${i.qty}`).join(", ")}`);
  }
  add("추가 옵션", (v.options ?? []).join(" · "));
  add("추가 작업", (v.extraWork ?? []).join(" · "));
  add("사다리차 비용", v.ladderFeeText);
  add("특약사항", v.specialTerms);
  add("총 견적금액", v.totalText);
  add("담당자", v.staffName);
  add("상세보기", v.url);
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

let sdkPromise: Promise<boolean> | null = null;

/** Kakao JavaScript SDK 로드 + 초기화 */
export async function loadKakaoShareSdk(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Kakao?.isInitialized?.()) return true;
  if (sdkPromise) return sdkPromise;

  sdkPromise = (async () => {
    let key = (import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY as string | undefined) ?? "";
    if (!key) {
      // 지도용으로 등록해 둔 JavaScript 키를 그대로 씁니다 (같은 키입니다)
      try {
        key = (await getKakaoJsKey()).key ?? "";
      } catch {
        key = "";
      }
    }
    if (!key) throw new Error("missing kakao javascript key");

    if (!window.Kakao) {
      let script = document.querySelector<HTMLScriptElement>("script[data-kakao-share-sdk]");
      if (!script) {
        script = document.createElement("script");
        script.dataset.kakaoShareSdk = "1";
        script.async = true;
        script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
        script.integrity = "sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4";
        script.crossOrigin = "anonymous";
        const done = new Promise<void>((resolve, reject) => {
          script!.onload = () => resolve();
          script!.onerror = () => reject(new Error("kakao sdk load failed"));
        });
        document.head.appendChild(script);
        await done;
      } else {
        for (let i = 0; i < 40 && !window.Kakao; i++) await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!window.Kakao) throw new Error("kakao sdk missing");
    if (!window.Kakao.isInitialized()) window.Kakao.init(key);
    return true;
  })().catch((err) => {
    console.error("[staff-share] 카카오 SDK 준비 실패:", err);
    sdkPromise = null;
    return false;
  });

  return sdkPromise;
}

export type ShareMethod = "kakao" | "web_share" | "copy_link";

/** 카카오톡 공유창 열기 → 실패 시 navigator.share → 링크 복사 */
export async function shareToKakao(
  card: StaffShareCard,
): Promise<{ ok: boolean; method: ShareMethod; error?: string }> {
  const lines =
    card.lines && card.lines.length > 0
      ? card.lines
      : [
          `견적번호 ${card.sheetNo || "-"}`,
          `이사일 ${card.moveDate || "미정"}`,
          `고객 ${card.maskedCustomer}`,
          `${card.fromArea} → ${card.toArea}`,
          `${card.truckText || "차량 미정"} · ${card.moveType}`,
          `담당 ${card.staffName || "-"}`,
        ];

  const ready = await loadKakaoShareSdk();
  if (ready) {
    try {
      window.Kakao.Share.sendDefault({
        objectType: "text",
        text: `짐픽 직원용 이사정보\n\n${lines.join("\n")}`,
        link: { mobileWebUrl: card.url, webUrl: card.url },
        buttonTitle: "직원용 견적서 확인",
      });
      return { ok: true, method: "kakao" };
    } catch (err) {
      console.error("[staff-share] 카카오톡 공유 실패:", err);
    }
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: "짐픽 직원용 이사정보",
        text: lines.join("\n"),
        url: card.url,
      });
      return { ok: true, method: "web_share" };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      if (aborted) return { ok: false, method: "web_share", error: "공유를 취소했습니다." };
    }
  }

  try {
    await navigator.clipboard.writeText(card.url);
    return { ok: true, method: "copy_link" };
  } catch {
    return {
      ok: false,
      method: "copy_link",
      error: "카카오톡 공유와 링크 복사가 모두 되지 않았습니다.",
    };
  }
}
