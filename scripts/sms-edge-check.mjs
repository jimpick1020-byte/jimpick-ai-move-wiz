/**
 * send-estimate-sms 를 실제로 띄워 규칙을 확인합니다.
 * 알리고와 데이터베이스는 흉내 서버로 대신합니다 (실제로 문자는 나가지 않습니다).
 */
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";

const FN = process.argv[2];
const ALIGO_PORT = 8801;
const DB_PORT = 8802;
const FN_PORT = 8803;

let aligoReply = { result_code: 1, message: "success", msg_id: "ALIGO-1234", success_cnt: 1, msg_type: "SMS" };
let aligoForm = "";
let inserted = [];
let estimateRow = null;
let alreadySent = [];

const aligo = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    aligoForm = Buffer.concat(chunks).toString("latin1");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(aligoReply));
  });
});
await new Promise((r) => aligo.listen(ALIGO_PORT, r));

// 데이터베이스 흉내 (PostgREST 처럼 응답)
const db = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const url = new URL(req.url, `http://x`);
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET" && url.pathname.endsWith("/estimate_terms")) {
      res.writeHead(200);
      res.end(JSON.stringify(estimateRow ? [estimateRow] : []));
      return;
    }
    if (req.method === "GET" && url.pathname.endsWith("/estimate_deliveries")) {
      res.writeHead(200);
      res.end(JSON.stringify(alreadySent));
      return;
    }
    if (req.method === "POST" && url.pathname.endsWith("/estimate_deliveries")) {
      inserted.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      res.writeHead(201);
      res.end("[]");
      return;
    }
    res.writeHead(200);
    res.end("[]");
  });
});
await new Promise((r) => db.listen(DB_PORT, r));

