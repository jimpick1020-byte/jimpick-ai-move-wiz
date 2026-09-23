/**
 * 알리고 문자 API 호출부.
 *
 * 이 파일은 키를 절대 밖으로 내보내지 않습니다.
 * 키는 process.env 에서만 읽고, 응답에도 담지 않습니다.
 */

/** 알리고 발송 주소 — SMS·LMS·MMS 모두 이 주소를 씁니다 */
const SEND_URL = "https://apis.aligo.in/send/";
const RESULT_URL = "https://apis.aligo.in/sms_list/";

/** 숫자만 남깁니다 */
export function digits(s) {
  return String(s || "").replace(/[^0-9]/g, "");
}

/**
 * 어떤 모양으로 적어도 01012345678 꼴로 바꿔 줍니다.
 *
 *   010-1234-5678   →  01012345678
 *   010 1234 5678   →  01012345678
 *   +82 10-1234-5678 → 01012345678   (국가번호를 0 으로 바꿉니다)
 *   0082101234 5678 →  01012345678
 */
export function normalizePhone(s) {
  let n = digits(s);
  if (n.startsWith("0082")) n = n.slice(4);
  else if (n.startsWith("82")) n = n.slice(2);
  else return n;
  // 국가번호를 뗐으면 앞에 0 을 다시 붙입니다 (82 10… → 010…)
  return n.startsWith("0") ? n : `0${n}`;
}

/** 국내 휴대폰 번호인지 */
export function isPhone(s) {
  return /^01[016789][0-9]{7,8}$/.test(normalizePhone(s));
}

/** 길이 판정이 확실하지 않으면 LMS로 보내 SMS 용량 초과를 방지합니다. */
export function pickMsgType(text, hasImage) {
  if (hasImage) return "MMS";
  return Buffer.byteLength(text, "utf8") > 90 ? "LMS" : "SMS";
}

/**
 * 알리고 오류를 쉬운 한국어로 바꿉니다.
 *
 * 알리고가 보낸 원래 문구도 함께 남깁니다.
 * 우리 번역이 틀릴 수 있어서, 진짜 이유를 가리지 않기 위해서입니다.
 */
export function aligoError(code, message) {
  const m = String(message || "").trim();
  // 실제로 알리고가 준 응답을 보고 맞춘 표입니다.
  // 확실하지 않은 번호는 넣지 않고, 알리고 원문을 그대로 보여 줍니다.
  const table = {
    "-101": "알리고 아이디 또는 API 키가 올바르지 않습니다.",
    "-102": "등록되지 않은 발신번호입니다. 알리고에서 발신번호 사전등록을 마쳐 주세요.",
    // 실제 확인: 잔액(보유건수)이 없을 때 -201 이 옵니다
    "-201": "문자 보유건수가 부족합니다. 알리고에서 충전해 주세요.",
    "-301": "허용되지 않은 IP 에서 요청했습니다. 알리고에 이 서버 IP 를 등록해 주세요.",
  };
  const mine = table[String(code)];
  const parts = [mine || "문자 발송에 실패했습니다."];
  if (m) parts.push(`알리고 안내: ${m}`);
  parts.push(`코드 ${code}`);
  return parts.join(" / ");
}

/**
 * 알리고로 문자를 보냅니다.
 *
 * @param {object} p
 * @param {string} p.to        받는 번호
 * @param {string} p.text      본문
 * @param {string} [p.title]   장문·MMS 제목
 * @param {{filename:string, contentType:string, data:Buffer}} [p.image] 붙일 그림
 * @param {boolean} [p.testMode] 참이면 실제로 보내지 않고 시험만 합니다
 */
