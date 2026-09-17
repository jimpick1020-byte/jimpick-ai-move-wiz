/**
 * 일시적인 통신 오류만 다시 시도합니다 (최대 3회, 점점 간격을 늘려서).
 *
 * 안전 규칙:
 *  - 인터넷 끊김 / 서버 일시 오류(5xx, 408, 429)만 다시 시도합니다.
 *  - 잘못된 요청(4xx), 권한 없음, 한도 초과 등은 다시 시도하지 않고 실제 오류를 그대로 알려 줍니다.
 *  - 문자·결제처럼 중복되면 안 되는 요청은 같은 idempotency key 로만 재시도합니다
 *    (키가 없으면 재시도하지 않습니다).
 */
export interface RetryResult<T> {
  ok: boolean;
  data?: T;
  /** 사용자에게 보여 줄 실제 오류 메시지 (성공으로 꾸미지 않습니다) */
  error?: string;
  attempts: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 다시 시도해도 되는 일시적 오류인지 판단합니다 */
export function isTransient(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err instanceof Response) return err.status >= 500 || [408, 429].includes(err.status);
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/\b(4\d\d)\b/.test(msg) && !/\b(408|429)\b/.test(msg)) return false;
  return /failed to fetch|network|networkerror|timeout|시간이 초과|일시|econn|fetch failed|503|502|504|500/i.test(
    msg,
  );
}

export async function withRetry<T>(
  run: (attempt: number) => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; retryable?: (e: unknown) => boolean } = {},
): Promise<RetryResult<T>> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 400;
  const retryable = opts.retryable ?? isTransient;
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const data = await run(attempt);
      return { ok: true, data, attempts: attempt };
    } catch (e) {
      lastError = e;
      if (attempt === retries || !retryable(e)) break;
      // 지수 백오프(0.4s → 0.8s → 1.6s)에 약간의 흔들림을 더해 동시에 몰리지 않게 합니다.
      await sleep(base * 2 ** (attempt - 1) + Math.floor(Math.random() * 150));
    }
  }
  return {
    ok: false,
    error:
      lastError instanceof Response
        ? `서버 오류 (${lastError.status})`
        : lastError instanceof Error
          ? lastError.message
          : "알 수 없는 오류가 발생했습니다",
    attempts: retries,
  };
}
