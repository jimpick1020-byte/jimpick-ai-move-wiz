/**
 * 말한 문장에서 「고객 정보」를 뽑아 주는 해석기.
 *
 * 품목 해석(voice-parse.ts)과 달리, 여기서는
 * 고객명 · 연락처 · 날짜 · 시간 · 주소 · 층수 · 엘리베이터 · 사다리차 ·
 * 작업 인원 · 차량 톤수 · 메모를 찾아냅니다.
 *
 * 바로 넣지 않고, 화면에서 사장님이 확인·수정한 뒤 넣습니다.
 */
import type { Estimate, WorkEnv } from "./jimpick";

export interface VoiceField {
  /** 견적 데이터의 항목 이름 */
  key: keyof Estimate;
  /** 화면에 보여 줄 이름 */
  label: string;
  /** 넣을 값 */
  value: string | number | boolean;
  /** 글자로 보여 줄 값 */
  text: string;
  /** 말한 부분 그대로 */
  raw: string;
}

const KO_NUM: Record<string, number> = {
  한: 1, 하나: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 네: 4, 넷: 4,
  다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10,
};

/** "여섯" / "6" → 6 */
function num(s: string | undefined): number | null {
  if (!s) return null;
  const t = s.trim();
  if (/^\d+$/.test(t)) return Number(t);
  return KO_NUM[t] ?? null;
}

/** 말로 한 숫자 읽기 (공일공 → 010) */
const SPOKEN_DIGIT: Record<string, string> = {
  공: "0", 영: "0", 빵: "0", 일: "1", 이: "2", 삼: "3", 사: "4",
  오: "5", 육: "6", 칠: "7", 팔: "8", 구: "9",
};

function spokenDigits(text: string): string {
  return text.replace(/[공영빵일이삼사오육칠팔구]/g, (c) => SPOKEN_DIGIT[c] ?? c);
}

