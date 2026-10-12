/**
 * 고객 사전정보 링크 — 서버 전용 보안 도우미.
 *  - 조회는 SHA-256 해시로만 합니다 (원문 토큰은 찾는 데 쓰지 않습니다).
 *  - 사장님이 링크를 다시 복사·발송할 수 있게 원문은 서버 비밀키(AES-GCM)로 암호화해 둡니다.
 */
import { hashStaffToken, makeStaffToken } from "./staff-share.server";

export const makeIntakeToken = makeStaffToken;
export const hashIntakeToken = hashStaffToken;

async function key(): Promise<CryptoKey> {
  const raw = String(process.env["INTAKE_TOKEN_KEY"] ?? "");
  if (raw.length < 32) throw new Error("intake key missing");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptToken(token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(token)));
  return `${toB64(iv)}.${toB64(enc)}`;
}

export async function decryptToken(v: string | null | undefined): Promise<string | null> {
  if (!v) return null;
  try {
    const [iv, data] = v.split(".");
    const out = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, await key(), fromB64(data));
    return new TextDecoder().decode(out);
  } catch {
    return null;
  }
}

export function intakeLink(token: string): string {
  const base = String(process.env["PUBLIC_APP_URL"] || "https://jimpick-ai-move-wiz.lovable.app").trim().replace(/\/$/, "");
  return `${base}/intake/${token}`;
}

/** 견적 초안의 기본값 (기존 새 견적과 같은 모양) */
export function baseEstimate(id: string): Record<string, unknown> {
  return {
    id, createdAt: Date.now(), status: "작성중", customerName: "", phone: "", moveType: "포장이사",
    moveDate: "", moveTime: "", fromAddress: "", fromDetail: "", toAddress: "", toDetail: "",
    fromX: null, fromY: null, toX: null, toY: null, distanceKm: 0, durationMin: 0,
    workEnv: "엘리베이터", fromFloor: 1, toFloor: 1, workers: 2, kitchenStaff: 1, truck1t: 0, truck5t: 0,
    ladder: 0, ladderFrom: false, ladderTo: false, ladderFromPrice: 0, ladderToPrice: 0, ladderPrice: 0,
    ladderSeparate: false, ladderFromSeparate: false, ladderToSeparate: false, extraCharges: [], memo: "",
    specialTerms: "",
    rooms: ["안방", "작은방", "입구방", "거실", "부엌", "베란다"].map((n) => ({ id: `r_${n}`, name: n, items: {} })),
    sizeTab: "30~40평", customItems: [], hiddenItems: [], options: [], storageStart: "", storageEnd: "",
    storageDaily: 20000, storageEnabled: false, transportOverride: null, totalOverride: null, total: 0,
  };
}
