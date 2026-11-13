import { z } from "zod";

export const PAYAPP_PRICE = 30000;
export function payappKstDate(at: string | Date) {
  return kstStamp(new Date(at)).slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
}
// Merchant answer confirms date-only, exclusive expiry; service chooses five years.
export function payappRegistrationQuote(now = new Date()) {
  const requestDate = payappKstDate(now);
  const [year, month, day] = requestDate.split("-").map(Number);
  const last = new Date(Date.UTC(year + 5, month, 0)).getUTCDate();
  const expire = new Date(Date.UTC(year + 5, month - 1, Math.min(day, last))).toISOString().slice(0, 10);
  return { requestDate, expire, day, amount: PAYAPP_PRICE };
}
export function payappPendingReusable(order: { status: string; created_at: string; request_date?: string | null; first_paid_at?: string | null }, now = new Date()) {
  return order.status === "pending" && !order.first_paid_at && (order.request_date ?? payappKstDate(order.created_at)) === payappKstDate(now);
}
export function payappFirstApprovalMatches(order: { request_date?: string | null; created_at: string; first_paid_at: string | null }, paid: string) {
  return (order.request_date ?? payappKstDate(order.created_at)) === payappKstDate(order.first_paid_at ?? paid);
}
export function payappBillingSchedule(order: { rebill_expire?: string | null; canceled_at?: string | null }, next: string | null, now = new Date()) {
  const expired = Boolean(order.rebill_expire && payappKstDate(now) >= order.rebill_expire);
  const needsReregistration = expired || Boolean(order.rebill_expire && next && payappKstDate(next) >= order.rebill_expire);
  return { expired, needsReregistration, nextBillingAt: !needsReregistration && !order.canceled_at ? next : null };
}
// The public rebillRegist table does not identify a same-day validity field.
// Do not turn this on from a general month-policy flag or invent a parameter.
export const PAYAPP_SAME_DAY_VALIDITY_VERIFIED = false;
export function kstStamp(at: Date) {
  return new Date(at.getTime() + 9 * 3600000).toISOString().slice(0, 19).replace(/\D/g, "");
}
export function payappDate(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) throw new Error("Invalid provider date");
  const iso = `${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6,8)}T${digits.slice(8,10)}:${digits.slice(10,12)}:${digits.slice(12,14)}+09:00`;
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime()) || kstStamp(at) !== digits) throw new Error("Invalid provider date");
  return at.toISOString();
}
// Always calculate against the original KST anchor, never a previously clamped February date.
export function payappNextDate(first: string, paid: string) {
  const anchor = new Date(Date.parse(first) + 9 * 3600000);
  const current = new Date(Date.parse(paid) + 9 * 3600000);
  if (!Number.isFinite(anchor.getTime()) || !Number.isFinite(current.getTime())) throw new Error("Invalid date");
  let months = Math.max(1, (current.getUTCFullYear()-anchor.getUTCFullYear())*12 + current.getUTCMonth()-anchor.getUTCMonth());
  const candidate = (offset: number) => {
    const d = new Date(anchor); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+offset);
    const last = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
    d.setUTCDate(Math.min(anchor.getUTCDate(),last));
    return new Date(d.getTime()-9*3600000).toISOString();
  };
  // A renewal consumes the entire KST calendar anniversary, even when approved
  // before the first payment's clock time. This is entitlement math, not a
  // claim about the provider's (still unconfirmed) charge scheduling policy.
  while (kstStamp(new Date(candidate(months))).slice(0, 8) <= kstStamp(new Date(paid)).slice(0, 8)) months++;
  return candidate(months);
}
export function payappReadiness(env: Record<string, string | undefined>, now = new Date()) {
  const issues: string[] = [];
  if (["PAYAPP_USER_ID","PAYAPP_LINK_KEY","PAYAPP_LINK_VALUE","PAYAPP_REQUEST_KEY"].some(k => !env[k])) issues.push("페이앱 필수 연동 정보가 누락되어 있습니다.");
  if (env.PAYAPP_MONTH_POLICY_CONFIRMED !== "true") issues.push("카드 29~31일의 짧은 달 결제일과 다음 달 원래 날짜 복원 정책 확인이 필요합니다.");
  if (!PAYAPP_SAME_DAY_VALIDITY_VERIFIED) issues.push("정기결제 요청의 당일 유효기간 설정과 API 적용범위 확인이 필요합니다.");
  return { ready: issues.length === 0, issues, quote: payappRegistrationQuote(now) };
}
export const payappNoticeSchema = z.object({
  userid: z.string().min(1).max(200), linkkey: z.string().min(1).max(500), linkval: z.string().min(1).max(500),
  responsedate: z.string().regex(/^\d{14}$/), hash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  var1: z.string().uuid(), var2: z.string().uuid(), rebill_no: z.string().regex(/^\d+$/).max(100),
  mul_no: z.string().regex(/^\d+$/).max(100), price: z.coerce.number().int().positive().max(PAYAPP_PRICE),
  orig_mul_no: z.string().regex(/^\d+$/).max(100).optional(),
  orig_price: z.coerce.number().int().positive().max(PAYAPP_PRICE).optional(),
  pay_state: z.enum(["1","4","8","32","9","64","10","70","71","99"]), pay_date: z.string().max(30).optional(),
}).superRefine((n, ctx) => {
  const partial = n.pay_state === "70" || n.pay_state === "71";
  if (partial ? !n.orig_mul_no || n.orig_price !== PAYAPP_PRICE || n.price >= PAYAPP_PRICE : n.price !== PAYAPP_PRICE || n.orig_mul_no !== undefined || n.orig_price !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Payment amount/reference mismatch" });
  }
});
export type PayappNotice = z.infer<typeof payappNoticeSchema>;
export async function sha256(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))), n => n.toString(16).padStart(2,"0")).join("");
}
async function equalSecret(a: string, b: string) {
  const [x,y] = await Promise.all([sha256(a),sha256(b)]);
  let diff = 0; for (let i=0;i<x.length;i++) diff |= x.charCodeAt(i)^y.charCodeAt(i);
  return diff === 0;
}
export async function authenticatePayappNotice(input: unknown, env: Record<string,string|undefined>, now = Date.now()): Promise<PayappNotice> {
  const n = payappNoticeSchema.parse(input);
  const { PAYAPP_USER_ID: user, PAYAPP_LINK_KEY: key, PAYAPP_LINK_VALUE: value, PAYAPP_REQUEST_KEY: request } = env;
  if (!user || !key || !value || !request) throw new Error("Callback configuration unavailable");
  if (Math.abs(Date.parse(payappDate(n.responsedate))-now)>900000) throw new Error("Expired notice");
  const checks = await Promise.all([equalSecret(n.userid,user),equalSecret(n.linkkey,key),equalSecret(n.linkval,value),equalSecret(n.hash.toLowerCase(),await sha256(user+n.responsedate+request))]);
  if (checks.some(ok => !ok)) throw new Error("Invalid notice");
  return n;
}
export function safePayappUrl(value: string) {
  const u = new URL(value);
  if (u.protocol !== "https:" || (u.hostname !== "payapp.kr" && !u.hostname.endsWith(".payapp.kr")) || u.username || u.password) throw new Error("Invalid payment URL");
  return u.toString();
}