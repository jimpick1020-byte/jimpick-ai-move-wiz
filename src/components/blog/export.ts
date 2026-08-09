/*
 * 블로그 글 조립 · 네이버 블로그용 텍스트 내보내기
 */
import type { PropertyRecord, TransactionType, PropertyInfo } from "./data";
import { PRICE_FIELDS } from "./data";

/** 미리보기/복사에 쓰는 매물 핵심정보 라인 */
export function coreInfoLines(rec: PropertyRecord): { label: string; value: string }[] {
  const info = rec.info;
  const lines: { label: string; value: string }[] = [];
  const push = (label: string, key: keyof PropertyInfo, suffix = "") => {
    const v = info[key]?.trim();
    if (v) lines.push({ label, value: v + suffix });
  };

  lines.push({ label: "거래 유형", value: rec.transactionType });
  push("아파트", "아파트명");
  push("주소", "주소");

  const dongFloor = [info.동?.trim(), info.층?.trim()].filter(Boolean).join(" ");
  if (dongFloor) lines.push({ label: "동/층", value: dongFloor });

  const area = [info.전용면적 && `${info.전용면적}㎡`, info.평수 && `${info.평수}평`].filter(Boolean).join(" / ");
  if (area) lines.push({ label: "면적", value: area });

  const rooms = [info.방개수 && `${info.방개수}룸`, info.욕실개수 && `${info.욕실개수}욕실`].filter(Boolean).join(" / ");
  if (rooms) lines.push({ label: "방/욕실", value: rooms });

  for (const key of PRICE_FIELDS[rec.transactionType as TransactionType] ?? []) push(priceLabel(key), key);

  push("관리비", "관리비");
  push("입주", "입주가능일");
  push("방향", "방향");
  push("주차", "주차");
  push("준공", "준공년도");
  return lines;
}

function priceLabel(key: keyof PropertyInfo): string {
  switch (key) {
    case "매매가":
      return "매매가";
    case "전세가":
      return "전세가";
    case "월세보증금":
      return "보증금";
    case "월세":
      return "월세";
    default:
      return String(key);
  }
}

export function selectedTitle(rec: PropertyRecord): string {
  const titles = rec.blog?.titles ?? [];
  if (!titles.length) return rec.info.아파트명 || "매물 소개";
  return titles[Math.min(rec.selectedTitleIndex, titles.length - 1)];
}

/** 네이버 블로그용 전체 텍스트 (제목 + 본문 + 해시태그) */
export function buildBlogText(rec: PropertyRecord): string {
  const blog = rec.blog;
  if (!blog) return "";
  const parts: string[] = [];
  parts.push(selectedTitle(rec));
  parts.push("");
  if (blog.intro) parts.push(blog.intro, "");

  parts.push("🏠 매물 정보");
  for (const { label, value } of coreInfoLines(rec)) parts.push(`${label} : ${value}`);
  parts.push("");

  if (blog.sections.length) {
    parts.push("📸 현장 설명");
    for (const s of blog.sections) {
      parts.push(`[${s.room}]`, s.text, "");
    }
  }

  if (blog.recommendations.length) {
    parts.push("✨ 이런 분께 추천합니다");
    for (const r of blog.recommendations) parts.push(`· ${r}`);
    parts.push("");
  }

  if (blog.closing) parts.push(blog.closing, "");

  const agent = rec.info.담당자명?.trim();
  const phone = rec.info.연락처?.trim();
  if (agent) parts.push(`☎ 담당자 : ${agent}`);
  if (phone) parts.push(`☎ 연락처 : ${phone}`);
  if (agent || phone) parts.push("");

  if (blog.hashtags.length) parts.push(blog.hashtags.join(" "));

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** 사진 배치 안내 (네이버에 붙일 때 순서 참고용) */
export function photoOrderGuide(rec: PropertyRecord): string {
  if (!rec.photos.length) return "";
  return rec.photos
    .map((p, i) => `${i + 1}. ${p.label || "사진"}${p.id === rec.coverPhotoId ? " (대표)" : ""}`)
    .join("\n");
}
