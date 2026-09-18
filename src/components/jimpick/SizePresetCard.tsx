/**
 * 설정 > 평수별 기본품목 — 업체별로 저장합니다.
 * 여기서 고친 목록은 5단계에서 평수를 누를 때 자동으로 담깁니다.
 * 이미 저장·확정된 고객 견적서의 품목·금액은 바뀌지 않습니다.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/jimpick/ui";
import { tap } from "@/lib/feedback";
import {
  DEFAULT_SIZE_PRESETS,
  SIZE_KEYS,
  type PresetRoom,
  type SizePresets,
} from "@/lib/size-presets";
import { getSizePresets, resetSizePresets, saveSizePresets } from "@/lib/size-presets.functions";

export function SizePresetCard({ onNeedLogin }: { onNeedLogin?: () => void }) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<string>(SIZE_KEYS[0]!);
  const [presets, setPresets] = useState<SizePresets>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getSizePresets()
      .then((r) => {
        if (!r.ok) {
          onNeedLogin?.();
          return;
        }
        setPresets(Object.keys(r.presets).length ? r.presets : DEFAULT_SIZE_PRESETS);
      })
      .catch(() => onNeedLogin?.())
      .finally(() => setLoading(false));
  }, [open, onNeedLogin]);

  const rooms: PresetRoom[] = presets[size] ?? DEFAULT_SIZE_PRESETS[size] ?? [];

  const setRooms = (next: PresetRoom[]) => setPresets({ ...presets, [size]: next });

  const save = async () => {
    setSaving(true);
    try {
      const r = await saveSizePresets({ data: { presets } });
      if (!r.ok) {
        toast.error(`저장하지 못했습니다: ${r.error}`);
        return;
      }
      setPresets(r.presets);
      toast.success("평수별 기본품목을 저장했습니다");
    } catch {
      toast.error("저장하지 못했습니다. 잠시 후 다시 시도해 주세요");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      const r = await resetSizePresets();
      if (!r.ok) {
        toast.error(`초기화하지 못했습니다: ${r.error}`);
        return;
      }
      setPresets(DEFAULT_SIZE_PRESETS);
      toast.success("기본 설정으로 되돌렸습니다");
    } catch {
      toast.error("초기화하지 못했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-3">
      <button
        onClick={() => {
          tap();
          setOpen((v) => !v);
        }}
        className="w-full text-left"
      >
        <div className="font-bold">평수별 기본품목</div>
        <div className="mt-1 text-xs text-[#6B7280]">
          5단계에서 평수를 누르면 여기 목록이 자동으로 담깁니다
        </div>
      </button>

      {open && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {SIZE_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => setSize(k)}
                className={`min-w-0 rounded-xl py-2 text-[13px] font-black ${
                  k === size
                    ? "bg-[#3578C8] text-white"
                    : "border border-[#E5E7EB] bg-white text-[#2A6FD6]"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-xs font-bold text-[#6B7280]">불러오는 중…</div>
          ) : (
            <div className="space-y-3">
              {rooms.map((room, ri) => (
                <div key={`${room.room}-${ri}`} className="rounded-2xl border border-[#E5E7EB] p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={room.room}
                      onChange={(e) =>
                        setRooms(
                          rooms.map((r, i) => (i === ri ? { ...r, room: e.target.value } : r)),
                        )
                      }
                      aria-label="공간 이름"
                      className="min-w-0 flex-1 rounded-xl border border-[#E5E7EB] px-3 py-2 text-[14px] font-black text-[#25282D]"
                    />
                    <button
                      onClick={() => setRooms(rooms.filter((_, i) => i !== ri))}
                      className="text-[12px] font-black text-[#B4232A]"
                    >
                      공간 삭제
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {room.items.map((it, ii) => (
                      <div key={ii} className="flex items-center gap-2">
                        <input
                          value={it.name}
                          onChange={(e) =>
                            setRooms(
                              rooms.map((r, i) =>
                                i === ri
                                  ? {
                                      ...r,
                                      items: r.items.map((x, j) =>
                                        j === ii ? { ...x, name: e.target.value } : x,
                                      ),
                                    }
                                  : r,
                              ),
                            )
                          }
                          aria-label="품목 이름"
                          className="min-w-0 flex-1 rounded-xl border border-[#E5E7EB] px-3 py-2 text-[14px] font-bold text-[#25282D]"
                        />
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={it.qty}
                          onChange={(e) =>
                            setRooms(
                              rooms.map((r, i) =>
                                i === ri
                                  ? {
                                      ...r,
                                      items: r.items.map((x, j) =>
                                        j === ii
                                          ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) }
                                          : x,
                                      ),
                                    }
                                  : r,
                              ),
                            )
                          }
                          aria-label="수량"
                          className="w-16 rounded-xl border border-[#E5E7EB] px-2 py-2 text-center text-[14px] font-black text-[#25282D]"
                        />
                        <button
                          onClick={() =>
                            setRooms(
                              rooms.map((r, i) =>
                                i === ri
                                  ? { ...r, items: r.items.filter((_, j) => j !== ii) }
                                  : r,
                              ),
                            )
                          }
                          className="text-[12px] font-black text-[#94A3B8]"
                          aria-label="품목 삭제"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        setRooms(
                          rooms.map((r, i) =>
                            i === ri ? { ...r, items: [...r.items, { name: "", qty: 1 }] } : r,
                          ),
                        )
                      }
                      className="w-full rounded-xl border border-dashed border-[#BFD8F5] py-2 text-[13px] font-black text-[#2A6FD6]"
                    >
                      + 품목 추가
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setRooms([...rooms, { room: "", items: [] }])}
                className="w-full rounded-2xl border border-dashed border-[#BFD8F5] py-2.5 text-[13px] font-black text-[#2A6FD6]"
              >
                + 공간 추가
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              disabled={saving}
              onClick={reset}
              className="flex-1 rounded-2xl border border-[#E5E7EB] bg-white py-3 text-[14px] font-black text-[#6B7280] disabled:opacity-60"
            >
              기본값으로
            </button>
            <button
              disabled={saving}
              onClick={save}
              className="flex-1 rounded-2xl bg-[#3578C8] py-3 text-[14px] font-black text-white shadow-[0_3px_0_#285C99] disabled:opacity-60"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
