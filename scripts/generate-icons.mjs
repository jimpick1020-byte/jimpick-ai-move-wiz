// 짐픽 3D 품목 아이콘 1,000개 생성기.
//
// src/lib/items-catalog-1000.ts 의 품목 목록을 읽어, 각 품목의 3D 아이콘을
// 이미지 API로 만들고 public/assets/items-3d/<폴더>/<파일>.webp 에 저장합니다.
// 앱은 이 파일명으로 아이콘을 자동 인식합니다(없으면 기본 3D 박스 폴백).
//
// ── 특징 ─────────────────────────────────────────────────────────
//  * 이어받기: 이미 있는 파일은 건너뜁니다(중간에 끊겨도 다시 실행하면 이어서).
//  * 통일 스타일: 밝고 깔끔한 3D · 투명 배경 · 부드러운 그림자 · 글자/로고 없음 · 1:1.
//  * 동시 실행 제한 + 실패 재시도.
//  * PNG(투명) → webp(투명 유지) 변환.
//
// ── 준비 ─────────────────────────────────────────────────────────
//   npm i sharp                       # PNG→webp 변환용 (한 번만)
//   export OPENAI_API_KEY=sk-...      # 이미지 API 키 (본인 계정, 사용량 과금)
//
// ── 실행 ─────────────────────────────────────────────────────────
//   node scripts/generate-icons.mjs                 # 전체(없는 것만)
//   node scripts/generate-icons.mjs --limit 20      # 먼저 20개만 테스트
//   node scripts/generate-icons.mjs --only refrigerator-01,sofa-01
//   node scripts/generate-icons.mjs --dry-run       # 만들지 않고 남은 개수만
//
// ⚠️ 이미지 생성은 유료입니다. 먼저 --limit 20 으로 스타일을 확인한 뒤 전체를 도세요.
//    다른 이미지 제공자(스테이빌리티/구글 등)를 쓰려면 아래 generateImagePng() 만 바꾸면 됩니다.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src/lib/items-catalog-1000.ts");
const PUBLIC = join(ROOT, "public");

// ── 옵션 ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY = args.includes("--dry-run");
const LIMIT = Number(getArg("--limit") || 0) || 0;
const ONLY = (getArg("--only") || "").split(",").map((s) => s.trim()).filter(Boolean);
const CONCURRENCY = Number(getArg("--concurrency") || 4) || 4;

// ── 품목 목록 읽기 ───────────────────────────────────────────────
function loadItems() {
  const src = readFileSync(DATA, "utf8");
  const m = src.match(/ITEMS_1000: Item1000\[\] = (\[.*\]);/s);
  if (!m) throw new Error("ITEMS_1000 배열을 찾지 못했습니다.");
  return JSON.parse(m[1]);
}

// ── 프롬프트(통일 스타일) ────────────────────────────────────────
const STYLE =
  "a bright, clean, premium 3D icon, isometric view, soft studio lighting, " +
  "subtle soft drop shadow, glossy rounded style, single centered object, " +
  "1:1 square, fully transparent background, no text, no logo, no watermark, no brand";
function promptFor(item) {
  const base = item.file.replace(/-\d+$/, "").replace(/-/g, " ");
  // 한글명을 힌트로 덧붙여 어떤 물건인지 더 정확히.
  return `A ${STYLE}. Object: ${base} (Korean household moving item: ${item.name}).`;
}

// ── 이미지 생성 (기본: OpenAI gpt-image-1, 투명 배경) ────────────
// 반환: PNG Buffer (투명). 다른 제공자를 쓰려면 이 함수만 교체하세요.
async function generateImagePng(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY 가 설정되지 않았습니다.");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      background: "transparent",
      n: 1,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`이미지 API ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("응답에 이미지 데이터(b64_json)가 없습니다.");
  return Buffer.from(b64, "base64");
}

// ── PNG → webp (투명 유지) ───────────────────────────────────────
let sharp;
async function toWebp(pngBuf, outPath) {
  if (!sharp) {
    try {
      sharp = (await import("sharp")).default;
    } catch {
      throw new Error("sharp 가 필요합니다. `npm i sharp` 후 다시 실행해 주세요.");
    }
  }
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(pngBuf).webp({ quality: 90, alphaQuality: 100 }).toFile(outPath);
}

async function withRetry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw last;
}

async function main() {
  let items = loadItems();
  if (ONLY.length) items = items.filter((i) => ONLY.includes(i.file) || ONLY.includes(i.id));

  const todo = items.filter((it) => !existsSync(join(PUBLIC, it.path)));
  const already = items.length - todo.length;
  console.log(`전체 ${items.length}개 · 이미 있음 ${already}개 · 만들 것 ${todo.length}개`);
  if (DRY) {
    console.log("(--dry-run: 실제 생성 안 함)");
    return;
  }
  const list = LIMIT > 0 ? todo.slice(0, LIMIT) : todo;
  console.log(`이번 실행: ${list.length}개 (동시 ${CONCURRENCY})\n`);

  let done = 0;
  let failed = 0;
  const queue = [...list];
  async function worker() {
    for (;;) {
      const it = queue.shift();
      if (!it) return;
      const out = join(PUBLIC, it.path);
      try {
        const png = await withRetry(() => generateImagePng(promptFor(it)));
        await toWebp(png, out);
        done++;
        console.log(`✓ [${done + failed}/${list.length}] ${it.name} → ${it.path}`);
      } catch (e) {
        failed++;
        console.log(`✗ [${done + failed}/${list.length}] ${it.name} (${it.file}): ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\n완료: 성공 ${done} · 실패 ${failed}`);
  if (failed) console.log("실패분은 다시 실행하면 이어서 만듭니다(있는 건 건너뜀).");

  // 진행 리포트 파일
  const report = { at: new Date().toISOString(), total: items.length, generated: done, failed };
  writeFileSync(join(ROOT, "scripts/.icons-last-run.json"), JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error("중단:", e.message);
  process.exit(1);
});
