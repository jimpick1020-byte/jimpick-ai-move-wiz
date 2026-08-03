import { useMemo, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Video, Film, Trash2, Check, RefreshCw, Bot } from "lucide-react";
import { RoomManager } from "./RoomManager";
import { toast } from "sonner";

import { useApp, DEFAULT_ROOMS, roomSummary } from "@/lib/jimpick";
import { MobileShell, TopBar, PrimaryButton, BottomButtonBar, Card, Counter } from "./ui";
import { Art3D, ITEM_IMG, guessItemImg, FALLBACK_IMG } from "@/lib/jimpick-art";
import { recognizeItems, type DetectedItem, type PackingEstimate } from "@/lib/ai.functions";
import { fileToDataUrl, videoToFrames } from "@/lib/media";
import { tap } from "@/lib/feedback";

const HIGH = 0.9;
const SCAN_LOG_KEY = "jimpick_scan_log";

/** 분석 이력 기록 (정확도 검증용) */
function logScan(entry: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SCAN_LOG_KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    list.unshift({ at: new Date().toISOString(), ...entry });
    localStorage.setItem(SCAN_LOG_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* 이력 저장 실패는 무시합니다 */
  }
}

/** 3D 아이소메트릭 스캔 룸 — 스캔선·코너 마커·그리드·마스코트 */
function ScanStage({
  scanning,
  tags,
  preview,
}: {
  scanning: boolean;
  tags: { label: string; top: string; left: string }[];
  preview?: { url: string; kind: "photo" | "video" } | null;
}) {
  return (
    <div className="relative h-[240px] rounded-3xl overflow-hidden border border-[#DCE8FB] bg-gradient-to-b from-white to-[#EAF2FF] shadow-[0_18px_36px_-18px_rgba(8,103,232,0.45),inset_0_1px_0_#fff]">
      {/* 그리드 오버레이 */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(8,103,232,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(8,103,232,0.14) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          transform: "perspective(420px) rotateX(52deg) scale(1.5)",
          transformOrigin: "center 70%",
        }}
      />
      {preview ? (
        preview.kind === "video" ? (
          <video src={preview.url} controls className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <img src={preview.url} alt="촬영한 공간" className="absolute inset-0 w-full h-full object-cover" />
        )
      ) : (
        /* 3D 아이소메트릭 방 */
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="jp-float">
          <div
            className="relative w-[150px] h-[110px]"
            style={{ transform: "rotateX(56deg) rotateZ(-45deg)", transformStyle: "preserve-3d" }}
          >
            <div className="absolute inset-0 rounded-md bg-gradient-to-br from-[#CFE2FF] to-[#9CC4FF] shadow-[0_20px_30px_-10px_rgba(8,103,232,0.5)]" />
            <div className="absolute left-3 top-3 w-14 h-10 rounded-sm bg-[#0867E8]/80" />
            <div className="absolute right-4 bottom-4 w-10 h-10 rounded-sm bg-[#4A94FF]/80" />
            <div className="absolute right-5 top-4 w-8 h-6 rounded-sm bg-[#0751D8]/70" />
          </div>
          </div>
        </div>
      )}

      {/* 코너 프레임 마커 */}
      {[
        "left-3 top-3 border-l-2 border-t-2 rounded-tl-lg",
        "right-3 top-3 border-r-2 border-t-2 rounded-tr-lg",
        "left-3 bottom-3 border-l-2 border-b-2 rounded-bl-lg",
        "right-3 bottom-3 border-r-2 border-b-2 rounded-br-lg",
      ].map((c) => (
        <span key={c} className={`absolute w-7 h-7 border-[#0867E8] ${c}`} />
      ))}

      {/* 스캔 라인 */}
      {scanning && (
        <>
          <span
            aria-hidden
            className="absolute left-0 right-0 h-[3px] jp-scanline"
            style={{
              background: "linear-gradient(90deg, transparent, #0867E8, transparent)",
              boxShadow: "0 0 18px 4px rgba(8,103,232,0.55)",
            }}
          />
          <div className="absolute inset-0 bg-[#0867E8]/5" />
        </>
      )}

      {/* 떠 있는 3D 태그 */}
      {tags.map((t, i) => (
        <span
          key={t.label}
          className="absolute px-2.5 py-1 rounded-full bg-white/95 border border-[#BFD9FF] text-[11px] font-bold text-[#0751D8] shadow-[0_8px_14px_-6px_rgba(8,103,232,0.6)] jp-float"
          style={{ top: t.top, left: t.left, animationDelay: `${i * 0.25}s` }}
        >
          {t.label}
        </span>
      ))}

      {/* 마스코트 로봇 */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center jp-float">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-[#4A94FF] to-[#0751D8] flex items-center justify-center shadow-[0_10px_18px_-8px_rgba(8,103,232,0.8)]">
          <Bot className="w-6 h-6 text-white" />
        </div>
        {scanning && <span className="mt-1 text-[10px] font-bold text-[#0867E8]">스캔 중...</span>}
      </div>
    </div>
  );
}

export function AIScan() {
  const { draft, updateDraft, setScreen, currentRoomId, setCurrentRoom } = useApp();
  const currentRoom = draft.rooms.find((r) => r.id === currentRoomId) || draft.rooms[0];

  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<DetectedItem[]>([]);
  const [packing, setPacking] = useState<PackingEstimate | null>(null);
  const [roomGuess, setRoomGuess] = useState<string | null>(null);
  const [roomConf, setRoomConf] = useState<number | null>(null);
  const [targetRoomId, setTargetRoomId] = useState<string>(currentRoom?.id ?? "");
  const [picking, setPicking] = useState(false);
  const [dupAsk, setDupAsk] = useState<string[] | null>(null);
  const [shots, setShots] = useState<{ id: string; url: string; kind: "photo" | "video" }[]>([]);
  const [preview, setPreview] = useState<{ url: string; kind: "photo" | "video" } | null>(null);
  const [newItem, setNewItem] = useState("");

  const startedAt = useRef<number>(0);
  const photoCamRef = useRef<HTMLInputElement>(null);
  const photoLibRef = useRef<HTMLInputElement>(null);
  const videoCamRef = useRef<HTMLInputElement>(null);
  const videoLibRef = useRef<HTMLInputElement>(null);

  const targetRoom = draft.rooms.find((r) => r.id === targetRoomId) || currentRoom;

  const tags = useMemo(
    () =>
      results.slice(0, 4).map((r, i) => ({
        label: `${r.name} ${r.qty}`,
        top: ["18%", "30%", "56%", "44%"][i],
        left: ["10%", "58%", "16%", "62%"][i],
      })),
    [results],
  );

  const analyze = async (images: string[], source: "photo" | "video") => {
    setBusy(true);
    startedAt.current = Date.now();
    try {
      const res = await recognizeItems({ data: { images, source } });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      // 여러 장을 연속으로 찍어도 결과가 누적되도록 같은 품목은 큰 수량 기준으로 합칩니다.
      setResults((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        for (const it of res.items) {
          const old = map.get(it.id);
          map.set(
            it.id,
            old
              ? { ...old, qty: Math.max(old.qty, it.qty), confidence: Math.max(old.confidence, it.confidence) }
              : it,
          );
        }
        return Array.from(map.values());
      });
      const pe = res.packingEstimate;
      setPacking((prev) =>
        prev && pe
          ? {
              clothesBox: Math.max(prev.clothesBox, pe.clothesBox),
              largeBox: Math.max(prev.largeBox, pe.largeBox),
              mediumBox: Math.max(prev.mediumBox, pe.mediumBox),
              basket: Math.max(prev.basket, pe.basket),
              vinyl: Math.max(prev.vinyl, pe.vinyl),
            }
          : (pe ?? prev),
      );

      setRoomGuess(res.roomGuess);
      setRoomConf(res.roomConfidence);
      // AI가 인식한 공간이 등록된 방에 있으면 자동으로 선택합니다.
      const matched = draft.rooms.find((r) => r.name === res.roomGuess);
      if (matched) setTargetRoomId(matched.id);
      logScan({
        source,
        frames: images.length,
        ms: Date.now() - startedAt.current,
        roomGuess: res.roomGuess,
        roomConfidence: res.roomConfidence,
        items: res.items.map((i) => ({ name: i.name, qty: i.qty, confidence: i.confidence })),
      });
      if (res.items.length === 0) toast.info("인식된 품목이 없습니다. 더 밝고 가까이 촬영해 주세요.");
      else {
        tap("success");
        toast.success(`${res.items.length}개 품목을 인식했습니다`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI 분석에 실패했습니다");
    } finally {
      setBusy(false);
    }
  };

  const addShot = (f: File, kind: "photo" | "video") => {
    const url = URL.createObjectURL(f);
    setPreview({ url, kind });
    setShots((s) => [...s, { id: `s_${Date.now()}`, url, kind }]);
  };

  const onPhoto = async (f: File) => {
    addShot(f, "photo");
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(f);
      await analyze([dataUrl], "photo");
    } catch {
      toast.error("사진을 읽지 못했습니다");
      setBusy(false);
    }
  };

  const onVideo = async (f: File) => {
    addShot(f, "video");
    setBusy(true);
    try {
      // 일정 간격으로 프레임을 뽑아 분석하고, 같은 물건은 최대 수량 기준으로 합칩니다.
      const frames = await videoToFrames(f, 6);
      await analyze(frames, "video");
    } catch {
      toast.error("동영상을 분석하지 못했습니다");
      setBusy(false);

    }
  };

  const merge = (mode: "sum" | "separate") => {
    if (!targetRoom) return;
    const items = { ...targetRoom.items };
    const customs = [...(draft.customItems || [])];
    for (const r of results) {
      const has = (items[r.id] || 0) > 0;
      if (!has || mode === "sum") {
        items[r.id] = (items[r.id] || 0) + r.qty;
      } else {
        // 별도 추가 — 새 품목으로 따로 담습니다.
        const id = `ci_${r.id}_${Date.now()}`;
        customs.push({ id, name: `${r.name} (AI)`, cat: "잔짐", extra: 0 });
        items[id] = r.qty;
      }
    }
    updateDraft({
      customItems: customs,
      rooms: draft.rooms.map((x) => (x.id === targetRoom.id ? { ...x, items } : x)),
    });
    setCurrentRoom(targetRoom.id);
    setDupAsk(null);
    tap("success");
    toast.success(`「${targetRoom.name}」에 ${results.length}개 품목을 적용했습니다`);
    setScreen("options");
  };

  const apply = () => {
    if (!targetRoom) return toast.error("적용할 방을 선택하세요");
    if (results.length === 0) return toast.error("먼저 촬영해서 품목을 인식해 주세요");
    const dups = results.filter((r) => (targetRoom.items[r.id] || 0) > 0).map((r) => r.name);
    if (dups.length > 0) return setDupAsk(dups);
    merge("sum");
  };

  const handleFiles = (files: FileList | null, kind: "photo" | "video") => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    list.forEach((f) => (kind === "photo" ? onPhoto(f) : onVideo(f)));
  };

  const UploadBtn = ({
    label,
    icon: Icon,
    inputRef,
  }: {
    label: string;
    icon: typeof Camera;
    inputRef: React.RefObject<HTMLInputElement | null>;
  }) => (
    <button
      type="button"
      onClick={() => {
        tap("click");
        inputRef.current?.click();
      }}
      className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white border border-[#DFE6F2] font-bold text-sm text-[#0751D8] shadow-[0_10px_20px_-12px_rgba(8,103,232,0.55),inset_0_1px_0_#fff] cursor-pointer transition-transform active:scale-[0.97]"
    >
      <Icon className="w-5 h-5" /> {label}
    </button>
  );

  const packRows = packing
    ? ([
        ["옷박스", packing.clothesBox],
        ["대박스", packing.largeBox],
        ["중박스", packing.mediumBox],
        ["바구니", packing.basket],
        ["비닐 포장", packing.vinyl],
      ] as const).filter(([, v]) => (v || 0) > 0)
    : [];

  return (
    <MobileShell>
      <TopBar title="6단계. AI 공간 스캔" onBack={() => setScreen("step6")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto pb-24">
        <div className="text-sm text-[#6B7280] -mt-1">촬영하면 공간과 품목을 자동으로 인식해요</div>

        {/* 평수를 고르면 방 도면이 나오고, 도면을 눌러 담을 방을 정합니다 */}
        <div className="space-y-3">
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

          <div className="grid grid-cols-3 gap-2.5">
            {sizeRooms.map((name) => {
              const r = draft.rooms.find((x) => x.name === name);
              const s = roomSummary(r?.items || {});
              const on = !!r && r.id === targetRoom?.id;
              return (
                <button
                  key={name}
                  onClick={() => {
                    tap("soft");
                    if (r) setTargetRoomId(r.id);
                  }}
                  className={`relative rounded-2xl p-2 text-center border transition-transform active:translate-y-[2px] ${
                    on
                      ? "border-[#287BFF] bg-gradient-to-b from-[#F5F9FF] to-[#DEEAFF] shadow-[0_6px_0_#BBD3FF,inset_0_1px_0_#fff]"
                      : "border-[#DCE8FA] bg-gradient-to-b from-white to-[#F4F8FF] shadow-[0_5px_0_#EDF2FA,inset_0_1px_0_#fff]"
                  }`}
                >
                  <Art3D src={ROOM_IMG[name] || ROOM_IMG["작은방"]} alt={name} size={58} />
                  <div className="text-[12px] font-black text-[#0F172A]">{name}</div>
                  <div className="text-[10px] font-bold text-[#6B7280]">
                    {s.kinds > 0 ? `${s.kinds}종 · ${s.count}개` : "품목 없음"}
                  </div>
                  {on && (
                    <span className="absolute top-1 right-1 px-1.5 rounded-full bg-[#0751D8] text-white text-[9px] font-black">
                      적용
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>


        <ScanStage scanning={busy} tags={tags} preview={preview} />

        {(roomGuess || busy) && (
          <Card className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-full bg-[#0867E8] text-white text-xs font-bold">
              {busy ? "AI가 공간과 이삿짐을 분석하고 있습니다..." : `AI가 ${roomGuess}으로 인식했어요`}
            </span>
            {!busy && roomConf != null && (
              <span
                className={`text-xs font-bold ${roomConf >= HIGH ? "text-[#10B981]" : "text-[#F59E0B]"}`}
              >
                공간 인식 {Math.round(roomConf * 100)}%
              </span>
            )}
          </Card>
        )}

        {/* 숨겨진 input을 버튼 클릭으로 직접 실행합니다 */}
        <input
          ref={photoCamRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files, "photo");
            e.target.value = "";
          }}
        />
        <input
          ref={photoLibRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files, "photo");
            e.target.value = "";
          }}
        />
        <input
          ref={videoCamRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files, "video");
            e.target.value = "";
          }}
        />
        <input
          ref={videoLibRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files, "video");
            e.target.value = "";
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <UploadBtn label="사진 촬영" icon={Camera} inputRef={photoCamRef} />
          <UploadBtn label="사진 불러오기" icon={ImageIcon} inputRef={photoLibRef} />
          <UploadBtn label="동영상 촬영" icon={Video} inputRef={videoCamRef} />
          <UploadBtn label="동영상 불러오기" icon={Film} inputRef={videoLibRef} />
        </div>



        {shots.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold">촬영 목록 {shots.length}장</div>
              <button
                onClick={() => {
                  tap("soft");
                  setShots([]);
                  setPreview(null);
                  setResults([]);
                  setPacking(null);
                  setRoomGuess(null);
                  setRoomConf(null);
                }}
                className="text-xs font-bold text-[#EF4444]"
              >
                전체 지우고 다시 촬영
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {shots.map((s) => (
                <div key={s.id} className="relative shrink-0">
                  <button
                    onClick={() => {
                      tap("soft");
                      setPreview({ url: s.url, kind: s.kind });
                    }}
                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 ${
                      preview?.url === s.url ? "border-[#0751D8]" : "border-[#E7EBF2]"
                    }`}
                  >
                    {s.kind === "video" ? (
                      <video src={s.url} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={s.url} alt="촬영본" className="w-full h-full object-cover" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      tap("soft");
                      setShots((list) => {
                        const next = list.filter((x) => x.id !== s.id);
                        setPreview(next.length ? { url: next[next.length - 1].url, kind: next[next.length - 1].kind } : null);
                        return next;
                      });
                    }}
                    aria-label="촬영본 삭제"
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center shadow"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}


        <Card>
          <div className="text-xs text-[#6B7280]">적용할 방</div>
          <div className="font-bold">{targetRoom?.name ?? "위 도면에서 방을 선택하세요"}</div>
        </Card>

        {packRows.length > 0 && (
          <Card>
            <div className="font-bold mb-2">포장 단위 예상</div>
            <div className="flex flex-wrap gap-2">
              {packRows.map(([label, v]) => (
                <span
                  key={label}
                  className="px-3 py-1.5 rounded-full bg-[#EEF4FF] text-[#0751D8] text-xs font-bold"
                >
                  {label} {v}개
                </span>
              ))}
            </div>
          </Card>
        )}

        {(results.length > 0 || shots.length > 0) && (
          <div className="space-y-2">
            <div className="font-bold">인식된 품목 {results.length}개</div>

            {results.map((r) => (
              <Card key={r.id} className="flex items-center gap-3">
                <Art3D src={ITEM_IMG[r.id] || guessItemImg(r.name) || FALLBACK_IMG} alt={r.name} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-1.5">
                    <span className="truncate">{r.name}</span>
                    {r.confidence >= HIGH ? (
                      <Check className="w-4 h-4 text-[#10B981] shrink-0" />
                    ) : (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#FFF3E4] text-[#F59E0B] text-[10px] font-bold">
                        확인 필요
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-xs ${r.confidence >= HIGH ? "text-[#10B981]" : "text-[#F59E0B]"}`}
                  >
                    정확도 {Math.round(r.confidence * 100)}%
                    {r.note ? <span className="text-[#6B7280]"> · {r.note}</span> : null}
                  </div>
                </div>
                <Counter
                  value={r.qty}
                  onChange={(n) => setResults(results.map((x) => (x.id === r.id ? { ...x, qty: n } : x)))}
                  min={1}
                />
                <button
                  onClick={() => setResults(results.filter((x) => x.id !== r.id))}
                  className="p-2 text-[#EF4444]"
                  aria-label="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Card>
            ))}

            <Card className="flex items-center gap-2">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="빠진 품목 직접 추가 (예: 안마의자)"
                className="flex-1 min-w-0 px-3 min-h-11 rounded-xl border border-[#DFE6F2] bg-white text-sm focus:outline-none focus:border-[#287BFF]"
              />
              <button
                onClick={() => {
                  const name = newItem.trim();
                  if (!name) return;
                  tap("soft");
                  setResults((prev) => [
                    ...prev,
                    { id: `ai_${Date.now()}`, name, qty: 1, confidence: 1, note: "직접 추가" },
                  ]);
                  setNewItem("");
                }}
                className="shrink-0 px-4 min-h-11 rounded-xl bg-[#0751D8] text-white text-sm font-bold"
              >
                추가
              </button>
            </Card>
          </div>
        )}

        <RoomManager title="공간 스캔용 방 추가 · 삭제" />
      </div>


      {dupAsk && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="font-bold text-lg">이미 있는 품목이 있어요</div>
            <div className="text-sm text-[#6B7280]">
              「{dupAsk.slice(0, 3).join(", ")}
              {dupAsk.length > 3 ? ` 외 ${dupAsk.length - 3}개` : ""}」가 이미 담겨 있습니다. 어떻게 할까요?
            </div>
            <div className="flex flex-col gap-2">
              <PrimaryButton onClick={() => merge("sum")}>수량 합치기</PrimaryButton>
              <button
                onClick={() => merge("separate")}
                className="w-full py-3 rounded-xl border border-[#E7EBF2] font-semibold"
              >
                별도 품목으로 추가
              </button>
              <button
                onClick={() => setDupAsk(null)}
                className="w-full py-3 rounded-xl text-[#6B7280] font-semibold"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomButtonBar>
        <div className="space-y-2">
          <PrimaryButton onClick={apply} disabled={busy || results.length === 0}>
            {busy ? "분석 중..." : "품목 적용하고 다음"}
          </PrimaryButton>
          <button
            onClick={() => {
              tap("click");
              setScreen("options");
            }}
            className="w-full py-3 rounded-2xl border border-[#E7EBF2] font-bold text-[#6B7280] transition-transform active:scale-[0.98]"
          >
            건너뛰고 옵션·보관료로
          </button>
        </div>
      </BottomButtonBar>
    </MobileShell>
  );
}
