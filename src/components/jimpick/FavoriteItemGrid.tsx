import { DndContext, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemArt } from "@/lib/jimpick-art";

function FavoriteCard({ id, name, index, busy, onRemove }: { id: string; name: string; index: number; busy: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: busy });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} data-favorite-card={id} className={`relative flex h-36 min-w-0 flex-col items-center justify-end rounded-lg border border-border bg-card px-1 pb-2 ${isDragging ? "z-10 opacity-70 ring-2 ring-auth-primary" : ""}`}>
    <span className="absolute left-2 top-2 text-xs font-black text-muted-foreground">{index + 1}</span>
    <Button variant="ghost" size="icon" disabled={busy} className="absolute right-0 top-0 size-8 text-destructive" aria-label={`${name} 삭제`} onClick={onRemove}><X className="size-4" /></Button>
    <div {...attributes} {...listeners} className="flex w-full cursor-grab flex-col items-center active:cursor-grabbing" aria-label={`${name} 순서 변경`}>
      <ItemArt id={id} name={name} size={54} />
      <span className="mt-1 line-clamp-2 h-10 w-full break-words text-center text-sm font-bold leading-5">{name}</span>
    </div>
    <Button variant="ghost" size="icon" disabled={busy} {...attributes} {...listeners} className="h-5 w-9 touch-none text-muted-foreground" aria-label={`${name} 드래그 손잡이`}><GripVertical className="size-4" /></Button>
  </div>;
}

export function FavoriteItemGrid({ ids, label, busy, onChange, onRemove }: { ids: string[]; label: (id: string) => string; busy: boolean; onChange: (ids: string[]) => void; onRemove: (id: string) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 350, tolerance: 7 } }), useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 7 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const end = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || busy) return;
    const from = ids.indexOf(String(active.id)); const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onChange(arrayMove(ids, from, to));
  };
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}><SortableContext items={ids} strategy={rectSortingStrategy}><div className="grid grid-cols-3 gap-2">{ids.map((id, index) => <FavoriteCard key={id} id={id} name={label(id)} index={index} busy={busy} onRemove={() => onRemove(id)} />)}</div></SortableContext></DndContext>;
}