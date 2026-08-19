/**
 * send-estimate-sms 의 판단 로직을 실제로 돌려 봅니다.
 *
 *   node scripts/sms-edge-check.mjs supabase/functions/send-estimate-sms/index.ts
 *
 * deno 가 있어야 합니다. (없으면 DENO_EXE 환경변수로 실행 파일을 알려 주세요)
 *
 * 알리고에 진짜로 보내지 않고, 알리고 흉내를 내는 서버를 띄워
 *  - 성공(1) 일 때만 성공으로 보는지
 *  - 실패 코드일 때 실제 오류를 그대로 전하는지
 *  - 그림을 붙였는데 MMS 가 아니면 성공으로 보지 않는지
 *  - 번호 형식·설정 누락을 어떻게 처리하는지
 * 를 확인합니다.
 */
import http from "node:http";
import { spawn } from "node:child_process";

const FN = process.argv[2];
const ALIGO_PORT = 8791;
const FN_PORT = 8792;

let lastForm = null;
let reply = { result_code: 1, message: "success", msg_id: "TEST-0001", success_cnt: 1, msg_type: "SMS" };

// 알리고 흉내 서버
const aligo = http.createServer((req, res) => {
  let body = [];
  req.on("data", (c) => body.push(c));
  req.on("end", () => {
    lastForm = Buffer.concat(body).toString("latin1");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(reply));
  });
});
await new Promise((r) => aligo.listen(ALIGO_PORT, r));

// 함수 소스를 읽어 알리고 주소만 흉내 서버로 바꿔 실행합니다
const fs = await import("node:fs");
let src = fs.readFileSync(FN, "utf8");
src = src.replace("https://apis.aligo.in/send/", `http://127.0.0.1:${ALIGO_PORT}/send/`);
// 시험할 때만 포트를 지정해 띄웁니다 (배포본은 그대로입니다)
src = src.replace("Deno.serve(async (req)", `Deno.serve({ port: ${FN_PORT} }, async (req)`);
const tmp = new URL("./fn.ts", import.meta.url).pathname.replace(/^\//, "");
fs.writeFileSync(tmp, src);

const DENO = process.env.DENO_EXE || "deno";
const deno = spawn(
  DENO,
  ["run", "--allow-net", "--allow-env", "--quiet", tmp],
  {
    env: {
      ...process.env,
      ALIGO_USER_ID: "testid",
      ALIGO_API_KEY: "testkey",
      ALIGO_SENDER_NUMBER: "01000000000",
      PORT: String(FN_PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
deno.stderr.on("data", (d) => {
  const t = String(d);
  if (!/Listening|Watcher/.test(t)) process.stderr.write("[deno] " + t);
});

// 함수가 뜰 때까지 기다립니다
const ping = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${FN_PORT}/`, {
        method: "POST",
        body: JSON.stringify({ checkOnly: true }),
        headers: { "Content-Type": "application/json" },
      });
      if (r.ok || r.status >= 200) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
};
if (!(await ping())) {
  console.log("함수를 띄우지 못했습니다 (deno 없음?)");
  process.exit(2);
}

const call = async (body) => {
  const r = await fetch(`http://127.0.0.1:${FN_PORT}/`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return { status: r.status, body: await r.json() };
};

let pass = 0,
  fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${extra}`);
  }
};

console.log("\n[1] 설정 확인 (값은 안 알려 주고 있는지만)");
{
  const r = await call({ checkOnly: true });
  check("세 값 모두 설정됨으로 보고", r.body.config?.ALIGO_USER_ID === true && r.body.config?.ALIGO_API_KEY === true && r.body.config?.ALIGO_SENDER_NUMBER === true, JSON.stringify(r.body));
  check("키 값 자체는 응답에 없음", !JSON.stringify(r.body).includes("testkey"));
}

console.log("\n[2] 번호 형식이 틀리면 보내지 않음");
{
  const r = await call({ to: "123", text: "테스트" });
  check("실패로 응답", r.body.ok === false, JSON.stringify(r.body));
  check("이유를 알려 줌", /번호 형식/.test(r.body.error ?? ""));
}

console.log("\n[3] 알리고가 성공(1)이라고 답하면 성공");
{
  reply = { result_code: 1, message: "success", msg_id: "MSG-123", success_cnt: 1, msg_type: "SMS" };
  const r = await call({ to: "010-1111-2222", text: "[JIMPICK 짐픽]\n문자발송 연결 테스트입니다." });
  check("성공으로 응답", r.body.ok === true, JSON.stringify(r.body));
  check("알리고 발송번호를 그대로 전달", r.body.msgId === "MSG-123");
  check("SMS 로 보냄", r.body.msgType === "SMS");
  check("받는 번호가 01011112222 로 정리됨", (lastForm || "").includes("01011112222"));
}

console.log("\n[4] 알리고가 실패라고 답하면 실패 (성공처럼 보이지 않음)");
{
  reply = { result_code: -201, message: "보유건수가 부족합니다" };
  const r = await call({ to: "01011112222", text: "테스트" });
  check("실패로 응답", r.body.ok === false, JSON.stringify(r.body));
  check("알리고 원문을 그대로 보여 줌", (r.body.error ?? "").includes("보유건수가 부족합니다"));
  check("코드도 함께 보여 줌", (r.body.error ?? "").includes("-201"));
}

console.log("\n[5] 발신번호 미등록(-102) 안내");
{
  reply = { result_code: -102, message: "발신번호 미등록" };
  const r = await call({ to: "01011112222", text: "테스트" });
  check("발신번호 사전등록 안내", /발신번호/.test(r.body.error ?? ""), r.body.error);
}

console.log("\n[6] 긴 글은 LMS 로");
{
  reply = { result_code: 1, message: "success", msg_id: "MSG-LMS", msg_type: "LMS" };
  const r = await call({ to: "01011112222", text: "가".repeat(200) });
  check("LMS 로 응답", r.body.msgType === "LMS", JSON.stringify(r.body));
}

console.log("\n[7] 그림을 붙이면 MMS 로 보냄");
{
  reply = { result_code: 1, message: "success", msg_id: "MSG-MMS", msg_type: "MMS" };
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const r = await call({ to: "01011112222", text: "견적서입니다", imageBase64: png, imageName: "a.png", imageType: "image/png" });
  check("MMS 성공", r.body.ok === true && r.body.msgType === "MMS", JSON.stringify(r.body));
  check("그림이 실제로 붙어 나감", (lastForm || "").includes("filename="));
}

console.log("\n[8] 그림을 붙였는데 알리고가 MMS 가 아니라고 하면 성공으로 보지 않음");
{
  reply = { result_code: 1, message: "success", msg_id: "MSG-X", msg_type: "SMS" };
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const r = await call({ to: "01011112222", text: "견적서입니다", imageBase64: png });
  check("성공으로 표시하지 않음", r.body.ok === false, JSON.stringify(r.body));
  check("이미지가 안 붙었다고 알려 줌", /이미지가 붙지 않았습니다/.test(r.body.error ?? ""));
}

console.log(`\n=== ${pass + fail}개 중 ${pass}개 통과, ${fail}개 실패 ===`);
deno.kill();
aligo.close();
process.exit(fail ? 1 : 0);
