import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator, ChevronLeft } from "lucide-react";
import { useApp, ITEM_CATALOG, roomSummary } from "@/lib/jimpick";
import { MobileShell, PrimaryButton, BottomButtonBar } from "@/components/jimpick/ui";
import { Art3D, ITEM_IMG, ROOM_IMG, guessItemImg, FALLBACK_IMG } from "@/lib/jimpick-art";
import { SIZE_TABS, ROOM_TINT } from "@/components/jimpick/screens";
import { tap } from "@/lib/feedback";

/** 평수별 3D 평면도 배치 (열 스팬으로 집 구조를 표현) */
const PLAN_LAYOUT: Record<string, Record<string, string>> = {
  "10~20평": { 안방: "col-span-4", 거실: "col-span-4", 부엌: "col-span-2", 베란다: "col-span-2" },
  "20~30평": { 안방: "col-span-2", 작은방: "col-span-2", 거실: "col-span-4", 부엌: "col-span-2", 베란다: "col-span-2" },
  "30~40평": {
    안방: "col-span-2", 작은방: "col-span-2", 입구방: "col-span-2",
    거실: "col-span-4", 부엌: "col-span-2", 베란다: "col-span-2",
  },
  "40~50평": {
    안방: "col-span-2", 작은방: "col-span-2", 입구방: "col-span-2", 옷방: "col-span-2",
    거실: "col-span-4", 부엌: "col-span-2", 베란다: "col-span-2",
  },
  "50~60평": {
    안방: "col-span-2", 작은방: "col-span-2", 입구방: "col-span-2", 옷방: "col-span-2",
    서재: "col-span-2", 거실: "col-span-4", 부엌: "col-span-2", 베란다: "col-span-2",
  },
};

