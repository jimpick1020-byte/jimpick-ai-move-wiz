/*
 * STEP 1~3 + AI 작성 시작 — 사진 등록 / 거래정보 / 특징 / 스타일 입력 화면
 */
import { useRef, useState } from "react";
import {
  Camera,
  Images,
  Trash2,
  Star,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { fileToDataUrl } from "@/lib/media";
import { analyzePropertyPhotos, generateRealEstateBlog } from "@/lib/blog.functions";
import { useBlog } from "./context";
import {
  Chip,
  BigTypeButton,
  Card,
  SectionTitle,
  PrimaryButton,
  Field,
  StepBar,
} from "./ui";
import {
  TRANSACTION_TYPES,
  PRICE_FIELDS,
  COMMON_FIELDS,
  CONTACT_FIELDS,
  MOVE_IN_QUICK,
  FEATURE_GROUPS,
  STYLE_OPTIONS,
  LENGTH_OPTIONS,
  PHOTO_LABELS,
  newId,
  type PropertyInfo,
  type TransactionType,
  type Photo,
} from "./data";

const PRICE_LABELS: Record<string, string> = {
  매매가: "매매가",
  전세가: "전세가",
  월세보증금: "월세 보증금",
  월세: "월세",
};

export function EditorScreen() {
  const { current, patch, setEditorStep } = useBlog();
  const [busy, setBusy] = useState<null | string>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  if (!current) return null;
  const rec = current;

  const info = rec.info;
  const setInfo = (key: keyof PropertyInfo, value: string) =>
    patch({ info: { ...info, [key]: value } });

  /* ── 사진 ── */
  async function addFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const arr = Array.from(files).slice(0, 10 - rec.photos.length);
    if (arr.length === 0) {
      toast.error("사진은 최대 10장까지 올릴 수 있습니다.");
      return;
    }
    setBusy("사진 준비 중…");
    try {
      const added: Photo[] = [];
      for (const f of arr) {
        try {
          const dataUrl = await fileToDataUrl(f, 1400);
          added.push({ id: newId(), dataUrl });
        } catch {
          /* 개별 파일 실패는 건너뜁니다 */
        }
      }
      const photos = [...rec.photos, ...added];
      patch({ photos, coverPhotoId: rec.coverPhotoId ?? photos[0]?.id ?? null });
    } finally {
      setBusy(null);
    }
  }

  function removePhoto(id: string) {
    const photos = rec.photos.filter((p) => p.id !== id);
    patch({
      photos,
      coverPhotoId: rec.coverPhotoId === id ? (photos[0]?.id ?? null) : rec.coverPhotoId,
    });
  }

  function movePhoto(id: string, dir: -1 | 1) {
    const idx = rec.photos.findIndex((p) => p.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= rec.photos.length) return;
    const photos = [...rec.photos];
    [photos[idx], photos[target]] = [photos[target], photos[idx]];
    patch({ photos });
  }

  /* ── 특징 토글 ── */
  function toggleFeature(f: string) {
    const has = rec.features.includes(f);
    patch({ features: has ? rec.features.filter((x) => x !== f) : [...rec.features, f] });
  }

  /* ── 빠른 입주 ── */
  function pickMoveIn(mode: string) {
    if (mode === "날짜 지정") {
      patch({ moveInMode: mode });
      return;
    }
    patch({ moveInMode: mode, info: { ...info, 입주가능일: mode } });
  }

  /* ── AI 자동 작성 시작 ── */
  async function runAI() {
    if (!info.아파트명.trim() && !info.주소.trim()) {
      toast.error("아파트명 또는 주소를 입력해 주세요.");
      return;
    }
    let analysis = rec.analysis;
    try {
      // 1) 사진 분석 (사진이 있을 때만)
      if (rec.photos.length) {
        setBusy("AI가 사진을 분석하고 있어요…");
        const res = await analyzePropertyPhotos({
          data: { images: rec.photos.map((p) => p.dataUrl) },
        });
        if (res.error) {
          toast.error(res.error);
        } else {
          analysis = { photos: res.photos, overallStrengths: res.overallStrengths };
          // 파악된 공간을 사진 라벨로 반영
          const labeled = rec.photos.map((p, i) => {
            const found = res.photos.find((x) => x.index === i);
            return found?.room ? { ...p, label: found.room } : p;
          });
          patch({ analysis, photos: labeled });
        }
      }

      // 2) 블로그 글 생성
      setBusy("AI가 홍보글을 작성하고 있어요…");
      const strengths = [
        ...(analysis?.overallStrengths ?? []),
        ...(analysis?.photos.flatMap((p) => p.strengths) ?? []),
      ];
      const rooms = [...new Set((analysis?.photos.map((p) => p.room).filter(Boolean) as string[]) ?? [])];
      const blog = await generateRealEstateBlog({
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
      if (blog.error) {
        toast.error(blog.error);
        return;
      }
      patch({ blog, selectedTitleIndex: 0 });
      setEditorStep("preview");
      window.scrollTo({ top: 0 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI 작성에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  }

  const priceKeys = PRICE_FIELDS[rec.transactionType as TransactionType] ?? [];

  return (
    <div className="space-y-5 pb-40">
      <StepBar current={0} />

      {/* STEP 1 사진 */}
      <Card>
        <SectionTitle step={1} title="매물 사진 등록" desc="여러 장 올릴 수 있어요 (최대 10장)" />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/60 py-6 text-violet-700 active:scale-95"
          >
            <Camera size={26} />
            <span className="text-sm font-semibold">사진 촬영</span>
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/60 py-6 text-violet-700 active:scale-95"
          >
            <Images size={26} />
            <span className="text-sm font-semibold">갤러리에서 선택</span>
          </button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {rec.photos.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {rec.photos.map((p, i) => {
              const isCover = p.id === rec.coverPhotoId;
              return (
                <div
                  key={p.id}
                  className={`relative aspect-square overflow-hidden rounded-xl border-2 ${
                    isCover ? "border-violet-600" : "border-violet-100"
                  }`}
                >
                  <img src={p.dataUrl} alt={p.label ?? ""} className="h-full w-full object-cover" />
                  {isCover && (
                    <span className="absolute left-1 top-1 rounded-md bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      대표
                    </span>
                  )}
                  {p.label && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {p.label}
                    </span>
                  )}
                  <div className="absolute right-1 top-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => patch({ coverPhotoId: p.id })}
                      className="rounded-md bg-white/85 p-1 text-violet-600"
                      title="대표사진"
                    >
                      <Star size={13} fill={isCover ? "currentColor" : "none"} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePhoto(p.id)}
                      className="rounded-md bg-white/85 p-1 text-red-500"
                      title="삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="absolute bottom-1 right-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => movePhoto(p.id, -1)}
                      disabled={i === 0}
                      className="rounded bg-white/85 p-0.5 text-slate-700 disabled:opacity-30"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePhoto(p.id, 1)}
                      disabled={i === rec.photos.length - 1}
                      className="rounded bg-white/85 p-0.5 text-slate-700 disabled:opacity-30"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[12px] text-slate-400">
          별표=대표사진, 화살표=순서변경. 예) {PHOTO_LABELS.join(" · ")}
        </p>
      </Card>

      {/* STEP 2 거래 정보 */}
      <Card>
        <SectionTitle step={2} title="거래 정보 입력" />
        <div className="flex gap-2">
          {TRANSACTION_TYPES.map((t) => (
            <BigTypeButton
              key={t}
              active={rec.transactionType === t}
              onClick={() => patch({ transactionType: t })}
            >
              {t}
            </BigTypeButton>
          ))}
        </div>

        {/* 가격 (거래유형별) */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {priceKeys.map((k) => (
            <Field
              key={k}
              label={PRICE_LABELS[k] ?? k}
              value={info[k]}
              onChange={(v) => setInfo(k, v)}
              placeholder="예: 3억 / 5,000"
            />
          ))}
        </div>

        {/* 공통 정보 */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          {COMMON_FIELDS.map((f) => (
            <Field
              key={f.key}
              label={f.key}
              value={info[f.key]}
              onChange={(v) => setInfo(f.key, v)}
              placeholder={f.placeholder}
              wide={f.wide}
            />
          ))}
        </div>

        {/* 빠른 입주 */}
        <div className="mt-4">
          <span className="text-[13px] font-semibold text-slate-600">입주 가능일</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {MOVE_IN_QUICK.map((m) => (
              <Chip key={m} size="sm" active={rec.moveInMode === m} onClick={() => pickMoveIn(m)}>
                {m}
              </Chip>
            ))}
          </div>
          {(rec.moveInMode === "날짜 지정" ||
            !(MOVE_IN_QUICK as readonly string[]).includes(rec.info.입주가능일)) && (
            <input
              type="text"
              value={info.입주가능일}
              onChange={(e) => setInfo("입주가능일", e.target.value)}
              placeholder="예: 2026-09-01 또는 즉시입주"
              className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          )}
        </div>

        {/* 중개사무소 / 담당자 */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {CONTACT_FIELDS.map((f) => (
            <Field
              key={f.key}
              label={f.key}
              value={info[f.key]}
              onChange={(v) => setInfo(f.key, v)}
              placeholder={f.placeholder}
              wide={f.key === "중개사무소명"}
            />
          ))}
        </div>
      </Card>

      {/* 추가 특징 */}
      <Card>
        <SectionTitle title="추가 특징" desc="해당하는 것을 눌러 주세요 (선택)" />
        <div className="space-y-3">
          {FEATURE_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-1.5 text-[12px] font-semibold text-violet-500">{g.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((f) => (
                  <Chip key={f} size="sm" active={rec.features.includes(f)} onClick={() => toggleFeature(f)}>
                    {f}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 글 스타일 / 길이 */}
      <Card>
        <SectionTitle title="AI 글 스타일" desc="원하는 어조와 길이를 골라 주세요" />
        <div className="grid grid-cols-1 gap-2">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => patch({ style: s.id })}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.99] ${
                rec.style === s.id
                  ? "border-violet-600 bg-violet-50"
                  : "border-violet-100 bg-white hover:bg-violet-50/50"
              }`}
            >
              <div>
                <p className="text-[15px] font-bold text-slate-800">{s.label}</p>
                <p className="text-[12px] text-slate-500">{s.desc}</p>
              </div>
              <span
                className={`h-4 w-4 rounded-full border-2 ${
                  rec.style === s.id ? "border-violet-600 bg-violet-600" : "border-slate-300"
                }`}
              />
            </button>
          ))}
        </div>
        <div className="mt-4">
          <span className="text-[13px] font-semibold text-slate-600">작성 길이</span>
          <div className="mt-1.5 flex gap-2">
            {LENGTH_OPTIONS.map((l) => (
              <BigTypeButton key={l} active={rec.length === l} onClick={() => patch({ length: l })}>
                {l}
              </BigTypeButton>
            ))}
          </div>
        </div>
      </Card>

      {/* 하단 고정 AI 버튼 */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-violet-100 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <PrimaryButton onClick={runAI} disabled={!!busy}>
          {busy ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              {busy}
            </>
          ) : (
            <>
              <Sparkles size={20} />
              AI 자동 작성 시작
            </>
          )}
        </PrimaryButton>
      </div>
    </div>
  );
}
