import { useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shrinkPhoto } from "@/lib/photo-shrink";
import { FullScreenItemFrame } from "./ItemListLayer";
import { Field, PrimaryButton, TextInput } from "./ui";
import boxImage from "@/assets/item-box.png";

export interface ManualItemInput { name: string; cat: "가구" | "가전" | "주방" | "생활용품" | "운동·레저"; volume: number; photo: string; favorite: boolean }
export function ManualItemForm({ category, onClose, onSave }: { category: string; onClose: () => void; onSave: (input: ManualItemInput) => Promise<void> }) {
  const [name, setName] = useState("");
  const [cat, setCat] = useState<ManualItemInput["cat"]>(category === "운동·레저용품" ? "운동·레저" : ["가구", "가전", "주방", "생활용품", "운동·레저"].includes(category) ? category as ManualItemInput["cat"] : "가구");
  const [volume, setVolume] = useState("0");
  const [photo, setPhoto] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const readPhoto = async (file?: File) => {
    if (!file || lock.current) return;
    setError(""); setBusy(true); lock.current = true;
    try { setPhoto(await shrinkPhoto(file)); } catch { setError("사진을 불러오지 못했습니다. 다시 선택해 주세요."); }
    finally { setBusy(false); lock.current = false; }
  };
  const save = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      let image = photo;
      if (!image) {
        const response = await fetch(boxImage);
        if (!response.ok) throw new Error("기본 이미지를 불러오지 못했습니다.");
        image = await shrinkPhoto(new File([await response.blob()], "item.png", { type: "image/png" }));
      }
      await onSave({ name: name.trim(), cat, volume: Number(volume), photo: image, favorite });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했습니다."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <FullScreenItemFrame level="form" title="품목 직접 등록" onClose={() => { if (!busy) onClose(); }} footer={<PrimaryButton disabled={busy || name.trim().length < 2 || !Number.isFinite(Number(volume)) || Number(volume) < 0 || Number(volume) > 5} onClick={() => void save()}>{busy ? "저장 중…" : "등록하고 이 방에 선택"}</PrimaryButton>}>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
      <Field label="품목 이름"><TextInput value={name} maxLength={24} disabled={busy} onChange={(e) => setName(e.target.value)} placeholder="품목 이름" /></Field>
      <div className="flex items-center gap-3"><img src={photo || boxImage} alt="등록할 품목" className="size-24 shrink-0 rounded-lg object-contain" /><div className="flex min-w-0 flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => upload.current?.click()}><ImagePlus className="size-4" /> 이미지 등록</Button>
        <Button variant="outline" disabled={busy} onClick={() => camera.current?.click()}><Camera className="size-4" /> 촬영</Button>
      </div></div>
      <input ref={upload} type="file" accept="image/*" hidden onChange={(e) => { void readPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void readPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      <Field label="카테고리"><select value={cat} disabled={busy} onChange={(e) => setCat(e.target.value as ManualItemInput["cat"])} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base">{["가구", "가전", "주방", "생활용품", "운동·레저"].map((value) => <option key={value}>{value}</option>)}</select></Field>
      <Field label="기본 적재량 (루베)"><TextInput type="number" inputMode="decimal" min="0" max="5" step="0.1" value={volume} disabled={busy} onChange={(e) => setVolume(e.target.value)} /></Field>
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" disabled={busy} checked={favorite} onChange={(e) => setFavorite(e.target.checked)} className="size-5 accent-auth-primary" /> 자주 담는 품목 등록</label>
      {error && <p role="alert" className="text-sm font-bold text-destructive">{error}</p>}
    </div>
  </FullScreenItemFrame>;
}