export function Plan3D() {
  const { draft, updateDraft, setScreen } = useApp();
  const [size, setSize] = useState<string>(draft.sizeTab || "30~40평");
  const [open, setOpen] = useState<string | null>(null);

  const sizeRooms = (SIZE_TABS.find((t) => t.key === size) || SIZE_TABS[2]).rooms;
  const layout = PLAN_LAYOUT[size] || PLAN_LAYOUT["30~40평"];

  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of ITEM_CATALOG) map.set(i.id, i.name);
    for (const c of draft.customItems || []) map.set(c.id, c.name);
    return map;
  }, [draft.customItems]);

  /** 평수를 바꾸면 없는 공간만 새로 만들고, 담긴 품목은 그대로 유지합니다 */
  const pickSize = (key: string) => {
    tap("soft");
    setSize(key);
    const rooms = (SIZE_TABS.find((t) => t.key === key) || SIZE_TABS[2]).rooms;
    const missing = rooms.filter((n) => !draft.rooms.some((r) => r.name === n));
    updateDraft({
      sizeTab: key,
      ...(missing.length
        ? {
            rooms: [
              ...draft.rooms,
              ...missing.map((n) => ({ id: `r_${n}`, name: n, items: {} as Record<string, number> })),
            ],
          }
        : {}),
    });
    toast.success(`${key} 구조로 평면도를 바꿨습니다`);
  };

  const roomOf = (name: string) => draft.rooms.find((r) => r.name === name);
  const totals = draft.rooms.reduce(
    (a, r) => {
      const s = roomSummary(r.items);
      return { kinds: a.kinds + s.kinds, count: a.count + s.count };
    },
    { kinds: 0, count: 0 },
  );

  const openRoom = open ? roomOf(open) : undefined;

  return (
    <MobileShell>
      <div className="px-4 pt-2 pb-3 bg-white border-b border-[#E7EBF2]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              tap("soft");
              setScreen("step6");
            }}
            aria-label="5단계로 돌아가기"
            className="shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-b from-white to-[#F1F6FF] border border-[#DCE8FA] flex items-center justify-center text-[#0751D8] shadow-[0_4px_0_#DCE8FA,inset_0_1px_0_#fff] active:translate-y-[2px] active:shadow-[0_1px_0_#DCE8FA]"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-[20px] font-black text-[#0F172A] leading-tight">
            6단계. 3D 품목 확인
          </h1>
          <div className="shrink-0 w-10" />
        </div>
        <p className="mt-2 text-center text-[12px] text-[#6B7280] font-semibold">
          {size} 구조 · 품목 {totals.kinds}종 · 총 {totals.count}개
        </p>
      </div>

      {/* 평수 선택 */}
      <div className="bg-white border-b border-[#E7EBF2] px-4 py-3">
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SIZE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => pickSize(t.key)}
              className={`px-4 py-2.5 rounded-2xl text-[14px] font-black whitespace-nowrap transition-all active:translate-y-[2px] ${
                t.key === size
                  ? "text-white bg-gradient-to-b from-[#4C9BFF] to-[#0751D8] shadow-[0_4px_0_#0640A8,inset_0_1px_0_rgba(255,255,255,0.5)]"
                  : "text-[#2A6FD6] bg-gradient-to-b from-white to-[#F1F6FF] shadow-[0_3px_0_#DCE8FA,inset_0_1px_0_#fff]"
              }`}
            >
              {t.key}
            </button>
          ))}
        </div>
      </div>

      {/* 3D 입체 평면도 */}
      <div className="flex-1 overflow-auto p-4 pb-8 bg-gradient-to-b from-[#EEF6FF] to-[#DCE7F8]">
        <div className="[perspective:1200px]">
          <div className="grid grid-cols-4 gap-2.5 rounded-3xl p-3 bg-gradient-to-b from-white/80 to-[#EAF2FF]/80 border border-[#DCE8FA] shadow-[0_14px_30px_-16px_rgba(7,81,216,0.55)] [transform:rotateX(9deg)] [transform-style:preserve-3d]">
            {sizeRooms.map((name) => {
              const r = roomOf(name);
              const s = roomSummary(r?.items || {});
              const entries = Object.entries(r?.items || {});
              return (
                <button
                  key={name}
                  onClick={() => {
                    tap("soft");
                    setOpen(name);
                  }}
                  className={`${layout[name] || "col-span-2"} relative text-left rounded-2xl p-2.5 bg-gradient-to-b from-white to-[#F2F7FF] border border-[#DCE8FA] shadow-[0_8px_0_#E1EAF8,0_16px_26px_-14px_rgba(7,81,216,0.45),inset_0_1px_0_#fff] active:translate-y-[3px] active:shadow-[0_2px_0_#E1EAF8] transition-transform`}
                >
                  <span
                    className={`inline-block px-2.5 py-1 rounded-xl text-white text-[13px] font-black bg-gradient-to-b ${
                      ROOM_TINT[name] || "from-[#4C9BFF] to-[#0751D8]"
                    } shadow-[0_3px_0_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.45)]`}
                  >
                    {name}
                  </span>
                  <div className="mt-1 flex items-center justify-center h-[74px]">
                    <Art3D src={ROOM_IMG[name] || ROOM_IMG["작은방"]} alt={name} size={72} />
                  </div>
                  {entries.length > 0 && (
                    <div className="mt-1 flex flex-wrap justify-center gap-1">
                      {entries.slice(0, 8).map(([id, qty]) => {
                        const nm = nameOf.get(id) || id;
                        return (
                          <span
                            key={id}
                            className="relative rounded-xl bg-gradient-to-b from-white to-[#EAF2FF] border border-[#CFE0FA] p-0.5 shadow-[0_2px_0_#DCE8FA,inset_0_1px_0_#fff]"
                          >
                            <Art3D src={ITEM_IMG[id] || guessItemImg(nm) || FALLBACK_IMG} alt={nm} size={24} />
                            {qty > 1 && (
                              <span className="absolute -top-1 -right-1 px-1 rounded-full bg-[#0751D8] text-white text-[9px] font-black">
                                {qty}
                              </span>
                            )}
                          </span>
                        );
                      })}
                      {entries.length > 8 && (
                        <span className="self-center text-[11px] font-black text-[#0751D8]">
                          +{entries.length - 8}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-1 text-center text-[11px] font-extrabold text-[#0F172A]">
                    {s.kinds > 0 ? `품목 ${s.kinds}종 · 총 ${s.count}개` : "품목 없음"}
                  </div>
                  {s.count > 0 && (
                    <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-gradient-to-b from-[#4C9BFF] to-[#0751D8] text-white text-[12px] font-black flex items-center justify-center shadow-[0_3px_0_#0640A8,inset_0_1px_0_rgba(255,255,255,0.5)]">
                      {s.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-center text-[12px] font-semibold text-[#6B7280]">
          평수를 바꾸면 담은 품목이 새 구조에 그대로 옮겨집니다
        </p>
      </div>

      <BottomButtonBar>
        <PrimaryButton onClick={() => setScreen("options")}>
          <span className="inline-flex items-center gap-2">
            <Calculator className="w-6 h-6" /> 다음: 옵션·보관료
          </span>
        </PrimaryButton>
      </BottomButtonBar>

      {/* 공간별 품목 상세 */}
      {openRoom && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-[#0F172A]/45 backdrop-blur-[2px]" onClick={() => setOpen(null)} />
          <div className="relative w-full max-w-md max-h-[80dvh] overflow-auto rounded-t-3xl bg-gradient-to-b from-white to-[#F5F9FF] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-14px_40px_rgba(7,81,216,0.28)]">
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-xl text-white text-[15px] font-black bg-gradient-to-b ${
                  ROOM_TINT[openRoom.name] || "from-[#4C9BFF] to-[#0751D8]"
                } shadow-[0_3px_0_rgba(0,0,0,0.18)]`}
              >
                {openRoom.name}
              </span>
              <span className="text-[13px] font-extrabold text-[#6B7280]">
                {roomSummary(openRoom.items).kinds}종 · {roomSummary(openRoom.items).count}개
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {Object.entries(openRoom.items).length === 0 && (
                <p className="text-[13px] font-bold text-[#9AA4B2]">담긴 품목이 없습니다</p>
              )}
              {Object.entries(openRoom.items).map(([id, qty]) => {
                const nm = nameOf.get(id) || id;
                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-white border border-[#E3EBF7] shadow-[0_3px_0_#EDF2FA,inset_0_1px_0_#fff]"
                  >
                    <Art3D src={ITEM_IMG[id] || guessItemImg(nm) || FALLBACK_IMG} alt={nm} size={40} />
                    <span className="flex-1 font-extrabold text-[15px] text-[#0F172A]">{nm}</span>
                    <span className="font-black text-[15px] text-[#0751D8] tabular-nums">{qty}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <PrimaryButton
                onClick={() => {
                  setOpen(null);
                  setScreen("step6");
                }}
              >
                5단계에서 품목 수정하기
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
