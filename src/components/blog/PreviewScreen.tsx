/*
 * AI 미리보기 — 실제 블로그 글처럼 보여주고, 수정 / 다시 작성 / 승인
 */
import { useState } from "react";
import { Pencil, RefreshCw, CheckCircle2, Loader2, Hash } from "lucide-react";
import { toast } from "sonner";
import { generateRealEstateBlog } from "@/lib/blog.functions";
import { useBlog } from "./context";
import { Card, PrimaryButton, GhostButton, StepBar } from "./ui";
import { coreInfoLines, selectedTitle } from "./export";
import { coverOf } from "./data";
import type { GeneratedBlog } from "@/lib/blog.functions";

export function PreviewScreen() {
  const { current, patch, setEditorStep } = useBlog();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!current || !current.blog) return null;
  const rec = current;
  const blog = rec.blog!;
  const cover = coverOf(rec);
  const info = coreInfoLines(rec);

  function updateBlog(partial: Partial<GeneratedBlog>) {
    patch({ blog: { ...blog, ...partial } });
  }

  async function regenerate() {
    setBusy(true);
    try {
      const strengths = [
        ...(rec.analysis?.overallStrengths ?? []),
        ...(rec.analysis?.photos.flatMap((p) => p.strengths) ?? []),
      ];
      const rooms = [
        ...new Set((rec.analysis?.photos.map((p) => p.room).filter(Boolean) as string[]) ?? []),
      ];
      const next = await generateRealEstateBlog({
        data: {
          transactionType: rec.transactionType,
          info: rec.info,
          features: rec.features,
          photoStrengths: [...new Set(strengths)],
          photoRooms: rooms,
          style: rec.style,
          length: rec.length,
        },
      });
      if (next.error) {
        toast.error(next.error);
        return;
      }
      patch({ blog: next, selectedTitleIndex: 0 });
      toast.success("새 버전으로 다시 작성했어요.");
    } finally {
      setBusy(false);
    }
  }

  function approve() {
    patch({ status: "done" });
    setEditorStep("complete");
    window.scrollTo({ top: 0 });
    toast.success("승인되었습니다!");
  }

  return (
    <div className="space-y-4 pb-6">
      <StepBar current={2} />

      {/* 제목 3개 선택 */}
      <Card>
        <p className="mb-2 text-sm font-bold text-slate-700">제목을 선택하세요</p>
        <div className="space-y-2">
          {blog.titles.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => patch({ selectedTitleIndex: i })}
              className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-[15px] font-medium transition-all ${
                rec.selectedTitleIndex === i
                  ? "border-violet-600 bg-violet-50 text-slate-900"
                  : "border-violet-100 bg-white text-slate-700"
              }`}
            >
              <span
                className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                  rec.selectedTitleIndex === i ? "border-violet-600 bg-violet-600" : "border-slate-300"
                }`}
              />
              {t}
            </button>
          ))}
        </div>
      </Card>

      {/* 블로그 미리보기 */}
      <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
        {cover && <img src={cover} alt="대표사진" className="h-52 w-full object-cover" />}
        <div className="space-y-4 p-4">
          <h1 className="text-xl font-bold leading-snug text-slate-900">{selectedTitle(rec)}</h1>

          {editing ? (
            <EditArea label="소개 문단" value={blog.intro} onChange={(v) => updateBlog({ intro: v })} rows={4} />
          ) : (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{blog.intro}</p>
          )}

          {/* 매물 핵심정보 */}
          <div className="rounded-xl bg-violet-50/70 p-3.5">
            <p className="mb-2 text-sm font-bold text-violet-700">🏠 매물 정보</p>
            <dl className="grid grid-cols-1 gap-1">
              {info.map((row) => (
                <div key={row.label} className="flex text-[14px]">
                  <dt className="w-20 shrink-0 text-slate-500">{row.label}</dt>
                  <dd className="font-medium text-slate-800">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* 현장 설명 + 사진 배치 */}
          {blog.sections.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-violet-700">📸 현장 설명</p>
              {blog.sections.map((s, i) => {
                const photo = rec.photos.find((p) => p.label === s.room);
                return (
                  <div key={i} className="space-y-1.5">
                    <p className="text-[15px] font-bold text-slate-800">{s.room}</p>
                    {photo && (
                      <img src={photo.dataUrl} alt={s.room} className="h-40 w-full rounded-xl object-cover" />
                    )}
                    {editing ? (
                      <EditArea
                        value={s.text}
                        onChange={(v) => {
                          const sections = [...blog.sections];
                          sections[i] = { ...sections[i], text: v };
                          updateBlog({ sections });
                        }}
                        rows={3}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{s.text}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 추천 */}
          {blog.recommendations.length > 0 && (
            <div className="rounded-xl bg-violet-50/70 p-3.5">
              <p className="mb-2 text-sm font-bold text-violet-700">✨ 이런 분께 추천합니다</p>
              <ul className="space-y-1">
                {blog.recommendations.map((r, i) => (
                  <li key={i} className="text-[14px] text-slate-700">
                    · {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 마무리 */}
          {editing ? (
            <EditArea label="마무리 문구" value={blog.closing} onChange={(v) => updateBlog({ closing: v })} rows={3} />
          ) : (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{blog.closing}</p>
          )}

          {/* 연락처 */}
          {(rec.info.담당자명 || rec.info.연락처) && (
            <div className="text-[14px] font-semibold text-slate-800">
              {rec.info.담당자명 && <p>☎ 담당자 : {rec.info.담당자명}</p>}
              {rec.info.연락처 && <p>☎ 연락처 : {rec.info.연락처}</p>}
            </div>
          )}

          {/* 해시태그 */}
          {blog.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-violet-50 pt-3">
              {blog.hashtags.map((h, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 text-[13px] text-violet-600">
                  <Hash size={12} />
                  {h.replace(/^#/, "")}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 버튼들 */}
      <div className="grid grid-cols-2 gap-2">
        <GhostButton onClick={() => setEditing((v) => !v)}>
          <Pencil size={18} />
          {editing ? "수정 완료" : "수정하기"}
        </GhostButton>
        <GhostButton onClick={regenerate} tone="slate">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          AI 다시 작성
        </GhostButton>
      </div>
      <PrimaryButton onClick={approve} className="bg-green-600 shadow-green-300/50">
        <CheckCircle2 size={20} />
        승인 및 업로드
      </PrimaryButton>
      <button
        type="button"
        onClick={() => setEditorStep("edit")}
        className="w-full py-2 text-sm font-medium text-slate-400"
      >
        ← 정보 다시 입력하기
      </button>
    </div>
  );
}

function EditArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      {label && <p className="mb-1 text-[12px] font-semibold text-violet-500">{label}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-[15px] leading-relaxed text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
      />
    </div>
  );
}
