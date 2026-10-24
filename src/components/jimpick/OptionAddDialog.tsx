import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Icon3D } from "@/lib/jimpick-icon3d";
import { createOption, findOptionCandidates, type OptionCatalogItem } from "@/lib/option-catalog";
import type { OptionItem } from "@/lib/jimpick";

export function OptionAddDialog({ catalog, onAdd, onClose }: {
  catalog: OptionCatalogItem[]; onAdd: (option: OptionItem) => void; onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [selectedId, setSelectedId] = useState("");
  const candidates = useMemo(() => findOptionCandidates(name, catalog), [name, catalog]);
  const selected = candidates.length === 1 ? candidates[0] : candidates.find((item) => item.id === selectedId);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85dvh] max-w-sm overflow-y-auto">
        <DialogHeader><DialogTitle>옵션 품목 직접 추가</DialogTitle></DialogHeader>
        <label className="space-y-2 text-sm font-semibold">품목 이름
          <Input autoFocus value={name} onChange={(event) => { setName(event.target.value); setSelectedId(""); }} placeholder="예: 냉장고" />
        </label>
        {candidates.length > 0 && (
          <div className="grid grid-cols-3 gap-2" aria-label="옵션 이미지 후보">
            {candidates.map((item) => (
              <Button key={item.id} variant="outline" aria-pressed={selected?.id === item.id}
                onClick={() => setSelectedId(item.id)}
                className={`h-auto min-w-0 flex-col gap-1 whitespace-normal p-2 ${selected?.id === item.id ? "border-2 border-ring bg-accent" : ""}`}>
                <Icon3D src={item.icon} alt={item.name} size={58} />
                <span className="w-full break-words text-xs">{item.name}</span>
              </Button>
            ))}
          </div>
        )}
        {name.trim() && !candidates.length && <p className="text-sm text-muted-foreground">일치하는 품목이 없습니다.</p>}
        <label className="space-y-2 text-sm font-semibold">추가 금액 (원)
          <Input inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value.replace(/[^\d]/g, ""))} />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button disabled={!name.trim() || (candidates.length > 1 && !selected)} onClick={() => {
            onAdd(createOption(name, Number(price) || 0, selected)); onClose();
          }}>추가</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}