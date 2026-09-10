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
  ...BANKS,
]);

function cleanNumber(s: string): number {
  const n = Number(s.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** 은행 입금알림 문자 한 통을 읽어 냅니다 */
export function parseDepositSms(rawInput: string): ParsedDeposit {
  const raw = String(rawInput ?? "");
  const text = raw.replace(/\u00a0/g, " ").trim();
  const compact = text.replace(/\[Web발신\]|\[web발신\]/g, " ");

  const looksLikeDeposit = /입금|이체|받음|received/i.test(compact);

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
  let depositedAt: string | null = null;
  const now = new Date();
  const md = compact.match(/(\d{1,2})[\/\.\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  const ymd = compact.match(/(20\d{2})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  try {
    if (ymd) {
      const d = new Date(
        Number(ymd[1]),
        Number(ymd[2]) - 1,
        Number(ymd[3]),
        Number(ymd[4] ?? 0),
        Number(ymd[5] ?? 0),
      );
      if (!Number.isNaN(d.getTime())) depositedAt = d.toISOString();
    } else if (md) {
      const d = new Date(
        now.getFullYear(),
        Number(md[1]) - 1,
        Number(md[2]),
        Number(md[3] ?? 0),
        Number(md[4] ?? 0),
      );
      // 12월 문자를 1월에 붙여 읽는 경우를 막습니다
      if (!Number.isNaN(d.getTime())) {
        if (d.getTime() - now.getTime() > 1000 * 60 * 60 * 24 * 2) d.setFullYear(now.getFullYear() - 1);
        depositedAt = d.toISOString();
      }
    }
  } catch {
    depositedAt = null;
  }

  // ── 입금자 이름 ──
  // 한글 2~5자 낱말 중, 은행·거래 용어가 아닌 것을 이름으로 봅니다.
  let depositorName = "";
  const afterDeposit = compact.match(/입금\s*[0-9,\.]*\s*원?\s*([가-힣]{2,5})/);
  const beforeDeposit = compact.match(/([가-힣]{2,5})\s*(?:님)?\s*[0-9,\.]*\s*원?\s*입금/);
  const cand = (afterDeposit?.[1] ?? beforeDeposit?.[1] ?? "").trim();
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
  depositorName = depositorName.replace(/님$/, "");

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
