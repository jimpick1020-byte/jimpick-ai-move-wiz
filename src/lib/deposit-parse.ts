/**
 * 은행 입금알림 문자에서 입금자 이름·금액·시각을 읽어 냅니다.
 *
 * 브라우저와 서버 양쪽에서 쓸 수 있는 순수 계산 코드입니다.
 * 은행마다 문구가 조금씩 달라서, 흔한 형태를 넓게 받아들이도록 만들었습니다.
 */

export interface ParsedDeposit {
  /** 입금자 이름 (못 읽으면 빈 값) */
  depositorName: string;
  /** 입금 금액 (원). 못 읽으면 0 */
  amount: number;
  /** 입금 시각 (ISO). 못 읽으면 null */
  depositedAt: string | null;
  /** 은행 이름 (읽히면) */
  bank: string;
  /** 원문 그대로 */
  raw: string;
  /** 입금(입금/이체) 문자로 보이는지 */
  looksLikeDeposit: boolean;
}

const BANKS = [
  "국민","KB","신한","우리","하나","농협","NH","기업","IBK","카카오뱅크","카카오","케이뱅크",
  "토스뱅크","토스","새마을","신협","부산","대구","경남","광주","전북","제주","산업","SC",
  "씨티","우체국","저축은행","수협",
];

/** 이름이 아닌, 문자에 늘 붙는 낱말들 */
const STOP = new Set([
  "입금","출금","이체","잔액","잔고","거래","통장","계좌","원","웹발신","발신","확인","승인",
  "누적","한도","송금","자동","현금","체크","카드","결제","취소","합계","금액","수수료","은행",
  "잔액조회","보통예금","기업자유","예금","적금","알림","안내","네이버","페이","머니",
  // 문자 전달 앱이 본문 앞에 붙이는 앱 이름(「메시지」 등)은 사람 이름이 아닙니다.
  "메시지","문자","문자메시지",
  ...BANKS,
]);

function cleanNumber(s: string): number {
  const n = Number(s.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** 은행 입금알림 문자 한 통을 읽어 냅니다 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 한국시간 연·월·일·시·분을 실제 시각(ISO)으로 바꿉니다. 없는 날짜면 null */
function kstIso(y: number, mo: number, d: number, h: number, mi: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const t = Date.UTC(y, mo - 1, d, h, mi) - KST_OFFSET_MS;
  const back = new Date(t + KST_OFFSET_MS);
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return new Date(t).toISOString();
}

/** 문자 속 날짜(한국시간)를 읽습니다. 계좌번호 조각은 날짜로 보지 않습니다. */
export function parseKstDate(text: string, nowMs: number = Date.now()): string | null {
  const ymd = text.match(/(?<![\d\-*])(20\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})(?![\d\-*])(?:\s+(\d{1,2}):(\d{2}))?/);
  if (ymd) return kstIso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]), Number(ymd[4] ?? 0), Number(ymd[5] ?? 0));
  const md = text.match(/(?<![\d\-*])(\d{1,2})[.\-\/](\d{1,2})(?![\d\-*,])(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!md) return null;
  const nowYear = new Date(nowMs + KST_OFFSET_MS).getUTCFullYear();
  let iso = kstIso(nowYear, Number(md[1]), Number(md[2]), Number(md[3] ?? 0), Number(md[4] ?? 0));
  // 12월 문자를 1월에 받는 경우처럼 미래 날짜가 되면 작년으로 봅니다
  if (iso && Date.parse(iso) - nowMs > 1000 * 60 * 60 * 24 * 2) {
    iso = kstIso(nowYear - 1, Number(md[1]), Number(md[2]), Number(md[3] ?? 0), Number(md[4] ?? 0));
  }
  return iso;
}

