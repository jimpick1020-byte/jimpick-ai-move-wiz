/*
 * 완료 화면 — 녹색 네이버 블로그 스타일. 네이버용 복사 / 내보내기.
 */
import { useState } from "react";
import { CheckCircle2, Copy, Hash, FileText, Home, Plus, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useBlog } from "./context";
import { Card, PrimaryButton, GhostButton } from "./ui";
import { buildBlogText, coreInfoLines, selectedTitle, photoOrderGuide } from "./export";
import { coverOf } from "./data";

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label}을(를) 복사했어요.`);
  } catch {
    toast.error("복사에 실패했습니다. 길게 눌러 직접 복사해 주세요.");
  }
}

export function CompleteScreen() {
  const { current, startNew, go } = useBlog();
  const [showText, setShowText] = useState(false);
  if (!current || !current.blog) return null;
  const rec = current;
  const blog = rec.blog!;
  const cover = coverOf(rec);
  const fullText = buildBlogText(rec);
  const info = coreInfoLines(rec);

  return (
    <div className="space-y-4 pb-6">
      {/* 완료 배너 (네이버 녹색) */}
      <div className="rounded-2xl bg-gradient-to-b from-green-500 to-green-600 p-6 text-center text-white shadow-lg shadow-green-200">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-xl font-bold">블로그 홍보글 준비가 완료되었습니다!</h2>
        <p className="mt-1 text-sm text-green-50">
          네이버 블로그에 바로 붙여넣을 수 있어요.
        </p>
      </div>

      {/* 네이버 정책 안내 */}
      <div className="rounded-xl border border-green-200 bg-green-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-green-800">
        네이버는 외부 프로그램의 자동 게시를 허용하지 않습니다. 아래 <b>복사</b> 버튼으로 옮겨
        <b> 붙여넣기</b> 하시면 가장 안전하고 빠릅니다. (자동 로그인·캡차 우회 등은 사용하지 않습니다.)
      </div>

      {/* 완성 글 카드 */}
      <div className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
        {cover && <img src={cover} alt="대표사진" className="h-44 w-full object-cover" />}
        <div className="space-y-3 p-4">
          <h1 className="text-lg font-bold leading-snug text-slate-900">{selectedTitle(rec)}</h1>
          <p className="line-clamp-3 whitespace-pre-wrap text-[14px] leading-relaxed text-slate-600">
            {blog.intro}
          </p>
          <div className="rounded-xl bg-green-50/70 p-3">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              {info.slice(0, 8).map((row) => (
                <div key={row.label} className="flex text-[13px]">
                  <dt className="w-14 shrink-0 text-slate-500">{row.label}</dt>
                  <dd className="truncate font-medium text-slate-800">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          {blog.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {blog.hashtags.slice(0, 12).map((h, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 text-[12px] text-green-700">
                  <Hash size={11} />
                  {h.replace(/^#/, "")}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 복사 버튼들 */}
      <Card>
        <p className="mb-2.5 text-sm font-bold text-slate-700">네이버 블로그용 복사</p>
        <div className="grid grid-cols-2 gap-2">
          <GhostButton tone="green" onClick={() => copy(fullText, "전체 글")}>
            <Copy size={17} />
            전체 복사
          </GhostButton>
          <GhostButton tone="green" onClick={() => copy(selectedTitle(rec), "제목")}>
            <Copy size={17} />
            제목만
          </GhostButton>
          <GhostButton tone="green" onClick={() => copy(blog.hashtags.join(" "), "해시태그")}>
            <Hash size={17} />
            해시태그
          </GhostButton>
          <GhostButton tone="green" onClick={() => copy(photoOrderGuide(rec) || "사진 없음", "사진 순서")}>
            <ClipboardList size={17} />
            사진 순서
          </GhostButton>
        </div>
        <button
          type="button"
          onClick={() => setShowText((v) => !v)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 py-2 text-[13px] font-medium text-slate-500"
        >
          <FileText size={15} />
          {showText ? "전체 텍스트 접기" : "전체 텍스트 보기"}
        </button>
        {showText && (
          <textarea
            readOnly
            value={fullText}
            rows={14}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-700"
          />
        )}
      </Card>

      {/* 다음 행동 */}
      <div className="grid grid-cols-2 gap-2">
        <GhostButton onClick={() => go("blogs")}>
          <FileText size={18} />내 블로그 글
        </GhostButton>
        <PrimaryButton onClick={startNew}>
          <Plus size={18} />새 매물 작성
        </PrimaryButton>
      </div>
      <button
        type="button"
        onClick={() => go("home")}
        className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-medium text-slate-400"
      >
        <Home size={16} />홈으로
      </button>
    </div>
  );
}
