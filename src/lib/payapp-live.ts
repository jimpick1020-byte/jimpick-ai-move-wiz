import { z } from "zod";

export const PAYAPP_PRICE = 30000;
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
  while (Date.parse(candidate(months)) <= Date.parse(paid)) months++;
  return candidate(months);
}
export function payappReadiness(env: Record<string, string | undefined>, now = new Date()) {
  const issues: string[] = [];
  if (["PAYAPP_USER_ID","PAYAPP_LINK_KEY","PAYAPP_LINK_VALUE","PAYAPP_REQUEST_KEY"].some(k => !env[k])) issues.push("페이앱 필수 연동 정보가 누락되어 있습니다.");
  if (env.PAYAPP_REBILL_APPROVED !== "true") issues.push("승인 계정의 API 정기결제 이용 권한 확인이 필요합니다.");
  if (env.PAYAPP_MONTH_POLICY_CONFIRMED !== "true") issues.push("최초 승인일 기준 갱신·29~31일 말일 처리 정책 확인이 필요합니다.");
  const expire = env.PAYAPP_REBILL_EXPIRE ?? "";
  const validExpire = /^\d{4}-\d{2}-\d{2}$/.test(expire) && Number.isFinite(Date.parse(expire)) && new Date(expire).toISOString().slice(0,10) === expire;
  if (!validExpire || expire <= kstStamp(now).slice(0,8).replace(/(\d{4})(\d{2})(\d{2})/,"$1-$2-$3")) issues.push("페이앱이 허용하는 정기결제 만료일 설정이 필요합니다.");
  return { ready: issues.length === 0, issues };
}
export const payappNoticeSchema = z.object({
  userid: z.string().min(1).max(200), linkkey: z.string().min(1).max(500), linkval: z.string().min(1).max(500),
  responsedate: z.string().regex(/^\d{14}$/), hash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  var1: z.string().uuid(), var2: z.string().uuid(), rebill_no: z.string().regex(/^\d+$/).max(100),
  mul_no: z.string().regex(/^\d+$/).max(100), price: z.coerce.number().int().refine(n => n === PAYAPP_PRICE),
  pay_state: z.enum(["1","4","8","32","9","64","10","70","71","99"]), pay_date: z.string().max(30).optional(),
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