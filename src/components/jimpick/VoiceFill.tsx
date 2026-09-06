/**
 * 말로 고객 정보를 채우는 버튼.
 *
 * 한 번 누르면 사장님이 「종료」를 누를 때까지 계속 듣습니다.
 * 중간에 잠깐 쉬어도 끊기지 않고, 브라우저가 스스로 멈추면 즉시 다시 잇습니다.
 * 들은 내용은 바로 넣지 않고, 확인 화면에서 고른 것만 넣습니다.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";
import { useApp, type Estimate } from "@/lib/jimpick";
import { tap } from "@/lib/feedback";
import { Card, PrimaryButton } from "@/components/jimpick/ui";
import { parseEstimateVoice, mergeTranscript, type VoiceField } from "@/lib/voice-fields";
import {
  recognitionCtor,
  isSecureForMic,
  INSECURE_MIC_MESSAGE,
  speechErrorMessage,
  bestAlternative,
  type RecognitionLike,
  type SpeechEventLike,
  type SpeechErrorLike,
} from "@/lib/voice";

type Status = "idle" | "listening" | "parsing" | "done" | "error";

export function VoiceFill() {
  const { draft, updateDraft } = useApp();
  const [status, setStatus] = useState<Status>("idle");
  const [hint, setHint] = useState("");
  /** 지금까지 들은 말 전체 */
  const [text, setText] = useState("");
  /** 지금 말하고 있는 중간 결과 */
  const [interim, setInterim] = useState("");
  /** 확인 화면 */
  const [fields, setFields] = useState<VoiceField[] | null>(null);
  const [keep, setKeep] = useState<Record<string, boolean>>({});
  const [edited, setEdited] = useState<Record<string, string>>({});

  const recRef = useRef<RecognitionLike | null>(null);
  const keepListening = useRef(false);
  const textRef = useRef("");

  useEffect(() => {
    return () => {
      keepListening.current = false;
      try {
        recRef.current?.abort();
      } catch {
        /* 이미 멈춤 */
      }
    };
  }, []);

  const fail = (msg: string) => {
    setStatus("error");
    setHint(msg);
    toast.error(msg);
  };

  const start = () => {
    const SR = recognitionCtor();
    if (!SR) {
      fail("이 기기는 음성 인식을 지원하지 않습니다. 갤럭시는 크롬, 아이폰은 사파리로 열어 주세요.");
      return;
    }
    if (!isSecureForMic()) {
      fail(INSECURE_MIC_MESSAGE);
      return;
    }
    textRef.current = "";
    setText("");
    setInterim("");
    setFields(null);
    setHint("");

    const rec = new SR();
    rec.lang = "ko-KR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    recRef.current = rec;

    rec.onresult = (ev: SpeechEventLike) => {
      let live = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (!r.isFinal) {
          live += r[0]?.transcript ?? "";
          continue;
        }
        const best = bestAlternative(r).transcript.trim();
        if (!best) continue;
        textRef.current = mergeTranscript(textRef.current, best);
        setText(textRef.current);
      }
      setInterim(live);
    };

    rec.onerror = (ev: SpeechErrorLike) => {
      const code = ev?.error ?? "";
      // 잠깐 조용한 것뿐이면 계속 듣습니다
      if (code === "no-speech" || code === "aborted") {
        setHint("계속 듣고 있어요. 편하게 말씀하세요.");
        return;
      }
      keepListening.current = false;
      setStatus("error");
      setHint(speechErrorMessage(code));
      toast.error(speechErrorMessage(code));
    };

    // 브라우저가 스스로 끊어도 바로 다시 잇습니다
    rec.onend = () => {
      if (!keepListening.current) return;
      try {
        rec.start();
      } catch {
        window.setTimeout(() => {
          if (!keepListening.current) return;
          try {
            rec.start();
          } catch {
            keepListening.current = false;
            setStatus("error");
            setHint("음성 인식이 끊겼습니다. 다시 시도해 주세요.");
          }
        }, 350);
      }
    };

    try {
      rec.start();
      keepListening.current = true;
      setStatus("listening");
      setHint("듣는 중이에요 — 다 말씀하시면 종료를 눌러 주세요.");
      tap("soft");
    } catch {
      fail("마이크를 켤 수 없습니다. 잠시 뒤 다시 시도해 주세요.");
    }
  };

  const stop = () => {
    keepListening.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* 이미 멈춤 */
    }
    const all = mergeTranscript(textRef.current, interim);
    setText(all);
    setInterim("");
    if (!all.trim()) {
      setStatus("error");
      setHint("들은 말이 없습니다. 다시 시도해 주세요.");
      return;
    }
    setStatus("parsing");
    setHint("인식 중이에요…");
    // 해석은 기기 안에서 바로 끝납니다
    window.setTimeout(() => {
      const found = parseEstimateVoice(all);
      if (found.length === 0) {
        setStatus("error");
        setHint("말씀에서 넣을 내용을 찾지 못했습니다. 이름·연락처·날짜·주소를 또박또박 말씀해 주세요.");
        return;
      }
      setFields(found);
      setKeep(Object.fromEntries(found.map((f) => [f.key as string, true])));
      setEdited(Object.fromEntries(found.map((f) => [f.key as string, f.text])));
      setStatus("done");
      setHint("인식 완료 — 확인하고 넣어 주세요.");
      tap("success");
    }, 60);
  };

  const applyFields = () => {
    if (!fields) return;
    const patch: Partial<Estimate> = {};
    for (const f of fields) {
      const key = f.key as string;
      if (!keep[key]) continue;
      const raw = (edited[key] ?? f.text).trim();
      if (!raw) continue;
      if (typeof f.value === "number") {
        const n = Number(raw.replace(/[^0-9]/g, ""));
        if (Number.isFinite(n)) (patch as Record<string, unknown>)[key] = n;
      } else if (typeof f.value === "boolean") {
        (patch as Record<string, unknown>)[key] = true;
      } else {
        (patch as Record<string, unknown>)[key] = raw;
      }
    }
    if (Object.keys(patch).length === 0) {
      toast.info("넣을 항목을 하나 이상 골라 주세요");
      return;
    }
    updateDraft(patch);
    setFields(null);
    setStatus("idle");
    setHint("");
    tap("success");
    toast.success(`${Object.keys(patch).length}개 항목을 넣었습니다`);
  };

  const statusText =
    status === "listening"
      ? "듣는 중"
      : status === "parsing"
        ? "인식 중"
        : status === "done"
          ? "인식 완료"
          : status === "error"
            ? "다시 시도"
            : "말로 입력";

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {status === "listening" ? (
          <button
            onClick={stop}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#FF6B6B] to-[#DC2626] py-3.5 text-[15px] font-black text-white shadow-[0_4px_0_#991B1B] active:translate-y-[2px] active:shadow-none"
          >
            <Square className="h-5 w-5" /> 종료하고 확인하기
          </button>
        ) : (
          <button
            onClick={start}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#4C9BFF] to-[#0751D8] py-3.5 text-[15px] font-black text-white shadow-[0_4px_0_#0640A8] active:translate-y-[2px] active:shadow-none"
          >
            {status === "error" ? <RotateCcw className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            {status === "error" ? "다시 시도" : "말로 고객 정보 입력"}
          </button>
        )}
      </div>

      <Card className="rounded-[14px]">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11.5px] font-black ${
              status === "listening"
                ? "bg-[#DBEAFE] text-[#0751D8]"
                : status === "parsing"
                  ? "bg-[#FEF3C7] text-[#B45309]"
                  : status === "done"
                    ? "bg-[#DCFCE7] text-[#15803D]"
                    : status === "error"
                      ? "bg-[#FEE2E2] text-[#B91C1C]"
                      : "bg-[#EEF2F7] text-[#6B7280]"
            }`}
          >
            {statusText}
          </span>
          {status === "listening" && (
            <span className="text-[12px] font-semibold text-[#6B7280]">
              잠깐 쉬어도 계속 듣습니다
            </span>
          )}
        </div>
        {hint && <div className="mt-1.5 text-[13px] font-semibold text-[#6B7280]">{hint}</div>}
        {(text || interim) && (
          <div className="mt-1.5 whitespace-pre-wrap break-words text-[14px] text-[#111827]">
            {text}
            {interim && <span className="text-[#9AA4B2]"> {interim}</span>}
          </div>
        )}
      </Card>

      {/* 넣기 전에 한 번에 확인·수정 */}
      {fields && (
        <Card className="rounded-[14px]">
          <div className="text-[14px] font-black text-[#0F172A]">
            이렇게 들었어요. 맞는지 확인해 주세요.
          </div>
          <div className="mt-2 space-y-2">
            {fields.map((f) => {
              const key = f.key as string;
              const prev = (draft as unknown as Record<string, unknown>)[key];
              const hasPrev = prev !== "" && prev !== 0 && prev !== false && prev != null;
              return (
                <div key={key} className="rounded-2xl bg-[#F7F9FC] p-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setKeep((k) => ({ ...k, [key]: !k[key] }))}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
                        keep[key]
                          ? "border-[#0751D8] bg-[#0751D8] text-white"
                          : "border-[#DCE8FA] bg-white text-transparent"
                      }`}
                      aria-label={`${f.label} 넣기`}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <span className="w-[86px] shrink-0 text-[12.5px] font-bold text-[#6B7280]">
                      {f.label}
                    </span>
                    <input
                      value={edited[key] ?? f.text}
                      onChange={(e) => setEdited((s) => ({ ...s, [key]: e.target.value }))}
                      className="min-w-0 flex-1 rounded-xl border border-[#DFE6F2] bg-white px-2.5 py-2 text-[14px]"
                    />
                  </div>
                  {hasPrev && (
                    <div className="mt-1 pl-8 text-[11.5px] font-semibold text-[#B45309]">
                      지금 값 「{String(prev)}」 이 이 값으로 바뀝니다
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                setFields(null);
                setStatus("idle");
                setHint("");
              }}
              className="flex-1 rounded-2xl border border-[#E7EBF2] bg-white py-3 text-[14px] font-bold text-[#6B7280]"
            >
              취소
            </button>
            <PrimaryButton onClick={applyFields} className="flex-1">
              골라서 넣기
            </PrimaryButton>
          </div>
        </Card>
      )}
    </div>
  );
}