export function parseDepositSms(rawInput: string, nowMs: number = Date.now()): ParsedDeposit {
  const raw = String(rawInput ?? "");
  // 전달 앱이 문자를 JSON({"sender":"메시지","body":"..."})으로 감싸 보낸 경우 본문만 꺼냅니다.
  // 보이지 않는 방향 제어 문자(⁦⁩ 등)도 제거합니다.
  let text = raw.replace(/ /g, " ").replace(/[⁦-⁩‪-‮]/g, "").trim();
  if (text.startsWith("{")) {
    try {
      const b = JSON.parse(text) as Record<string, unknown>;
      const inner = b["text"] ?? b["message"] ?? b["body"] ?? b["content"];
      if (typeof inner === "string" && inner.trim()) text = inner.trim();
    } catch { /* JSON이 아니면 원문 그대로 씁니다 */ }
  }
  const compact = text.replace(/\[Web발신\]|\[web발신\]/g, " ");

  const looksLikeDeposit = /입금|이체|받음|보냈어요|보냈습니다|received/i.test(compact) && !/출금|결제|승인/.test(compact);

  // ── 금액 ──
  // 「입금」 바로 앞뒤에 붙은 숫자를 가장 믿고, 없으면 '원'이 붙은 숫자를 씁니다.
  let amount = 0;
  const near =
    compact.match(/입금\s*[:\-]?\s*([0-9][0-9,\.]*)\s*원?/) ??
    compact.match(/([0-9][0-9,\.]*)\s*원?\s*입금/);
  if (near) amount = cleanNumber(near[1] ?? "");
  if (!amount) {
    const wons = [...compact.matchAll(/([0-9][0-9,\.]*)\s*원/g)].map((m) => cleanNumber(m[1] ?? ""));
    // 잔액이 함께 적힌 문자도 많아서, 가장 큰 값이 아니라 첫 번째 값을 씁니다.
    if (wons.length) amount = wons[0] ?? 0;
  }
  if (!amount) {
    const anyNum = [...compact.matchAll(/([0-9]{1,3}(?:,[0-9]{3})+)/g)].map((m) =>
      cleanNumber(m[1] ?? ""),
    );
    if (anyNum.length) amount = anyNum[0] ?? 0;
  }

  // ── 은행 ──
  const bank = BANKS.find((b) => compact.includes(b)) ?? "";

  // ── 시각 ──
  // 은행 문자의 날짜·시각은 한국시간입니다. 서버(UTC)에서도 같은 결과가 나오도록 한국시간으로 계산합니다.
  // 계좌번호(302-****-1642-11)의 숫자 조각을 날짜로 읽지 않도록 앞뒤가 숫자·-·*인 경우는 제외합니다.
  const depositedAt = parseKstDate(compact, nowMs);

  // ── 입금자 이름 ──
  // 한글 2~5자 낱말 중, 은행·거래 용어가 아닌 것을 이름으로 봅니다.
  let depositorName = "";
  const afterDeposit = compact.match(/입금\s*[0-9,\.]*\s*원?\s*([가-힣]{2,5})/);
  const beforeDeposit = compact.match(/([가-힣]{2,5})\s*(?:님)?\s*[0-9,\.]*\s*원?\s*입금/);
  // 「… 윤창익 잔액728,375원」처럼 잔액 바로 앞의 낱말도 입금자 이름인 경우가 많습니다.
  const beforeBalance = compact.match(/([가-힣]{2,5})\s*(?:님)?\s*잔액/);
  const cand = (afterDeposit?.[1] ?? beforeDeposit?.[1] ?? beforeBalance?.[1] ?? "").trim();
  if (cand && !STOP.has(cand)) depositorName = cand;
  if (!depositorName) {
    const words = [...compact.matchAll(/[가-힣]{2,5}/g)].map((m) => m[0]);
    depositorName =
      words.find(
        (w) =>
          !STOP.has(w) &&
          !BANKS.some((b) => w.includes(b)) &&
          !/입금|출금|잔액|이체|계좌|통장|거래|은행/.test(w),
      ) ?? "";
  }
  depositorName = depositorName.replace(/님(이|께서)?$/, "");

  return { depositorName, amount, depositedAt, bank, raw, looksLikeDeposit };
}

/** 사람 이름을 비교하기 좋게 다듬습니다 (공백·괄호·호칭 제거) */
export function normalizeName(s: string): string {
  return String(s ?? "")
    .replace(/\(.*?\)/g, "")
    .replace(/[\s·.\-_]/g, "")
    .replace(/(님|사장님|고객님)$/g, "")
    .trim();
}

/** 입금자 이름이 견적서의 고객 이름과 같은 사람으로 보이는지 */
export function isSameName(depositor: string, customer: string): boolean {
  const a = normalizeName(depositor);
  const b = normalizeName(customer);
  if (!a || !b) return false;
  return a === b;
}
