// 아이콘 이미지가 몇 개 준비됐는지 확인합니다.
//   node scripts/check-icons.mjs            # 요약 + 없는 것 앞 20개
//   node scripts/check-icons.mjs --missing  # 없는 파일 경로 전부 출력
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const src = readFileSync(join(ROOT, "src/lib/items-catalog-1000.ts"), "utf8");
const items = JSON.parse(src.match(/ITEMS_1000: Item1000\[\] = (\[.*\]);/s)[1]);

const missing = items.filter((it) => !existsSync(join(PUBLIC, it.path)));
const have = items.length - missing.length;
const pct = ((have / items.length) * 100).toFixed(1);
console.log(`아이콘 이미지: ${have}/${items.length} (${pct}%) · 남음 ${missing.length}`);

// 카테고리별 남은 개수
const byCat = {};
for (const it of missing) byCat[it.cat20] = (byCat[it.cat20] || 0) + 1;
const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
if (cats.length) {
  console.log("남은 카테고리:");
  for (const [c, n] of cats) console.log(`  ${c}: ${n}`);
}

if (process.argv.includes("--missing")) {
  for (const it of missing) console.log(it.path);
} else if (missing.length) {
  console.log("\n없는 파일 예시(앞 20):");
  for (const it of missing.slice(0, 20)) console.log(`  ${it.name} → ${it.path}`);
}