export function formatPhoneKo(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * 문장에서 찾을 수 있는 항목만 골라 돌려줍니다.
 * 찾지 못한 항목은 아예 넣지 않으므로, 기존 입력값이 지워지지 않습니다.
 */
export function parseEstimateVoice(text: string): VoiceField[] {
  const t = text.replace(/\s+/g, " ").trim();
  const out: VoiceField[] = [];
  const push = (f: VoiceField) => {
    if (!out.some((x) => x.key === f.key)) out.push(f);
  };

  // ---- 연락처 ----
  const phoneRaw =
    t.match(/(?:연락처|전화(?:번호)?|번호|핸드폰|휴대폰)[은는이가]?\s*([0-9공영빵일이삼사오육칠팔구\s-]{9,})/)?.[1] ??
    t.match(/(01[016789][\s-]?\d{3,4}[\s-]?\d{4})/)?.[1];
  if (phoneRaw) {
    const digits = spokenDigits(phoneRaw).replace(/\D/g, "");
    if (digits.length >= 10) {
      push({
        key: "phone",
        label: "연락처",
        value: formatPhoneKo(digits),
        text: formatPhoneKo(digits),
        raw: phoneRaw.trim(),
      });
    }
  }

  // ---- 고객명 ----
  const name =
    t.match(/(?:고객(?:명|\s*이름)?|성함|이름)[은는이가]?\s*([가-힣]{2,4})\s*(?:고객님|님|씨)?/)?.[1] ??
    t.match(/([가-힣]{2,4})\s*(?:고객님|님)\s*(?:이|으로|입니다|이에요|이고)?/)?.[1];
  if (name && !/^(고객|연락처|출발|도착|사다리|엘리베|메모)/.test(name)) {
    push({ key: "customerName", label: "고객명", value: name, text: name, raw: name });
  }

  // ---- 이사 날짜 ----
  const md = t.match(/(?:(\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일/);
  if (md) {
    const now = new Date();
    const y = md[1] ? Number(md[1]) : now.getFullYear();
    const value = `${y}-${pad(Number(md[2]))}-${pad(Number(md[3]))}`;
    push({ key: "moveDate", label: "이사 날짜", value, text: value, raw: md[0] });
  } else if (/내일/.test(t)) {
    const d = new Date(Date.now() + 86400000);
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    push({ key: "moveDate", label: "이사 날짜", value, text: value, raw: "내일" });
  }

  // ---- 시작 시간 ----
  const tm = t.match(/(오전|오후|아침|저녁)?\s*(\d{1,2}|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*시\s*(반|\d{1,2}\s*분)?/);
  if (tm) {
    const h = num(tm[2]);
    if (h && h >= 1 && h <= 12) {
      const ampm = tm[1] === "오후" || tm[1] === "저녁" ? "오후" : "오전";
      const minute = tm[3] ? (/반/.test(tm[3]) ? 30 : Number(tm[3].replace(/\D/g, ""))) : 0;
      const value = `${ampm} ${pad(h)}:${pad(Number.isFinite(minute) ? minute : 0)}`;
      push({ key: "moveTime", label: "시작 시간", value, text: value, raw: tm[0].trim() });
    }
  }

  // ---- 주소 ----
  const addr = (kw: RegExp) => {
    const m = t.match(kw);
    if (!m) return undefined;
    // 다음 구획(도착지/층/엘리베이터/사다리차/메모 등) 앞까지만 자릅니다
    return m[1]
      .split(/\s*(?:도착지|출발지|이고|이며|메모|엘리베이터|사다리차|작업\s*인원|차량|\d+\s*층)/)[0]
      .trim()
      .replace(/[,.]$/, "");
  };
  const from = addr(/(?:출발지|출발|기존\s*집|현재\s*집)[는은이가]?\s*(.+)/);
  if (from && from.length >= 4) {
    push({ key: "fromAddress", label: "출발지", value: from, text: from, raw: from });
  }
  const to = addr(/(?:도착지|도착|이사\s*갈\s*집|새\s*집)[는은이가]?\s*(.+)/);
  if (to && to.length >= 4) {
    push({ key: "toAddress", label: "도착지", value: to, text: to, raw: to });
  }

  // ---- 층수 ----
  const floorFrom = t.match(/출발(?:지)?[^.]{0,12}?(\d{1,2})\s*층/);
  if (floorFrom) {
    push({
      key: "fromFloor",
      label: "출발지 층수",
      value: Number(floorFrom[1]),
      text: `${floorFrom[1]}층`,
      raw: floorFrom[0],
    });
  }
  const floorTo = t.match(/도착(?:지)?[^.]{0,12}?(\d{1,2})\s*층/);
  if (floorTo) {
    push({
      key: "toFloor",
      label: "도착지 층수",
      value: Number(floorTo[1]),
      text: `${floorTo[1]}층`,
      raw: floorTo[0],
    });
  }
  if (!floorFrom && !floorTo) {
    const any = t.match(/(\d{1,2})\s*층/);
    if (any) {
      push({
        key: "fromFloor",
        label: "출발지 층수",
        value: Number(any[1]),
        text: `${any[1]}층`,
        raw: any[0],
      });
    }
  }

  // ---- 엘리베이터 · 계단 ----
  let env: WorkEnv | null = null;
  if (/엘리베이터|엘베/.test(t)) env = "엘리베이터";
  else if (/계단/.test(t)) env = "계단";
  if (env) {
    push({ key: "workEnv", label: "작업 방법", value: env, text: env, raw: env });
  }

  // ---- 사다리차 ----
  if (/사다리차|스카이/.test(t)) {
    const atTo = /도착[^.]{0,10}사다리차|사다리차[^.]{0,10}도착/.test(t);
    const atFrom = /출발[^.]{0,10}사다리차|사다리차[^.]{0,10}출발/.test(t);
    if (atTo) push({ key: "ladderTo", label: "도착지 사다리차", value: true, text: "사용", raw: "사다리차" });
    if (atFrom) push({ key: "ladderFrom", label: "출발지 사다리차", value: true, text: "사용", raw: "사다리차" });
    if (!atTo && !atFrom)
      push({ key: "ladder", label: "사다리차", value: 1, text: "1대", raw: "사다리차" });
  }

  // ---- 작업 인원 ----
  const workers = t.match(/(?:작업\s*인원|인원|남자|직원)\s*(\d{1,2}|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*명/);
  const w = num(workers?.[1]);
  if (w) {
    push({ key: "workers", label: "작업 인원", value: w, text: `${w}명`, raw: workers![0] });
  }
  const kitchen = t.match(/주방\s*(?:이모|인력|여자)?\s*(\d{1,2}|한|두|세|네)\s*명/);
  const k = num(kitchen?.[1]);
  if (k) {
    push({ key: "kitchenStaff", label: "주방 인원", value: k, text: `${k}명`, raw: kitchen![0] });
  }

  // ---- 차량 톤수 ----
  const t1 = t.match(/1\s*톤[^.]{0,6}?(\d{1,2}|한|두|세|네|다섯)\s*대/) ?? (/\b1\s*톤/.test(t) ? null : null);
  const n1 = num(t1?.[1]);
  if (n1) push({ key: "truck1t", label: "1톤 트럭", value: n1, text: `${n1}대`, raw: t1![0] });
  else if (/(?:^|\s)1\s*톤/.test(t))
    push({ key: "truck1t", label: "1톤 트럭", value: 1, text: "1대", raw: "1톤" });
  const t5 = t.match(/5\s*톤[^.]{0,6}?(\d{1,2}|한|두|세|네|다섯)\s*대/);
  const n5 = num(t5?.[1]);
  if (n5) push({ key: "truck5t", label: "5톤 트럭", value: n5, text: `${n5}대`, raw: t5![0] });
  else if (/(?:^|\s)5\s*톤/.test(t))
    push({ key: "truck5t", label: "5톤 트럭", value: 1, text: "1대", raw: "5톤" });

  // ---- 이사 종류 ----
  const type = t.match(/(포장이사|반포장이사|일반이사|보관이사|사무실이사)/);
  if (type) {
    push({ key: "moveType", label: "이사 종류", value: type[1], text: type[1], raw: type[1] });
  }

  // ---- 메모 ----
  const memo = t.match(/(?:메모|참고|특이사항|고객\s*메모)[는은:]?\s*(.+)$/);
  if (memo && memo[1].trim().length >= 2) {
    const value = memo[1].trim();
    push({ key: "memo", label: "고객 메모", value, text: value, raw: value });
  }

  return out;
}

/**
 * 이어 들은 말을 하나로 합칩니다.
 * 같은 문장이 다시 들어와도 두 번 붙지 않게 합니다.
 */
export function mergeTranscript(prev: string, next: string): string {
  const a = prev.trim();
  const b = next.trim();
  if (!b) return a;
  if (!a) return b;
  if (a.endsWith(b)) return a;
  // 겹치는 끝/앞부분을 찾아 이어 붙입니다
  const max = Math.min(a.length, b.length);
  for (let n = max; n >= 4; n--) {
    if (a.slice(-n) === b.slice(0, n)) return a + b.slice(n);
  }
  return `${a} ${b}`;
}
