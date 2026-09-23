/**
 * JIMPICK 문자발송 중계 서버.
 *
 *   짐픽 앱 → Supabase Edge Function → (이 서버, 고정 IP) → 알리고 → 고객 휴대폰
 *
 * 알리고는 허용된 IP 에서만 발송을 받아 줍니다.
 * Supabase Edge Function 은 나가는 IP 가 고정되지 않으므로,
 * 고정 IP 를 붙일 수 있는 이 서버를 거쳐 갑니다.
 *
 * 아무나 문자를 보내지 못하도록 JIMPICK_PROXY_SECRET 로 확인합니다.
 */
import express from "express";
import { timingSafeEqual } from "node:crypto";
import { sendAligo, lookupAligo, isPhone, normalizePhone } from "./aligo.js";
import { saveDelivery, findDelivery } from "./supabase.js";
import { renderCard } from "./card.js";

const app = express();
app.use(express.json({ limit: "12mb" }));

const PORT = process.env.PORT || 8080;

async function approvedSender(companyId) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/^[0-9a-f-]{36}$/i.test(String(companyId ?? ""))) return null;
  try {
    const q = new URLSearchParams({ select: "sender_number", company_id: `eq.${companyId}`, provider: "eq.aligo", limit: "1" });
    const r = await fetch(`${url.replace(/\/$/, "")}/rest/v1/company_sms_senders?${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    // 하이픈이 섞여 저장돼 있어도 알리고 전송 형식(숫자만)으로 맞춰 줍니다.
    const digits = normalizePhone(rows[0]?.sender_number ?? "");
    return /^0[0-9]{8,10}$/.test(digits) ? digits : null;
  } catch { return null; }
}

/**
 * 요청이 우리 쪽에서 온 것인지 확인합니다.
 *
 * 비밀키를 보관함에 넣을 때 끝에 줄바꿈이 딸려 들어가는 일이 흔합니다.
 * (예: `openssl rand -hex 32 | gcloud secrets create ...`)
 * 그래서 양쪽 모두 앞뒤 공백·줄바꿈을 떼고 견줍니다.
 */
function checkSecret(req, res) {
  const want = String(process.env.JIMPICK_PROXY_SECRET ?? "").trim();
  if (!want) {
    res.status(500).json({ ok: false, error: "서버에 JIMPICK_PROXY_SECRET 이 설정되지 않았습니다." });
    return false;
  }
  const got = String(req.get("x-jimpick-secret") ?? "").trim();
  const supplied = Buffer.from(got);
  const expected = Buffer.from(want);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    res.status(401).json({ ok: false, error: "인증되지 않은 요청입니다." });
    return false;
  }
  return true;
}

/** 번호 뒤 4자리만 남깁니다 (기록·응답에 전체 번호를 남기지 않습니다) */
function maskPhone(p) {
  const n = normalizePhone(p);
  return n.length >= 4 ? `010-****-${n.slice(-4)}` : "***";
}

/** 살아 있는지 확인용 — 인증 없이도 됩니다 (비밀값은 알려주지 않습니다) */
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "aligo-sms-proxy",
    capabilities: ["sms-cards-v1", "service-fix-v1", "aligo-result-v1", "sender-claim-v1"],
    dbConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    time: new Date().toISOString(),
  });
});

/**
 * 이 서버가 밖으로 나갈 때 쓰는 IP 를 알려 줍니다.
 * 알리고에 등록할 IP 가 바로 이 값입니다.
 */
app.get("/my-ip", async (_req, res) => {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const j = await r.json();
    res.json({ ok: true, ip: j.ip, hint: "이 IP 를 알리고 > 문자 API > 접속 IP 에 등록하세요." });
  } catch {
    res.status(502).json({ ok: false, error: "IP 를 확인하지 못했습니다." });
  }
});

app.post("/result", async (req, res) => {
  if (!checkSecret(req, res)) return;
  const result = await lookupAligo(req.body?.mid);
  return res.status(result.ok ? 200 : 502).json(result);
});

// 운영자 수정완료 통보는 업체 발신번호와 무관한 별도 서비스 문자입니다.
// 수신 번호는 요청 본문을 신뢰하지 않고 운영 설정에서 조회합니다.
app.post("/send-service-fix-notice", async (req, res) => {
  if (!checkSecret(req, res)) return;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sender = normalizePhone(process.env.ALIGO_SENDER);
  if (!url || !key || !/^0[0-9]{8,10}$/.test(sender)) return res.status(503).json({ ok: false, error: "운영 발신정보를 확인할 수 없습니다." });
  const text = String(req.body?.text ?? "");
  if (!text.startsWith("[JIMPICK 짐픽]\n수정 완료 통보\n") || text.length > 400 || /https?:\/\//i.test(text)) {
    return res.status(400).json({ ok: false, error: "운영 통보 내용이 올바르지 않습니다." });
  }
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/rest/v1/service_ops_settings?select=notice_phone,notify_enabled&id=eq.true&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return res.status(503).json({ ok: false, error: "운영 연락처를 확인하지 못했습니다." });
    const [ops] = await r.json();
    const to = normalizePhone(ops?.notice_phone);
    if (ops?.notify_enabled !== true || !isPhone(to) || to !== normalizePhone(req.body?.to)) {
      return res.status(403).json({ ok: false, error: "운영 통보가 꺼져 있거나 수신번호가 일치하지 않습니다." });
    }
    const result = await sendAligo({ to, text, title: "짐픽 수정 완료", sender });
    if (!result.ok) return res.status(502).json({ ok: false, result_code: result.code ?? -1, error: result.error });
    return res.json({ ok: true, result_code: 1, msg_id: result.msgId, msg_type: result.msgType, success_cnt: result.successCount });
  } catch {
    return res.status(503).json({ ok: false, error: "운영 통보 연결 오류" });
  }
});

/**
 * 문자 발송.
 *
 * 요청 예)
 * {
 *   "to": "01012345678",
 *   "text": "[JIMPICK 짐픽] ... 견적서 확인: https://...",
 *   "title": "이사 견적서 JP-2026-0812-001",
 *   "idempotencyKey": "JP-2026-0812-001-v1",
 *   "estimateId": "est_1786...",
 *   "sheetNo": "JP-2026-0812-001",
 *   "userId": "…",           // 있으면 기록에 함께 남깁니다
 *   "imageBase64": "…",       // 있으면 MMS 로 보냅니다
 *   "imageName": "견적서.png",
 *   "testMode": true
 * }
 */
app.post("/send", async (req, res) => {
  if (!checkSecret(req, res)) return;

  const {
    to,
    text,
    title,
    idempotencyKey,
    estimateId,
    sheetNo,
    userId,
    companyId,
    imageBase64,
    imageName,
    imageType,
    cardType,
    cardData,
    testMode,
  } = req.body ?? {};

  if (!isPhone(to)) {
    // 번호 자체는 남기지 않고, 어디가 잘못됐는지 알 수 있게 자릿수만 알려 줍니다
    const n = normalizePhone(to);
    return res.status(400).json({
      ok: false,
      error: `받는 번호 형식이 올바르지 않습니다. (숫자만 남기면 ${n.length}자리, 010으로 시작하는 10~11자리여야 합니다)`,
    });
  }
  if (!String(text || "").trim()) {
    return res.status(400).json({ ok: false, error: "보낼 내용이 비어 있습니다." });
  }

  if (userId && userId !== companyId) return res.status(403).json({ ok: false, error: "업체 정보가 일치하지 않습니다." });
  const sender = await approvedSender(companyId);
  if (!sender) return res.status(403).json({ ok: false, error: "업체의 알리고 승인 발신번호가 등록되지 않아 발송하지 않았습니다." });
  if (cardType && (!cardData || !String(cardData.companyName ?? "").trim())) {
    return res.status(400).json({ ok: false, error: "업체 정보가 필요합니다." });
  }
  if (cardType && (!/^https:\/\/\S+/m.test(text) || (String(text).match(/https?:\/\/\S+/g) ?? []).length !== 1)) {
    return res.status(400).json({ ok: false, error: "고객 보안 링크가 정확히 하나 필요합니다." });
  }

  // ① 같은 요청이 이미 성공했으면 다시 보내지 않습니다
  if (idempotencyKey) {
    const already = await findDelivery(idempotencyKey);
    if (already) {
      return res.json({
        ok: true,
        duplicated: true,
        msgId: already.msg_id,
        msgType: already.msg_type,
        sentAt: already.sent_at,
        message: "이미 보낸 문자입니다. 다시 보내지 않았습니다.",
      });
    }
  }

  // ② 그림이 있으면 MMS
  let image;
  if (cardType) {
    try { image = await renderCard(cardType, cardData); }
    catch (e) { return res.status(400).json({ ok: false, error: e.message }); }
  } else if (imageBase64) {
    try {
      const raw = String(imageBase64).replace(/^data:[^;]+;base64,/, "");
      image = {
        data: Buffer.from(raw, "base64"),
        filename: imageName || "estimate.png",
        contentType: imageType || "image/png",
      };
      // 알리고 MMS 첨부는 300KB 정도까지가 안전합니다
      if (image.data.length > 300 * 1024) {
        return res
          .status(400)
          .json({ ok: false, error: "첨부 그림이 너무 큽니다. 300KB 이하로 줄여 주세요." });
      }
    } catch {
      return res.status(400).json({ ok: false, error: "첨부 그림을 읽지 못했습니다." });
    }
  }

  // ③ 발송
  const result = await sendAligo({ to, text, title, image, sender, testMode: !!testMode });

  // ④ 결과 기록 (성공·실패 모두 남깁니다)
  const row = {
    estimate_id: estimateId ?? null,
    sheet_no: sheetNo ?? null,
    user_id: userId ?? null,
    company_id: companyId ?? null,
    to_masked: maskPhone(to),
    msg_type: result.msgType ?? null,
    msg_id: result.msgId ?? null,
    status: result.ok ? "accepted" : "failed",
    error_message: result.ok ? null : (result.error ?? null),
    test_mode: !!testMode,
    idempotency_key: idempotencyKey ?? null,
    sent_at: new Date().toISOString(),
  };
  // 앱 발송 경로는 호출자가 상세 이력을 저장합니다. 중계 서버의 중복 기록은 만들지 않습니다.
  const saved = idempotencyKey ? await saveDelivery(row) : { saved: false };

  if (!result.ok) return res.status(502).json({ ok: false, result_code: result.code ?? -1, message: result.error, error: result.error, logged: saved.saved });
  return res.json({
    ok: true,
    result_code: 1,
    message: "알리고 접수 완료 (통신사 전달은 별도 확인 필요)",
    msg_id: result.msgId,
    msg_type: result.msgType,
    success_cnt: result.successCount,
    msgId: result.msgId,
    msgType: result.msgType,
    successCount: result.successCount,
    testMode: result.testMode,
    to: maskPhone(to),
    sentAt: row.sent_at,
    logged: saved.saved,
  });
});

app.use((_req, res) => res.status(404).json({ ok: false, error: "없는 주소입니다." }));

app.listen(PORT, () => {
  console.log(`[aligo-sms-proxy] listening on ${PORT}`);
});
