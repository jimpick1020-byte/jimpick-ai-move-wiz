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
import { sendAligo, isPhone, normalizePhone } from "./aligo.js";
import { saveDelivery, findDelivery } from "./supabase.js";

const app = express();
app.use(express.json({ limit: "12mb" }));

const PORT = process.env.PORT || 8080;

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
  if (got.length !== want.length || got !== want) {
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

/** 살아 있는지 확인용 — 인증 없이도 됩니다 */
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "aligo-sms-proxy", time: new Date().toISOString() });
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
  if (imageBase64) {
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
  const result = await sendAligo({ to, text, title, image, testMode: !!testMode });

  // ④ 결과 기록 (성공·실패 모두 남깁니다)
  const row = {
    estimate_id: estimateId ?? null,
    sheet_no: sheetNo ?? null,
    user_id: userId ?? null,
    company_id: companyId ?? null,
    to_masked: maskPhone(to),
    msg_type: result.msgType ?? null,
    msg_id: result.msgId ?? null,
    status: result.ok ? "success" : "failed",
    error_message: result.ok ? null : (result.error ?? null),
    test_mode: !!testMode,
    idempotency_key: idempotencyKey ?? null,
    sent_at: new Date().toISOString(),
  };
  const saved = await saveDelivery(row);

  if (!result.ok) {
    return res.status(502).json({ ok: false, error: result.error, logged: saved.saved });
  }
  return res.json({
    ok: true,
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
