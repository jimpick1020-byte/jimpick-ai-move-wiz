import { useMemo, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Video, Film, Trash2, Check, RefreshCw, Bot } from "lucide-react";
import { toast } from "sonner";

import { useApp, DEFAULT_ROOMS } from "@/lib/jimpick";
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
  const [preview, setPreview] = useState<{ url: string; kind: "photo" | "video" } | null>(null);
  const startedAt = useRef<number>(0);

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
    setResults([]);
    setPacking(null);
    startedAt.current = Date.now();
    try {
      const res = await recognizeItems({ data: { images, source } });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setResults(res.items);
      setPacking(res.packingEstimate);
      setRoomGuess(res.roomGuess);
      setRoomConf(res.roomConfidence);
      // AI가 인식한 공간이 5단계에서 고른 방에 있으면 자동으로 선택합니다.
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

  const onPhoto = async (f: File) => {
    setPreview({ url: URL.createObjectURL(f), kind: "photo" });
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
    setPreview({ url: URL.createObjectURL(f), kind: "video" });
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
    setScreen("step6");
  };

  const apply = () => {
    if (!targetRoom) return toast.error("적용할 방을 선택하세요");
    if (results.length === 0) return toast.error("먼저 촬영해서 품목을 인식해 주세요");
    const dups = results.filter((r) => (targetRoom.items[r.id] || 0) > 0).map((r) => r.name);
    if (dups.length > 0) return setDupAsk(dups);
    merge("sum");
  };

  const UploadBtn = ({
    label,
    icon: Icon,
    accept,
    capture,
    onFile,
  }: {
    label: string;
    icon: typeof Camera;
    accept: string;
    capture?: boolean;
    onFile: (f: File) => void;
  }) => (
    <label className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white border border-[#DFE6F2] font-bold text-sm text-[#0751D8] shadow-[0_10px_20px_-12px_rgba(8,103,232,0.55),inset_0_1px_0_#fff] cursor-pointer transition-transform active:scale-[0.97]">
      <Icon className="w-5 h-5" /> {label}
      <input
        type="file"
        accept={accept}
        {...(capture ? { capture: "environment" as const } : {})}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </label>
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
      <TopBar title="5.5단계. AI 공간 스캔" onBack={() => setScreen("step5")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto pb-24">
        <div className="text-sm text-[#6B7280] -mt-1">촬영하면 공간과 품목을 자동으로 인식해요</div>

        <ScanStage scanning={busy} tags={tags} preview={preview} />

        {(roomGuess || busy) && (
          <Card className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-full bg-[#0867E8] text-white text-xs font-bold">
              {busy ? "AI가 공간을 분석하는 중..." : `AI가 ${roomGuess}으로 인식했어요`}
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

        <div className="grid grid-cols-2 gap-3">
          <UploadBtn label="사진 촬영" icon={Camera} accept="image/*" capture onFile={onPhoto} />
          <UploadBtn label="사진 불러오기" icon={ImageIcon} accept="image/*" onFile={onPhoto} />
          <UploadBtn label="동영상 촬영" icon={Video} accept="video/*" capture onFile={onVideo} />
          <UploadBtn label="동영상 불러오기" icon={Film} accept="video/*" onFile={onVideo} />
        </div>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-[#6B7280]">적용할 방</div>
              <div className="font-bold">{targetRoom?.name ?? "선택 안 됨"}</div>
            </div>
            <button
              onClick={() => {
                tap("soft");
                setPicking((v) => !v);
              }}
              className="px-3 py-2 rounded-xl border border-[#287BFF] text-[#0751D8] text-sm font-bold flex items-center gap-1 transition-transform active:scale-[0.97]"
            >
              <RefreshCw className="w-4 h-4" /> 다른 방으로 변경
            </button>
          </div>
          {picking && (
            <div className="flex flex-wrap gap-2 mt-3">
              {draft.rooms.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setTargetRoomId(r.id);
                    setPicking(false);
                    tap("soft");
                  }}
                  className={`px-3 py-2 rounded-full text-sm font-semibold ${
                    r.id === targetRoomId
                      ? "bg-[#0751D8] text-white"
                      : "bg-white border border-[#E7EBF2] text-[#6B7280]"
                  }`}
                >
                  {r.name}
                </button>
              ))}
              {DEFAULT_ROOMS.length === 0 && <span className="text-xs text-[#6B7280]">방이 없습니다</span>}
            </div>
          )}
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

        {results.length > 0 && (
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
          </div>
        )}
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
            {busy ? "분석 중..." : "6단계 품목에 적용"}
          </PrimaryButton>
          <button
            onClick={() => {
              tap("click");
              setScreen("step6");
            }}
            className="w-full py-3 rounded-2xl border border-[#E7EBF2] font-bold text-[#6B7280] transition-transform active:scale-[0.98]"
          >
            건너뛰고 품목 입력하기
          </button>
        </div>
      </BottomButtonBar>
    </MobileShell>
  );
}
