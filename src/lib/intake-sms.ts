import { normalizePhone, isSendablePhone } from "./sms";

/** Native composer URI only: no transport API or sending status updates. */
export function intakeSmsHref(phone: string, body: string): string {
  if (!isSendablePhone(phone)) throw new Error("고객 휴대전화 번호를 확인해 주세요.");
  return `sms:${normalizePhone(phone)}?body=${encodeURIComponent(body)}`;
}

/** Synchronous lock covers both async preparation and rapid repeated taps. */
export function createComposerGate(now: () => number = Date.now) {
  let pending = false;
  let lastOpened: number | null = null;
  return async (prepare: () => Promise<string | null>, open: (href: string) => void): Promise<boolean> => {
    if (pending || (lastOpened !== null && now() - lastOpened < 2000)) return false;
    pending = true;
    try {
      const href = await prepare();
      if (!href) return false;
      open(href);
      lastOpened = now();
      return true;
    } finally { pending = false; }
  };
}