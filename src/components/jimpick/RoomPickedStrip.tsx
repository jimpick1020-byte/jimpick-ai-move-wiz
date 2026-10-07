import { ChevronDown, Minus, MoreHorizontal, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemArt } from "@/lib/jimpick-art";
import { DisposalX } from "./EstimateSheet";

interface PickedItem { id: string; name: string; qty: number }

export function RoomPickedStrip({ items, disposal, collapsed, onToggle, onRemove, onMenu, onDecrease, onIncrease }: {
  items: PickedItem[];
  disposal?: Record<string, boolean>;
  collapsed: boolean;
  onToggle: () => void;
  onRemove: (item: PickedItem) => void;
  onMenu: (id: string) => void;
  onDecrease: (item: PickedItem) => void;
  onIncrease: (item: PickedItem) => void;
}) {
  return (
    <section className="shrink-0 border-b border-border px-4 py-2" aria-label="선택한 품목">
      <Button variant="ghost" onClick={onToggle} aria-expanded={!collapsed} aria-controls="room-picked-items" className="h-8 w-full justify-between px-0">
        <span className="text-sm font-bold">선택 품목 {items.length}종 · {items.reduce((sum, item) => sum + item.qty, 0)}개</span>
        <ChevronDown className={collapsed ? "" : "rotate-180"} />
      </Button>
      {!collapsed && (
        <div id="room-picked-items" className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1" data-room-picked-strip>
          {items.length === 0 ? <p className="py-2 text-xs text-muted-foreground">선택한 품목이 없습니다</p> : items.map((item) => (
            <div key={item.id} className="flex w-44 shrink-0 items-center gap-2 rounded-lg border border-border bg-background p-1.5">
              <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center">
                <ItemArt id={item.id} name={item.name} size={40} />
                {disposal?.[item.id] && <DisposalX />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center">
                  <span className="min-w-0 flex-1 truncate text-xs font-bold" title={item.name}>{item.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onMenu(item.id)} aria-label={`${item.name} 관리`}><MoreHorizontal /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onRemove(item)} aria-label={`${item.name} 삭제`}><X /></Button>
                </div>
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onDecrease(item)} aria-label={`${item.name} 수량 줄이기`}><Minus /></Button>
                  <span className="text-xs font-bold tabular-nums">{item.qty}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onIncrease(item)} aria-label={`${item.name} 수량 늘리기`}><Plus /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}