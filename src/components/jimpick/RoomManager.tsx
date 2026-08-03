import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp, roomSummary } from "@/lib/jimpick";
import { tap } from "@/lib/feedback";
import { Card, TextInput } from "./ui";

/** 자주 쓰는 방 이름 (빠른 추가용) */
export const ROOM_PRESETS = [
  "안방",
  "작은방",
  "입구방",
  "거실",
  "부엌",
  "베란다",
  "옷방",
  "서재",
  "드레스룸",
  "창고",
  "다용도실",
];

/** 방 추가·삭제 카드 — 5단계와 6단계에서 함께 사용합니다 */
export function RoomManager({ title = "방 추가 · 삭제" }: { title?: string }) {
  const { draft, updateDraft, currentRoomId, setCurrentRoom } = useApp();
  const [name, setName] = useState("");

  const addRoom = (raw: string) => {
    const n = raw.trim();
    if (!n) return;
    if (draft.rooms.some((r) => r.name === n)) {
      toast.info(`「${n}」은(는) 이미 있습니다`);
      return;
    }
    const id = `r_${n}_${Date.now()}`;
    updateDraft({ rooms: [...draft.rooms, { id, name: n, items: {} }] });
    setCurrentRoom(id);
    setName("");
    tap("success");
    toast.success(`「${n}」 공간을 추가했습니다`);
  };

  const removeRoom = (id: string, roomName: string) => {
    tap("soft");
    const rooms = draft.rooms.filter((r) => r.id !== id);
    updateDraft({ rooms });
    if (currentRoomId === id) setCurrentRoom(rooms[0]?.id || "");
    toast.success(`「${roomName}」 공간을 삭제했습니다`);
  };

  return (
    <Card className="space-y-3">
      <div className="font-bold">{title}</div>

      <div className="flex flex-wrap gap-2">
        {ROOM_PRESETS.filter((p) => !draft.rooms.some((r) => r.name === p)).map((p) => (
          <button
            key={p}
            onClick={() => addRoom(p)}
            className="px-3 py-2 rounded-full text-[13px] font-bold text-[#0751D8] bg-gradient-to-b from-white to-[#F1F6FF] border border-[#DCE8FA] shadow-[0_3px_0_#DCE8FA,inset_0_1px_0_#fff] active:translate-y-[2px] active:shadow-none"
          >
            + {p}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <TextInput
          placeholder="방 이름 직접 입력 (예: 다락방)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addRoom(name);
          }}
        />
        <button
          onClick={() => addRoom(name)}
          className="shrink-0 px-4 min-h-12 rounded-xl bg-[#0751D8] text-white font-bold flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> 추가
        </button>
      </div>

      <div className="space-y-2">
        {draft.rooms.length === 0 && (
          <p className="text-[13px] font-bold text-[#9AA4B2]">공간이 없습니다. 위에서 추가해 주세요.</p>
        )}
        {draft.rooms.map((r) => {
          const s = roomSummary(r.items);
          return (
            <div
              key={r.id}
              className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-white border border-[#E7EBF2]"
            >
              <span className="font-extrabold text-[15px] text-[#0F172A]">{r.name}</span>
              <span className="text-[12px] font-bold text-[#6B7280]">
                {s.kinds > 0 ? `품목 ${s.kinds}종 · 총 ${s.count}개` : "품목 없음"}
              </span>
              <button
                onClick={() => removeRoom(r.id, r.name)}
                className="ml-auto p-2 text-[#EF4444]"
                aria-label={`${r.name} 삭제`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
