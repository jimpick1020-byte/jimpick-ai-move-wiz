import { useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { streamImage } from "@/lib/stream-image";
import { Button } from "@/components/ui/button";
import { shrinkPhoto } from "@/lib/photo-shrink";
import { classifyItem, ITEM_MAIN_CATS, ITEM_KEYWORD_RULES, type ItemMainCat } from "@/lib/item-classify";
import { FullScreenItemFrame } from "./ItemListLayer";
import { Field, PrimaryButton, TextInput } from "./ui";
import boxImage from "@/assets/item-box.png";

export interface ManualItemInput {
  name: string; cat: ItemMainCat; volume: number; photo: string; favorite: boolean;
  group: string; rooms: string[]; keywords: string[];
}
const ROOM_OPTIONS = ["안방", "작은방", "서재", "거실", "부엌", "베란다", "세탁실", "입구", "창고", "기타"];

export function ManualItemForm({ category, onClose, onSave }: { category: string; onClose: () => void; onSave: (input: ManualItemInput) => Promise<void> }) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [cat, setCat] = useState<ItemMainCat | "">("");
  const [group, setGroup] = useState("");
  const [rooms, setRooms] = useState<string[] | null>(null);
  const [volume, setVolume] = useState("0");
  const [photo, setPhoto] = useState("");
  const [preview, setPreview] = useState("");
  const [previewReady, setPreviewReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationTried, setGenerationTried] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const auto = useMemo(() => classifyItem(name, category), [name, category]);
  // 수정하지 않은 항목은 자동 분류 값을 그대로 씁니다.
  const finalCat = (editing && cat) || (auto.confident ? auto.cat : cat || null);
  const finalGroup = (editing && group.trim()) || (finalCat && finalCat === auto.cat ? auto.group : "기타");
  const finalRooms = rooms ?? auto.rooms;
  const needsChoice = !auto.confident && !cat;
  const groupOptions = [...new Set(ITEM_KEYWORD_RULES.filter((r) => r.cat === finalCat).map((r) => r.group).concat("기타"))];

  const generate = async () => {
    if (lock.current) return;
    if (!name.trim()) { setGenerationError("품목 이름을 먼저 입력해 주세요"); return; }
    lock.current = true; setGenerating(true); setGenerationTried(true); setGenerationError(""); setPreview(""); setPreviewReady(false);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("로그인이 필요합니다.");
      await streamImage("/api/item-image-preview", { name: name.trim() }, (image, final) => { setPreview(image); setPreviewReady(final); }, undefined, { Authorization: `Bearer ${data.session.access_token}` });
    } catch (cause) { setPreviewReady(false); setGenerationError(cause instanceof Error ? cause.message : "이미지 생성에 실패했습니다."); }
    finally { lock.current = false; setGenerating(false); }
  };

  const readPhoto = async (file?: File) => {
    if (!file || lock.current) return;
    setError(""); setBusy(true); lock.current = true;
    try { setPhoto(await shrinkPhoto(file)); setPreview(""); setPreviewReady(false); setGenerationError(""); } catch { setError("사진을 불러오지 못했습니다. 다시 선택해 주세요."); }
    finally { setBusy(false); lock.current = false; }
  };
  const save = async () => {
    if (lock.current || !finalCat) return;
    lock.current = true; setBusy(true); setError("");
    try {
      let image = photo;
      if (generationTried && !image) throw new Error("생성한 이미지를 승인하거나 이미지를 등록해 주세요.");
      if (!image) {
        const response = await fetch(boxImage);
        if (!response.ok) throw new Error("기본 이미지를 불러오지 못했습니다.");
        image = await shrinkPhoto(new File([await response.blob()], "item.png", { type: "image/png" }));
      }
      await onSave({ name: name.trim(), cat: finalCat, volume: Number(volume), photo: image, favorite, group: finalGroup, rooms: finalRooms, keywords: auto.keywords });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했습니다."); }
    finally { lock.current = false; setBusy(false); }
  };
  const invalid = busy || generating || !!preview || (generationTried && !photo) || name.trim().length < 2 || !finalCat || !Number.isFinite(Number(volume)) || Number(volume) < 0 || Number(volume) > 5;
  const startEdit = () => { setEditing(true); setCat(finalCat || ""); setGroup(finalGroup); setRooms(finalRooms); };

  return <FullScreenItemFrame level="form" title="품목 직접 등록" onClose={() => { if (!busy && !generating) onClose(); }} footer={
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" className="h-12 font-bold" disabled={busy || generating || editing} onClick={startEdit}>분류 수정</Button>
      <PrimaryButton disabled={invalid} onClick={() => void save()}>{busy ? "저장 중…" : "이대로 저장"}</PrimaryButton>
    </div>}>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
      <Field label="품목 이름"><TextInput value={name} maxLength={24} disabled={busy || generating} onChange={(e) => setName(e.target.value)} placeholder="품목 이름" /></Field>
      <div className="flex items-center gap-3"><img src={preview || photo || boxImage} alt="등록할 품목" className="size-24 shrink-0 rounded-lg object-contain" /><div className="flex min-w-0 flex-wrap gap-2">
        <Button variant="outline" disabled={busy || generating} onClick={() => upload.current?.click()}><ImagePlus className="size-4" /> 이미지 등록</Button>
        <Button variant="outline" disabled={busy || generating} onClick={() => camera.current?.click()}><Camera className="size-4" /> 촬영</Button>
        <Button variant="outline" disabled={busy || generating} onClick={() => void generate()}><Sparkles className="size-4" /> {generating ? "이미지 생성 중…" : "이미지 생성"}</Button>
      </div></div>
      {preview && <div className="flex flex-wrap gap-2" data-generated-preview>
        <Button variant="outline" disabled={generating || busy} onClick={() => void generate()}>다시 생성</Button>
        <Button disabled={!previewReady || generating || busy} onClick={async () => {
          if (lock.current) return;
          lock.current = true; setBusy(true);
          try {
            const image = new Image();
            image.src = preview;
            await image.decode();
            const canvas = document.createElement("canvas");
            const scale = Math.min(1, 768 / Math.max(image.width, image.height));
            canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
            const context = canvas.getContext("2d");
            if (!context) throw new Error("이미지 준비 실패");
            context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            setPhoto(canvas.toDataURL("image/jpeg", 0.9));
            setPreview(""); setPreviewReady(false); setGenerationError("");
          }
          catch { setGenerationError("이미지를 준비하지 못했습니다. 다시 시도해 주세요."); }
          finally { lock.current = false; setBusy(false); }
        }}>이 이미지 사용</Button>
      </div>}
      {generationError && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{generationError}</p><Button variant="outline" disabled={generating || busy} onClick={() => void generate()}>재시도</Button></div>}
      <input ref={upload} type="file" accept="image/*" hidden onChange={(e) => { void readPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void readPhoto(e.target.files?.[0]); e.target.value = ""; }} />

      {name.trim().length >= 2 && <section className="space-y-1 rounded-xl border border-border bg-muted p-3 text-sm" data-auto-class>
        <p className="font-black">자동 분류</p>
        {needsChoice && <p role="status" className="font-bold text-destructive">자동으로 분류하기 어려운 품목입니다. 카테고리를 선택해 주세요.</p>}
        <p>- 카테고리: <b>{finalCat || "선택 필요"}</b></p>
        <p>- 품목 그룹: <b>{finalGroup}</b>{auto.confident && auto.variant !== finalGroup ? ` · ${auto.variant}` : ""}</p>
        <p>- 추천 공간: <b>{finalRooms.length ? finalRooms.join("·") : "지정 없음"}</b></p>
      </section>}

      {(editing || needsChoice || !auto.confident) && <Field label="대분류"><select value={cat} disabled={busy} onChange={(e) => { setCat(e.target.value as ItemMainCat); setGroup("기타"); }} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base">
        <option value="" disabled>카테고리 선택</option>{ITEM_MAIN_CATS.map((value) => <option key={value}>{value}</option>)}</select></Field>}
      {editing && <>
        <Field label="품목 그룹"><select value={group} disabled={busy || !finalCat} onChange={(e) => setGroup(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base">{[...new Set([group, ...groupOptions])].filter(Boolean).map((g) => <option key={g}>{g}</option>)}</select></Field>
        <fieldset><legend className="mb-2 text-sm font-bold">추천 공간</legend><div className="flex flex-wrap gap-2">{ROOM_OPTIONS.map((r) => {
          const on = finalRooms.includes(r);
          return <Button key={r} type="button" size="sm" variant={on ? "default" : "outline"} disabled={busy} aria-pressed={on} onClick={() => setRooms(on ? finalRooms.filter((x) => x !== r) : [...finalRooms, r])}>{r}</Button>;
        })}</div></fieldset>
        <Field label="기본 적재량 (루베)"><TextInput type="number" inputMode="decimal" min="0" max="5" step="0.1" value={volume} disabled={busy} onChange={(e) => setVolume(e.target.value)} /></Field>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" disabled={busy} checked={favorite} onChange={(e) => setFavorite(e.target.checked)} className="size-5 accent-auth-primary" /> 자주 담는 품목 등록</label>
      </>}
      {error && <p role="alert" className="text-sm font-bold text-destructive">{error}</p>}
    </div>
  </FullScreenItemFrame>;
}