export async function sendAligo({ to, text, title, image, testMode, sender }) {
  // 보관함에 넣을 때 끝에 줄바꿈이 딸려 들어가는 일이 있어 앞뒤를 떼고 씁니다
  const key = String(process.env.ALIGO_API_KEY ?? "").trim();
  const userId = String(process.env.ALIGO_USER_ID ?? "").trim();
  sender = String(sender ?? "").trim();

  const missing = [
    !key && "ALIGO_API_KEY",
    !userId && "ALIGO_USER_ID",
    !sender && "승인된 발신번호",
  ].filter(Boolean);
  if (missing.length) {
    return { ok: false, error: `문자 발송 설정이 필요합니다. (${missing.join(", ")} 미설정)` };
  }

  const receiver = normalizePhone(to);
  if (!isPhone(receiver)) {
    return { ok: false, error: "받는 번호 형식이 올바르지 않습니다." };
  }
  if (!String(text || "").trim()) {
    return { ok: false, error: "보낼 내용이 비어 있습니다." };
  }

  const msgType = pickMsgType(text, !!image);
  const testYn = testMode ? "Y" : "N";

  // MMS 는 파일을 함께 올려야 해서 multipart 로 보냅니다
  const form = new FormData();
  form.set("key", key);
  form.set("user_id", userId);
  form.set("sender", digits(sender));
  form.set("receiver", receiver);
  form.set("msg", text);
  form.set("msg_type", msgType);
  form.set("testmode_yn", testYn);
  // 링크만 보내는 고객 안내에는 LMS 제목도 붙이지 않습니다.
  if (msgType !== "SMS" && title) form.set("title", String(title).slice(0, 44));
  if (image) {
    form.set("image1", new Blob([image.data], { type: image.contentType }), image.filename);
  }

  let res;
  try {
    res = await fetch(SEND_URL, { method: "POST", body: form });
  } catch (e) {
    console.error("[aligo] network error", e?.message);
    return { ok: false, error: "네트워크 오류로 문자를 보내지 못했습니다." };
  }
  if (!res.ok) {
    return { ok: false, error: `문자 서버에 연결하지 못했습니다. (HTTP ${res.status})` };
  }

  let j;
  try {
    j = await res.json();
  } catch {
    return { ok: false, error: "문자 서버 응답을 읽지 못했습니다." };
  }

  const code = Number(j.result_code ?? -1);
  if (code !== 1) {
    // 키는 절대 남기지 않고, 무엇을 보냈는지·무엇을 받았는지만 기록합니다
    console.error("[aligo] fail", {
      code,
      message: j.message,
      sentReceiverLength: receiver.length,
      sentReceiverHead: receiver.slice(0, 3),
      senderLength: digits(sender).length,
      msgType,
      testYn,
      msgBytes: Buffer.byteLength(text, "utf8"),
    });
    return { ok: false, code, error: aligoError(code, j.message) };
  }

  return {
    ok: true,
    msgId: String(j.msg_id ?? ""),
    msgType: j.msg_type || msgType,
    successCount: Number(j.success_cnt ?? 0),
    testMode: !!testMode,
  };
}

/** 알리고 접수번호로 실제 전달 결과를 조회합니다. 조회 불가 시 전달 성공으로 추측하지 않습니다. */
export async function lookupAligo(mid) {
  const key = String(process.env.ALIGO_API_KEY ?? "").trim();
  const userId = String(process.env.ALIGO_USER_ID ?? "").trim();
  if (!key || !userId || !/^[a-zA-Z0-9_-]{1,100}$/.test(String(mid ?? ""))) {
    return { ok: false, state: "unknown", error: "발송번호 또는 조회 설정이 올바르지 않습니다." };
  }
  try {
    const form = new URLSearchParams({ key, user_id: userId, mid: String(mid) });
    const response = await fetch(RESULT_URL, { method: "POST", body: form, signal: AbortSignal.timeout(10000) });
    const data = await response.json().catch(() => null);
    if (!response.ok || Number(data?.result_code ?? -1) < 1 || !data?.list?.[0]) {
      return { ok: false, state: "unknown", error: "알리고 전달 결과를 아직 확인하지 못했습니다." };
    }
    const row = data.list[0];
    const stateText = String(row.sms_state ?? row.reserve_state ?? "").slice(0, 120);
    const fail = Number(row.fail_count ?? 0) || 0;
    const success = Number(row.success_count ?? 0) || 0;
    const state = /실패|취소|반송/.test(stateText) || (fail > 0 && success === 0)
      ? "failed" : /성공|전송완료|완료/.test(stateText) || success > 0
        ? "delivered" : /접수|대기|전송중|예약/.test(stateText) ? "accepted" : "unknown";
    return { ok: true, state, stateText };
  } catch {
    return { ok: false, state: "unknown", error: "알리고 전달 결과 조회 연결 오류" };
  }
}