let src = fs.readFileSync(FN, "utf8");
src = src.replace("https://apis.aligo.in/send/", `http://127.0.0.1:${ALIGO_PORT}/send/`);
src = src.replace("Deno.serve(async (req)", `Deno.serve({ port: ${FN_PORT} }, async (req)`);
const tmp = new URL("./fn2.ts", import.meta.url).pathname.replace(/^\//, "");
fs.writeFileSync(tmp, src);

const deno = spawn(process.env.DENO_EXE || "deno", ["run", "--allow-net", "--allow-env", "--quiet", tmp], {
  env: {
    ...process.env,
    ALIGO_USER_ID: "testid",
    ALIGO_API_KEY: "testkey",
    ALIGO_SENDER_NUMBER: "01000000000",
    APP_PUBLIC_URL: "https://jimpick.example.com",
    SUPABASE_URL: `http://127.0.0.1:${DB_PORT}`,
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
deno.stderr.on("data", (d) => {
  const t = String(d);
  if (!/Listening/.test(t)) process.stderr.write("[deno] " + t);
});

const jwt = (sub, expOffset = 3600) =>
  "x." + Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + expOffset })).toString("base64") + ".y";

const call = async (body, token) => {
  const r = await fetch(`http://127.0.0.1:${FN_PORT}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
};

for (let i = 0; i < 60; i++) {
  try {
    await call({ checkOnly: true });
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
};

const OWNER = "owner-uuid-1";
const OTHER = "other-uuid-2";
const goodRow = {
  id: "et1", user_id: OWNER, estimate_id: "est_1", sheet_no: "JP-2026-0819-001",
  sheet_version: 2, customer_name: "김고객", contact_phone: "010-1111-2222",
  total: 1740000, access_token: "a1b2c3d4e5f6a7b8", sheet_snapshot: '{"draft":{}}',
};

console.log("\n[1] 로그인하지 않은 요청은 거부");
{
  const r = await call({ estimate_id: "est_1", delivery_method: "link", idempotency_key: "k1" });
  check("401 로 거부", r.status === 401, JSON.stringify(r.body));
}

console.log("\n[2] 다른 업체의 견적서는 거부");
{
  estimateRow = { ...goodRow, user_id: OTHER };
  const r = await call({ estimate_id: "est_1", delivery_method: "link", idempotency_key: "k2" }, jwt(OWNER));
  check("403 로 거부", r.status === 403, JSON.stringify(r.body));
}

console.log("\n[3] 확정 안 된 견적서는 거부");
{
  estimateRow = { ...goodRow, sheet_snapshot: null };
  const r = await call({ estimate_id: "est_1", delivery_method: "link", idempotency_key: "k3" }, jwt(OWNER));
  check("보내지 않음", r.body.ok === false, JSON.stringify(r.body));
  check("확정 안내", /확정/.test(r.body.error ?? ""), r.body.error);
}

console.log("\n[4] 잘못된 전화번호는 거부");
{
  estimateRow = { ...goodRow, contact_phone: "02-123-4567" };
  const r = await call({ estimate_id: "est_1", delivery_method: "link", idempotency_key: "k4" }, jwt(OWNER));
  check("보내지 않음", r.body.ok === false, JSON.stringify(r.body));
  check("번호 형식 안내", /번호 형식/.test(r.body.error ?? ""), r.body.error);
}

console.log("\n[5] 정상 발송 — 서버가 문자 내용을 직접 만듭니다");
{
  estimateRow = { ...goodRow };
  inserted = [];
  aligoReply = { result_code: 1, message: "success", msg_id: "ALIGO-9999", success_cnt: 1, msg_type: "LMS" };
  const r = await call({ estimate_id: "est_1", delivery_method: "link", idempotency_key: "k5" }, jwt(OWNER));
  check("성공", r.body.ok === true, JSON.stringify(r.body));
  check("알리고 발송번호 전달", r.body.msgId === "ALIGO-9999");
  check("받는 번호 뒤 4자리만", r.body.recipientLast4 === "2222" && !JSON.stringify(r.body).includes("01011112222"));
  const decoded = decodeURIComponent(escape(aligoForm));
  check("고객 이름이 문자에 들어감", decoded.includes("김고객"));
  check("금액에 쉼표", decoded.includes("1,740,000원"));
  check("보안 토큰 링크", decoded.includes("a1b2c3d4e5f6a7b8"));
  check("견적번호를 링크에 그대로 쓰지 않음(토큰 사용)", decoded.includes("?t=a1b2c3d4e5f6a7b8"));
  check("시험모드 아님", !decoded.includes("testmode_yn"));
  check("발송내역 저장됨", inserted.length === 1, JSON.stringify(inserted));
  const row = inserted[0] ?? {};
  check("기록에 전체 번호 없음", !JSON.stringify(row).includes("01011112222"));
  check("기록에 API 키 없음", !JSON.stringify(row).includes("testkey"));
  check("기록 status=sent", row.status === "sent", row.status);
  check("기록에 차수·방식·발송번호", row.estimate_version === 2 && row.delivery_method === "link" && row.provider_message_id === "ALIGO-9999");
}

console.log("\n[6] 알리고가 실패하면 실패로");
{
  estimateRow = { ...goodRow };
  inserted = [];
  aligoReply = { result_code: -101, message: "인증되지 않은 요청" };
  const r = await call({ estimate_id: "est_1", delivery_method: "link", idempotency_key: "k6" }, jwt(OWNER));
  check("성공으로 표시하지 않음", r.body.ok === false, JSON.stringify(r.body));
  check("알리고 원문 전달", (r.body.error ?? "").includes("인증되지 않은 요청"));
  check("기록 status=failed", inserted[0]?.status === "failed");
}

console.log("\n[7] 같은 열쇠로 두 번 누르면 한 번만");
{
  estimateRow = { ...goodRow };
  alreadySent = [{ id: "d1", status: "sent", provider_message_id: "ALIGO-9999", sent_at: "2026-08-21T00:00:00Z", msg_type: "LMS" }];
  inserted = [];
  const r = await call({ estimate_id: "est_1", delivery_method: "link", idempotency_key: "k5" }, jwt(OWNER));
  check("다시 보내지 않음", r.body.alreadySent === true, JSON.stringify(r.body));
  check("알리고를 부르지 않음", inserted.length === 0);
  alreadySent = [];
}

console.log("\n[8] 연결 시험 발송 — 사장님이 넣은 번호로 정해진 문구만");
{
  inserted = [];
  aligoReply = { result_code: 1, message: "success", msg_id: "ALIGO-TEST", success_cnt: 1, msg_type: "SMS" };
  const r = await call({ mode: "test", test_to: "010-9999-8888", idempotency_key: "t1" }, jwt(OWNER));
  check("성공", r.body.ok === true, JSON.stringify(r.body));
  const decoded = decodeURIComponent(escape(aligoForm));
  check("정해진 문구만", decoded.includes("문자발송 연결 테스트입니다"));
  check("고객 정보 없음", !decoded.includes("김고객"));
  check("기록 남김", inserted[0]?.delivery_method === "test");
}

console.log("\n[9] 설정 확인은 값을 알려 주지 않음");
{
  const r = await call({ checkOnly: true });
  check("이름만 알려 줌", r.body.config?.ALIGO_API_KEY === true);
  check("키 값 없음", !JSON.stringify(r.body).includes("testkey"));
}

console.log(`\n=== ${pass + fail}개 중 ${pass}개 통과, ${fail}개 실패 ===`);
deno.kill();
aligo.close();
db.close();
process.exit(fail ? 1 : 0);
