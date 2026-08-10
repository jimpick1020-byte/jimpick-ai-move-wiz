import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ClipboardList,
  Users,
  BarChart3,
  Plus,
  Search,
  Camera,
  Image as ImageIcon,
  Check,
  Trash2,
  Edit3,
  Eye,
  Phone,
  MessageSquare,
  LogOut,
  Truck,
  ArrowUpDown,
  Video,
  Send,
  Link as LinkIcon,
  X,
  ChevronDown,
  ChevronLeft,
  Mic,
} from "lucide-react";

import {
  useApp,
  ITEM_CATALOG,
  CATEGORIES,
  OPTION_PRESETS,
  calcEstimate,
  guessCategory,
  formatPhone,
  won,
  roomSummary,
  calcTruckLoad,
  frequentItemIds,
  formatMoveDateTime,
  storageDays,
  usesStorage,
  makeSheetNo,
  getPricing,
  savePricing,
  DEFAULT_PRICING,
  type Pricing,
  type MoveType,
  type Room,
  type WorkEnv,
} from "@/lib/jimpick";
import {
  MobileShell,
  TopBar,
  PrimaryButton,
  BottomButtonBar,
  BottomNav,
  Counter,
  MoneyInput,
  Card,
  Field,
  TextInput,
} from "./ui";
import { toast } from "sonner";
import { tap } from "@/lib/feedback";
import { KakaoMap } from "./KakaoMap";
import { searchAddress, getRoute, type KakaoPlace } from "@/lib/kakao.functions";
import { recognizeItems, parseVoiceOrder, type DetectedItem } from "@/lib/ai.functions";
import { transcribeAudio } from "@/lib/stt.functions";
import { WavRecorder } from "@/lib/recorder";

/** 음성인식 정확도를 올려 주는 힌트 (자주 쓰는 이사 품목·공간 이름) */
const VOICE_HINT =
  "이사 견적 품목: 냉장고, 김치냉장고, 세탁기, 건조기, 스타일러, TV, 에어컨, 공기청정기, 정수기, 전자레인지, 에어프라이어, 식기세척기, 침대, 매트리스, 장롱, 붙박이장, 화장대, 서랍장, 소파, TV장, 식탁, 의자, 책상, 책장, 신발장, 빨래건조대, 청소기, 로봇청소기, 안마의자, 러닝머신, 피아노, 금고, 어항, 옷박스, 대박스, 중박스, 바구니, 이불백. 공간: 안방, 작은방, 입구방, 거실, 부엌, 베란다.";

/** 녹음된 소리를 서버 AI 음성인식으로 다시 확인해 더 정확한 문장을 얻습니다 */
async function refineWithAiStt(recorder: WavRecorder | null, fallback: string) {
  const audio = recorder?.snapshot();
  if (!audio) return fallback;
  try {
    const r = await transcribeAudio({ data: { audio, hint: VOICE_HINT } });
    const t = (r.text || "").trim();
    return t.length >= 2 ? t : fallback;
  } catch {
    return fallback;
  }
}
import {
  recognitionCtor,
  isSecureForMic,
  speechErrorMessage,
  bestAlternative,
  INSECURE_MIC_MESSAGE,
  type SpeechEventLike,
  type SpeechErrorLike,
  type RecognitionLike,
} from "@/lib/voice";

import { fileToDataUrl, videoToFrames } from "@/lib/media";

// ============ Splash ============
import mascot1 from "@/assets/mascot-1.png";
import mascot2 from "@/assets/mascot-2.png";
import mascot3 from "@/assets/mascot-3.png";
import logoImg from "@/assets/jimpick-logo.png";
import { Art3D, ItemArt, ROOM_IMG, VEHICLE_IMG, CHAR_IMG, ENV_IMG } from "@/lib/jimpick-art";
import { TruckGauge } from "./TruckGauge";
import { EstimateSheet, type SheetRoom } from "./EstimateSheet";
import { ScanMascot, type MascotState } from "./ScanMascot";
import { buildEstimateMessage, isSendablePhone, smsHref, hasSmsApp } from "@/lib/sms";

import {
  FileText,
  Camera as CamIcon,
  MapPin,
  Sparkles,
  UserCircle,
  Hand,
  Calculator,
} from "lucide-react";
import houseImg from "@/assets/step6-house.png";

export function Splash() {
  const { setScreen, loggedIn } = useApp();
  const [mascotIdx, setMascotIdx] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setScreen(loggedIn ? "home" : "login"), 2500);
    return () => clearTimeout(t);
  }, [setScreen, loggedIn]);
  const features = [
    { icon: FileText, label: "간편한 견적 작성" },
    { icon: CamIcon, label: "AI 사진 인식" },
    { icon: MapPin, label: "정확한 거리·시간" },
    { icon: Sparkles, label: "맞춤형 견적 제공" },
    { icon: UserCircle, label: "고객 관리 & 기록" },
  ];
  return (
    <MobileShell bg="bg-white">
      <div
        onClick={() => setScreen(loggedIn ? "home" : "login")}
        className="flex-1 flex flex-col items-center px-8 pt-8 pb-4"
      >
        <div className="text-center">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-6xl font-black text-[#0751D8] tracking-tight drop-shadow-[0_4px_10px_rgba(7,81,216,0.25)]">
              JIMPICK
            </span>
            <span className="text-xl font-bold text-white bg-[#0751D8] rounded-lg px-2.5 py-0.5">
              7.0
            </span>
          </div>
          <div className="text-lg font-bold text-[#111827] mt-3">AI 이사 견적 앱</div>
          <div className="text-sm text-[#6B7280] mt-1">이사 견적, 더 쉽고 정확하게!</div>
        </div>
        <div className="space-y-2 w-full mt-8">
          {features.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="group flex items-center gap-3 px-3 py-2 rounded-2xl transition-all duration-200 hover:bg-gradient-to-r hover:from-[#F3F7FF] hover:to-[#FDF2FA] hover:shadow-[0_10px_24px_-14px_rgba(121,40,202,0.55)] hover:-translate-y-[1px]"
            >
              <Sparkles className="w-4 h-4 text-[#7928CA] shrink-0 transition-transform duration-200 group-hover:scale-125" />
              <div className="w-9 h-9 rounded-xl bg-[#EEF4FF] flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#0751D8]" />
              </div>
              <span className="font-semibold text-[#111827]">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-4 pb-1 flex flex-col items-center gap-2">
          <img
            src={[mascot1, mascot2, mascot3][mascotIdx]}
            alt="JIMPICK 캐릭터"
            className="w-full max-w-[220px] jp-float [image-rendering:auto]"
          />
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {[mascot1, mascot2, mascot3].map((m, i) => (
              <button
                key={i}
                onClick={() => setMascotIdx(i)}
                className={`w-11 h-11 rounded-xl bg-[#F3F7FF] p-1 transition-all ${
                  mascotIdx === i
                    ? "ring-2 ring-[#0751D8] shadow-[0_6px_14px_-6px_rgba(7,81,216,0.6)] -translate-y-[1px]"
                    : "opacity-60"
                }`}
              >
                <img src={m} alt={`캐릭터 시안 ${i + 1}`} className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setScreen(loggedIn ? "home" : "login");
            setTimeout(() => tap("click"), 0);
          }}
          className="w-full mt-2 mb-1 py-5 rounded-2xl text-white text-lg font-black tracking-tight shadow-[0_14px_30px_-10px_rgba(121,40,202,0.6)] transition-transform active:translate-y-[2px]"
          style={{ background: "linear-gradient(90deg,#ff007f 0%,#7928ca 50%,#00dfd8 100%)" }}
        >
          견적 시작하기
        </button>
      </div>
    </MobileShell>
  );
}

// ============ Login ============
export function Login() {
  const { login, savedId, setScreen } = useApp();
  const [id, setId] = useState(savedId || "");
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(!!savedId);
  const [err, setErr] = useState("");
  const submit = () => {
    if (!id) return setErr("아이디를 입력해 주세요.");
    if (!pw) return setErr("비밀번호를 입력해 주세요.");
    if (id !== "jimpick" || pw !== "1234")
      return setErr("아이디 또는 비밀번호가 올바르지 않습니다.");
    login(id, remember);
  };
  return (
    <MobileShell bg="bg-white">
      <div
        className="px-8 pt-10 pb-14 text-white text-center"
        style={{ background: "linear-gradient(135deg, #287BFF 0%, #0751D8 100%)" }}
      >
        <img src={logoImg} alt="JIMPICK" className="w-20 h-20 mx-auto" />
        <div className="text-3xl font-black mt-2">JIMPICK</div>
        <div className="text-sm opacity-90 mt-1">AI 이사 견적</div>
      </div>
      <div className="flex-1 px-6 py-8 space-y-5">
        <div>
          <h2 className="text-2xl font-bold">JIMPICK 로그인</h2>
          <p className="text-sm text-[#6B7280] mt-1">사장님 계정으로 로그인하세요.</p>
        </div>
        <Field label="아이디">
          <TextInput placeholder="jimpick" value={id} onChange={(e) => setId(e.target.value)} />
        </Field>
        <Field label="비밀번호">
          <TextInput
            type="password"
            placeholder="1234"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4"
          />
          아이디 저장
        </label>
        {err && <div className="text-sm text-[#EF4444]">{err}</div>}
        <PrimaryButton onClick={submit}>로그인</PrimaryButton>
        <button
          onClick={() => setScreen("signup")}
          className="w-full py-3 rounded-2xl border border-[#0751D8] text-[#0751D8] font-bold bg-white"
        >
          업체 회원가입 · 구독 신청
        </button>
        <div className="text-center text-sm text-[#6B7280]">아이디/비밀번호 찾기</div>
        <div className="text-center text-xs text-[#6B7280] pt-6">© JIMPICK · Ver 7.0.0</div>
      </div>
    </MobileShell>
  );
}

// ============ Home ============
export function HomeScreen() {
  const { setScreen, resetDraft, estimates } = useApp();
  const total = estimates.length;
  const done = estimates.filter((e) => e.status === "완료").length;
  const inProg = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <MobileShell>
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-[#6B7280]">안녕하세요!</div>
          <div className="text-xl font-bold">짐픽 사장님 👋</div>
        </div>
        <Bell className="w-6 h-6 text-[#111827]" />
      </div>
      <div className="px-5 space-y-4 flex-1 pb-4">
        <div
          onClick={() => {
            resetDraft();
            setScreen("step1");
          }}
          className="rounded-2xl p-5 text-white cursor-pointer active:scale-[0.98] shadow-[0_6px_20px_rgba(15,23,42,0.10)]"
          style={{ background: "linear-gradient(135deg, #287BFF 0%, #0751D8 100%)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold">새 견적 작성</div>
              <div className="text-sm opacity-90 mt-1">새로운 이사 견적을 시작합니다.</div>
            </div>
            <div className="text-5xl">📋</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "견적 내역", icon: ClipboardList, s: "history" as const },
            { label: "고객 관리", icon: Users, s: "customers" as const },
            { label: "통계 확인", icon: BarChart3, s: "stats" as const },
          ].map(({ label, icon: Icon, s }) => (
            <Card
              key={label}
              onClick={() => setScreen(s)}
              className="flex flex-col items-center py-4 gap-2"
            >
              <Icon className="w-7 h-7 text-[#0751D8]" />
              <span className="text-sm font-semibold text-center">{label}</span>
            </Card>
          ))}
        </div>
        <Card>
          <div className="font-bold mb-3">오늘의 견적 현황</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-2xl font-black text-[#0751D8]">{total}</div>
              <div className="text-xs text-[#6B7280]">총 견적</div>
            </div>
            <div>
              <div className="text-2xl font-black text-[#F59E0B]">{inProg}</div>
              <div className="text-xs text-[#6B7280]">진행 중</div>
            </div>
            <div>
              <div className="text-2xl font-black text-[#16A34A]">{done}</div>
              <div className="text-xs text-[#6B7280]">완료</div>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[#F5F7FB] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, background: "linear-gradient(135deg, #287BFF, #0751D8)" }}
            />
          </div>
          <div className="text-xs text-[#6B7280] mt-1 text-right">진행률 {pct}%</div>
        </Card>
      </div>
      <BottomNav />
    </MobileShell>
  );
}

// ============ Step 1: Customer ============
export function Step1() {
  const { draft, updateDraft, setScreen } = useApp();
  const [err, setErr] = useState("");
  const moveTypes: MoveType[] = ["포장이사", "반포장이사", "일반이사", "보관이사", "사무실이사"];
  const next = () => {
    if (!draft.customerName.trim()) return setErr("고객명을 입력해 주세요.");
    if (!draft.phone.trim()) return setErr("연락처를 입력해 주세요.");
    setScreen("step2");
  };
  return (
    <MobileShell>
      <TopBar title="1단계. 고객 정보 입력" onBack={() => setScreen("home")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto pb-24">
        <Field label="고객명">
          <TextInput
            placeholder="홍길동"
            value={draft.customerName}
            onChange={(e) => updateDraft({ customerName: e.target.value })}
          />
        </Field>
        <Field label="연락처">
          <TextInput
            placeholder="010-0000-0000"
            value={draft.phone}
            onChange={(e) => updateDraft({ phone: formatPhone(e.target.value) })}
            inputMode="numeric"
          />
        </Field>
        <Field label="이사 종류">
          <div className="grid grid-cols-2 gap-2">
            {moveTypes.map((t) => (
              <Card
                key={t}
                selected={draft.moveType === t}
                onClick={() => updateDraft({ moveType: t })}
                className="text-center py-3"
              >
                <div className="font-semibold">{t}</div>
              </Card>
            ))}
          </div>
        </Field>
        <Field label="이사 날짜">
          <TextInput
            type="date"
            value={draft.moveDate}
            onChange={(e) =>
              updateDraft({
                moveDate: e.target.value,
                storageStart:
                  !draft.storageStart || draft.storageStart === draft.moveDate
                    ? e.target.value
                    : draft.storageStart,
              })
            }
          />
        </Field>
        <Field label="시작 시간">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={draft.moveTime.split(" ")[0]}
              onChange={(e) =>
                updateDraft({
                  moveTime: `${e.target.value} ${draft.moveTime.split(" ")[1] || "09:00"}`,
                })
              }
              className="px-4 py-3 rounded-xl border border-[#E7EBF2] bg-white text-base"
            >
              <option>오전</option>
              <option>오후</option>
            </select>
            <select
              value={draft.moveTime.split(" ")[1] || "09:00"}
              onChange={(e) =>
                updateDraft({
                  moveTime: `${draft.moveTime.split(" ")[0] || "오전"} ${e.target.value}`,
                })
              }
              className="px-4 py-3 rounded-xl border border-[#E7EBF2] bg-white text-base"
            >
              {Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(2, "0")}:00`).map(
                (h) => (
                  <option key={h}>{h}</option>
                ),
              )}
            </select>
          </div>
        </Field>
        <Field label="고객 메모">
          <textarea
            value={draft.memo}
            onChange={(e) => updateDraft({ memo: e.target.value })}
            placeholder="예) 엘리베이터 예약 필요, 반려동물 있음, 오전 도착 희망 등"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-[#DFE6F2] bg-gradient-to-b from-[#F8FAFD] to-white text-base shadow-[inset_0_2px_4px_rgba(15,23,42,0.06)] focus:outline-none focus:border-[#287BFF] resize-none"
          />
        </Field>
        {err && <div className="text-sm text-[#EF4444]">{err}</div>}
      </div>
      <BottomButtonBar>
        <PrimaryButton onClick={next}>다음: 주소 검색</PrimaryButton>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ Step 2: Address (카카오맵) ============
function AddressSearch({
  label,
  value,
  detail,
  onSelect,
  onDetail,
}: {
  label: string;
  value: string;
  detail: string;
  onSelect: (a: string, coord: { x: number; y: number }) => void;
  onDetail: (d: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<KakaoPlace[]>([]);

  const run = async (query?: string, silent = false) => {
    const term = (query ?? q).trim();
    if (!term) return;
    setLoading(true);
    setOpen(true);
    try {
      const res = await searchAddress({ data: { query: term } });
      if (res.error && !silent) toast.error(res.error);
      setResults(res.places);
      if (!res.error && res.places.length === 0 && !silent) toast.info("검색 결과가 없습니다");
    } catch {
      if (!silent) toast.error("주소 검색에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 입력하면 자동으로 검색 결과를 띄우고, 클릭하면 바로 등록됩니다.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => run(term, true), 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Card className="space-y-3">
      <div className="font-bold">{label}</div>
      <div className="flex gap-2">
        <TextInput
          placeholder="도로명·지번·건물명 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
        />
        <button
          onClick={() => run()}
          className="px-4 rounded-xl text-white font-semibold"
          style={{ background: "linear-gradient(135deg, #287BFF, #0751D8)" }}
        >
          <Search className="w-5 h-5" />
        </button>
      </div>
      {open && (
        <div className="border border-[#E7EBF2] rounded-xl max-h-52 overflow-auto bg-white">
          {loading && <div className="px-4 py-3 text-sm text-[#6B7280]">검색 중...</div>}
          {!loading &&
            results.map((a, i) => (
              <button
                key={`${a.name}-${i}`}
                onClick={() => {
                  onSelect(a.roadAddress || a.address, { x: a.x, y: a.y });
                  setOpen(false);
                  setQ("");
                  tap();
                }}
                className="w-full text-left px-4 py-3 hover:bg-[#F5F7FB] text-sm border-b last:border-b-0 border-[#E7EBF2]"
              >
                <div className="font-semibold">{a.name}</div>
                <div className="text-xs text-[#6B7280]">{a.roadAddress || a.address}</div>
              </button>
            ))}
        </div>
      )}
      {q.trim().length > 0 && (
        <button
          onClick={() => {
            onSelect(q.trim(), { x: 0, y: 0 });
            setOpen(false);
            setQ("");
            tap();
          }}
          className="w-full text-sm font-semibold rounded-xl py-2.5 border border-[#0751D8] text-[#0751D8] bg-white"
        >
          검색이 안 되면: 입력한 주소 그대로 사용
        </button>
      )}
      {value && <div className="text-sm bg-[#F5F7FB] rounded-xl p-3 font-medium">{value}</div>}
      <TextInput
        placeholder="상세주소 (예: 101동 1203호)"
        value={detail}
        onChange={(e) => onDetail(e.target.value)}
      />
    </Card>
  );
}

export function Step2() {
  const { draft, updateDraft, setScreen } = useApp();
  const [path, setPath] = useState<{ x: number; y: number }[] | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const from = draft.fromX && draft.fromY ? { x: draft.fromX, y: draft.fromY } : null;
  const to = draft.toX && draft.toY ? { x: draft.toX, y: draft.toY } : null;
  const hasBoth = Boolean(draft.fromAddress && draft.toAddress);

  useEffect(() => {
    // 출발지·도착지를 모두 선택하기 전에는 계산하지 않습니다.
    if (!from || !to) {
      // 주소는 넣었는데 좌표가 없는 경우 — 「입력한 주소 그대로 사용」으로 넣으면 이렇게 됩니다.
      // 그동안 아무 안내 없이 거리·시간이 비어 있어서 이유를 알 수 없었습니다.
      if (hasBoth) {
        const which = !from && !to ? "출발지와 도착지" : !from ? "출발지" : "도착지";
        setRouteError(
          `${which} 주소를 검색 결과 목록에서 선택해 주세요. 직접 입력한 주소는 위치를 알 수 없어 거리·시간을 계산하지 못합니다.`,
        );
      } else {
        setRouteError(null);
      }
      return;
    }
    let cancelled = false;
    setRouting(true);
    setRouteError(null);
    setPath(null);
    (async () => {
      try {
        const res = await getRoute({
          data: { originX: from.x, originY: from.y, destX: to.x, destY: to.y },
        });
        if (cancelled) return;
        if (!res.ok || !res.distanceKm) {
          // 실패 시 직선거리를 정상 거리처럼 표시하지 않습니다.
          updateDraft({ distanceKm: 0, durationMin: 0 });
          setRouteError(res.error ?? "도로 경로를 계산할 수 없습니다. 주소를 다시 확인해 주세요.");
          return;
        }
        setPath(res.path.length > 1 ? res.path : null);
        updateDraft({ distanceKm: res.distanceKm, durationMin: res.durationMin });
      } catch {
        if (!cancelled) {
          updateDraft({ distanceKm: 0, durationMin: 0 });
          setRouteError("도로 경로를 계산할 수 없습니다. 주소를 다시 확인해 주세요.");
        }
      } finally {
        if (!cancelled) setRouting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from?.x, from?.y, to?.x, to?.y, hasBoth, tick]);

  return (
    <MobileShell>
      <TopBar title="2단계. 주소 검색" onBack={() => setScreen("step1")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto pb-24">
        <AddressSearch
          label="출발지"
          value={draft.fromAddress}
          detail={draft.fromDetail}
          onSelect={(a, c) => {
            setPath(null);
            updateDraft({
              fromAddress: a,
              distanceKm: 0,
              durationMin: 0,
              fromX: c.x || null,
              fromY: c.y || null,
            });
          }}
          onDetail={(d) => updateDraft({ fromDetail: d })}
        />
        <AddressSearch
          label="도착지"
          value={draft.toAddress}
          detail={draft.toDetail}
          onSelect={(a, c) => {
            setPath(null);
            updateDraft({
              toAddress: a,
              distanceKm: 0,
              durationMin: 0,
              toX: c.x || null,
              toY: c.y || null,
            });
          }}
          onDetail={(d) => updateDraft({ toDetail: d })}
        />
        {(from || to) && (
          <Card className="pb-5">
            <div className="font-bold mb-2">경로 안내</div>
            <KakaoMap from={from} to={to} path={path} height={280} />
            {routeError && !routing ? (
              <div className="mt-3 rounded-xl bg-[#FFF1F1] border border-[#FFD4D4] p-3 text-center space-y-2">
                <div className="text-xs font-semibold text-[#B91C1C] leading-relaxed">
                  {routeError}
                </div>
                <button
                  onClick={() => {
                    tap("click");
                    setTick((t) => t + 1);
                  }}
                  className="px-4 min-h-12 rounded-xl bg-[#0751D8] text-white text-sm font-bold transition-transform active:scale-[0.97]"
                >
                  다시 계산
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mt-3 pb-1 text-center">
                <div>
                  <div className="text-xs text-[#6B7280]">실거리 (도로 기준)</div>
                  <div className="text-lg font-bold leading-7">
                    {routing
                      ? "계산 중..."
                      : from && to && draft.distanceKm
                        ? `${draft.distanceKm} km`
                        : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#6B7280]">예상 이동시간</div>
                  <div className="text-lg font-bold leading-7">
                    {routing
                      ? "계산 중..."
                      : from && to && draft.durationMin
                        ? `${draft.durationMin} 분`
                        : "-"}
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      <BottomButtonBar>
        <PrimaryButton onClick={() => setScreen("step3")} disabled={!hasBoth}>
          다음: 작업 조건
        </PrimaryButton>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ Step 3: Work condition ============
export function Step3() {
  const { draft, updateDraft, setScreen } = useApp();
  const hasStair = draft.workEnv.includes("계단");
  const hasElev = draft.workEnv.includes("엘리베이터");
  const maxFloor = hasStair ? 6 : 50;
  const toggleEnv = (env: "계단" | "엘리베이터") => {
    const stair = env === "계단" ? !hasStair : hasStair;
    const elev = env === "엘리베이터" ? !hasElev : hasElev;
    const next: WorkEnv =
      stair && elev ? "계단+엘리베이터" : stair ? "계단" : elev ? "엘리베이터" : "없음";
    updateDraft(
      stair
        ? {
            workEnv: next,
            fromFloor: Math.min(draft.fromFloor, 6),
            toFloor: Math.min(draft.toFloor, 6),
          }
        : { workEnv: next },
    );
  };
  return (
    <MobileShell>
      <TopBar title="3단계. 작업 조건" onBack={() => setScreen("step2")} />
      <div className="p-5 space-y-5 flex-1 overflow-auto pb-24">
        <Field label="작업 환경 (중복 선택 가능)">
          <div className="grid grid-cols-2 gap-3">
            <Card
              selected={hasStair}
              onClick={() => toggleEnv("계단")}
              className="text-center py-6"
            >
              <Art3D src={ENV_IMG["계단"]} alt="계단" size={72} className="mx-auto mb-2" />
              <div className="font-bold">계단 (수작업)</div>
            </Card>
            <Card
              selected={hasElev}
              onClick={() => toggleEnv("엘리베이터")}
              className="text-center py-6"
            >
              <Art3D
                src={ENV_IMG["엘리베이터"]}
                alt="엘리베이터"
                size={72}
                className="mx-auto mb-2"
              />
              <div className="font-bold">엘리베이터</div>
            </Card>
          </div>
        </Field>
        <Field label="사다리차">
          <Card
            selected={draft.ladder > 0}
            onClick={() => updateDraft({ ladder: draft.ladder > 0 ? 0 : 1 })}
          >
            <div className="flex items-center gap-3">
              <Art3D src={VEHICLE_IMG.ladder} alt="사다리차" size={56} />
              <div className="flex-1">
                <div className="font-semibold">사다리차 사용</div>
                <div className="text-xs text-[#6B7280]">필요하면 눌러서 선택하세요</div>
              </div>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  draft.ladder > 0 ? "bg-[#0751D8] text-white" : "border-2 border-[#DFE6F2]"
                }`}
              >
                {draft.ladder > 0 && <Check className="w-4 h-4" />}
              </div>
            </div>
          </Card>
        </Field>
        <Card>
          <div className="flex items-center justify-between">
            <div className="font-semibold">출발지 층수</div>
            <Counter
              value={draft.fromFloor}
              onChange={(n) => updateDraft({ fromFloor: n })}
              min={1}
              max={maxFloor}
            />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div className="font-semibold">도착지 층수</div>
            <Counter
              value={draft.toFloor}
              onChange={(n) => updateDraft({ toFloor: n })}
              min={1}
              max={maxFloor}
            />
          </div>
        </Card>
        <Field label="작업 인원">
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Art3D src={CHAR_IMG.male} alt="남자 작업자" size={56} />
                <div>
                  <div className="font-semibold">남자 작업자</div>
                  <div className="text-xs text-[#6B7280]">0~10명</div>
                </div>
              </div>
              <Counter
                value={draft.workers}
                onChange={(n) => updateDraft({ workers: n })}
                min={0}
                max={10}
              />
            </div>
          </Card>
          <div className="h-2" />
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Art3D src={CHAR_IMG.female} alt="주방 이모" size={56} />
                <div>
                  <div className="font-semibold">주방 이모</div>
                  <div className="text-xs text-[#6B7280]">0~5명</div>
                </div>
              </div>
              <Counter
                value={draft.kitchenStaff}
                onChange={(n) => updateDraft({ kitchenStaff: n })}
                min={0}
                max={5}
              />
            </div>
          </Card>
        </Field>
      </div>
      <BottomButtonBar>
        <PrimaryButton onClick={() => setScreen("step4")}>다음: 차량 선택</PrimaryButton>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ Step 4: Vehicles ============
export function Step4() {
  const { draft, updateDraft, setScreen, setCurrentRoom } = useApp();
  const ladderUnit = getPricing().ladder;
  const goNext = () => {
    const first = draft.rooms[0];
    if (first) setCurrentRoom(first.id);
    // 차량을 고른 뒤 AI 스캔으로 넘어갑니다 (건너뛰면 바로 5단계)
    setScreen("ai");
  };
  const vehicles = [
    {
      key: "truck1t" as const,
      name: "1톤 차량",
      img: VEHICLE_IMG.truck1t,
      max: 10,
      val: draft.truck1t,
    },
    {
      key: "truck5t" as const,
      name: "5톤 차량",
      img: VEHICLE_IMG.truck5t,
      max: 10,
      val: draft.truck5t,
    },
  ];
  return (
    <MobileShell>
      <TopBar title="4단계. 차량 선택" onBack={() => setScreen("step3")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto pb-24">
        {vehicles.map((v) => (
          <Card key={v.key} selected={v.val > 0}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Art3D src={v.img} alt={v.name} size={72} />

                <div>
                  <div className="font-bold text-lg">{v.name}</div>
                  <div className="text-xs text-[#6B7280]">최대 {v.max}대</div>
                </div>
              </div>
              <Counter
                value={v.val}
                onChange={(n) => updateDraft({ [v.key]: n } as any)}
                min={0}
                max={v.max}
              />
            </div>
          </Card>
        ))}
        <Card selected={draft.ladderFrom || draft.ladderTo}>
          <div className="flex items-center gap-3 mb-3">
            <Art3D src={VEHICLE_IMG.ladder} alt="사다리차" size={56} />
            <div>
              <div className="font-bold text-lg">사다리차 사용 위치</div>
              <div className="text-xs text-[#6B7280]">출발지·도착지를 선택하세요</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 px-3 py-3 rounded-xl border border-[#DFE6F2] bg-white font-semibold text-sm">
              <input
                type="checkbox"
                className="w-5 h-5"
                checked={draft.ladderFrom}
                onChange={(e) => {
                  tap("soft");
                  const on = e.target.checked;
                  const price = on ? draft.ladderFromPrice || ladderUnit : 0;
                  updateDraft({
                    ladderFrom: on,
                    ladderFromPrice: price,
                    ladder: (on ? 1 : 0) + (draft.ladderTo ? 1 : 0),
                    ladderPrice: price + draft.ladderToPrice,
                  });
                }}
              />
              출발지
            </label>
            <label className="flex items-center gap-2 px-3 py-3 rounded-xl border border-[#DFE6F2] bg-white font-semibold text-sm">
              <input
                type="checkbox"
                className="w-5 h-5"
                checked={draft.ladderTo}
                onChange={(e) => {
                  tap("soft");
                  const on = e.target.checked;
                  const price = on ? draft.ladderToPrice || ladderUnit : 0;
                  updateDraft({
                    ladderTo: on,
                    ladderToPrice: price,
                    ladder: (on ? 1 : 0) + (draft.ladderFrom ? 1 : 0),
                    ladderPrice: draft.ladderFromPrice + price,
                  });
                }}
              />
              도착지
            </label>
          </div>
          <div className="mt-3 space-y-2">
            {draft.ladderFrom && (
              <Field label="출발지 금액">
                <MoneyInput
                  value={draft.ladderFromPrice}
                  onChange={(n) =>
                    updateDraft({ ladderFromPrice: n, ladderPrice: n + draft.ladderToPrice })
                  }
                  step={10000}
                  placeholder="금액 입력"
                />
                <label className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#0751D8]">
                  <input
                    type="checkbox"
                    className="w-5 h-5"
                    checked={draft.ladderFromSeparate}
                    onChange={(e) => {
                      tap("soft");
                      updateDraft({ ladderFromSeparate: e.target.checked });
                    }}
                  />
                  출발지 별도
                </label>
              </Field>
            )}
            {draft.ladderTo && (
              <Field label="도착지 금액">
                <MoneyInput
                  value={draft.ladderToPrice}
                  onChange={(n) =>
                    updateDraft({ ladderToPrice: n, ladderPrice: draft.ladderFromPrice + n })
                  }
                  step={10000}
                  placeholder="금액 입력"
                />
                <label className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#0751D8]">
                  <input
                    type="checkbox"
                    className="w-5 h-5"
                    checked={draft.ladderToSeparate}
                    onChange={(e) => {
                      tap("soft");
                      updateDraft({ ladderToSeparate: e.target.checked });
                    }}
                  />
                  도착지 별도
                </label>
              </Field>
            )}
            <div className="flex justify-between text-sm font-bold">
              <span className="text-[#6B7280]">사다리차 합계</span>
              <span className="text-[#0751D8]">
                {won(draft.ladderFromPrice + draft.ladderToPrice)}
              </span>
            </div>
          </div>
        </Card>
      </div>
      <BottomButtonBar>
        <PrimaryButton onClick={goNext}>다음: 공간별 품목</PrimaryButton>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ Step 6: Items ============
/** 평수별 집 구조(구획) */
export const SIZE_TABS: { key: string; rooms: string[] }[] = [
  { key: "10~20평", rooms: ["안방", "거실", "부엌", "베란다"] },
  { key: "20~30평", rooms: ["안방", "작은방", "거실", "부엌", "베란다"] },
  { key: "30~40평", rooms: ["안방", "작은방", "입구방", "거실", "부엌", "베란다"] },
  { key: "40~50평", rooms: ["안방", "작은방", "입구방", "거실", "부엌", "베란다", "옷방"] },
  { key: "50~60평", rooms: ["안방", "작은방", "입구방", "거실", "부엌", "베란다", "옷방", "서재"] },
];

export const ROOM_TINT: Record<string, string> = {
  안방: "from-[#4C9BFF] to-[#0751D8]",
  작은방: "from-[#5FD08A] to-[#2F9E44]",
  입구방: "from-[#A78BFA] to-[#7C3AED]",
  거실: "from-[#F472B6] to-[#DB2777]",
  부엌: "from-[#FBBF24] to-[#D97706]",
  베란다: "from-[#38BDF8] to-[#0284C7]",
  옷방: "from-[#60A5FA] to-[#2563EB]",
  서재: "from-[#94A3B8] to-[#475569]",
};

const ITEM_TABS = [
  { key: "가전", cats: ["가전"] },
  { key: "가구", cats: ["가구"] },
  { key: "주방", cats: ["주방"] },
  { key: "생활", cats: ["생활용품"] },
  { key: "잔짐", cats: ["잔짐"] },
  { key: "특수", cats: ["특수"] },
];

export function Step6() {
  const { draft, updateDraft, setScreen, setCurrentRoom, estimates } = useApp();
  const [size, setSize] = useState<string>(() => {
    if (draft.sizeTab) return draft.sizeTab;
    const n = draft.rooms.length;
    const hit = SIZE_TABS.find((t) => t.rooms.length === n);
    return hit ? hit.key : "30~40평";
  });
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("가전");
  const [q, setQ] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  /** 수량을 0으로 줄일 때 뜨는 삭제 확인창 */
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  const sizeRooms = (SIZE_TABS.find((t) => t.key === size) || SIZE_TABS[2]).rooms;

  const catalog = useMemo(
    () =>
      [
        ...ITEM_CATALOG,
        ...(draft.customItems || []).map((c) => ({ ...c, emoji: "📦", sub: "직접 추가" })),
      ].filter((i) => !(draft.hiddenItems || []).includes(i.id)),
    [draft.customItems, draft.hiddenItems],
  );

  /** 평수를 고르면 없는 방만 새로 만들고, 기존 방 품목은 그대로 유지합니다 */
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
              ...missing.map((n) => ({
                id: `r_${n}`,
                name: n,
                items: {} as Record<string, number>,
              })),
            ],
          }
        : {}),
    });
  };

  const roomOf = (name: string) => draft.rooms.find((r) => r.name === name);
  const room = openRoom ? roomOf(openRoom) : undefined;

  const setQty = (itemId: string, qty: number) => {
    if (!room) return;
    const items = { ...room.items };
    if (qty <= 0) delete items[itemId];
    else items[itemId] = qty;
    updateDraft({ rooms: draft.rooms.map((r) => (r.id === room.id ? { ...r, items } : r)) });
  };

  /**
   * 수량을 줄일 때 0이 되려 하면 바로 지우지 않고 확인창을 띄웁니다.
   * (실수로 한 번 더 눌러 사라지는 일을 막습니다)
   */
  const decQty = (itemId: string, itemName: string, qty: number) => {
    tap("soft");
    if (qty <= 1) {
      setConfirmRemove({ id: itemId, name: itemName });
      return;
    }
    setQty(itemId, qty - 1);
  };

  const addCustom = () => {
    const name = q.trim() || prompt("추가할 품목 이름") || "";
    if (!name) return;
    const catName = guessCategory(name);
    const newId = `ci_${Date.now()}`;
    updateDraft({
      customItems: [...(draft.customItems || []), { id: newId, name, cat: catName, extra: 0 }],
      rooms: draft.rooms.map((r) =>
        r.id === room?.id ? { ...r, items: { ...r.items, [newId]: 1 } } : r,
      ),
    });
    setQ("");
    tap("success");
    toast.success(`「${name}」을(를) ${room?.name || "선택한 방"}에 추가했습니다`);
  };

  const tabCats = (ITEM_TABS.find((t) => t.key === tab) || ITEM_TABS[0]).cats;
  const items = catalog.filter((i) => (q ? i.name.includes(q) : tabCats.includes(i.cat)));
  const picked = Object.entries(room?.items || {}).map(([id, qty]) => ({
    id,
    qty,
    name: catalog.find((c) => c.id === id)?.name || id,
  }));
  const totalKinds = draft.rooms.reduce((a, r) => a + roomSummary(r.items).kinds, 0);

  /** 담긴 짐이 4단계에서 고른 차량에 들어가는지 */
  const load = useMemo(() => calcTruckLoad(draft), [draft]);

  /** 게이지에서 「5톤 1대로 바꾸기」를 눌렀을 때 */
  const applyTrucks = (need: { truck1t: number; truck5t: number }) => {
    updateDraft({ truck1t: need.truck1t, truck5t: need.truck5t });
    tap("success");
    toast.success("차량을 바꿨습니다", {
      description:
        `${need.truck5t ? `5톤 ${need.truck5t}대 ` : ""}${need.truck1t ? `1톤 ${need.truck1t}대` : ""}`.trim(),
    });
  };

  /** 지금까지 쓴 견적에서 자주 담은 품목 (이력이 없으면 기본 목록) */
  const frequent = useMemo(
    () =>
      frequentItemIds(estimates, 8)
        .map((id) => catalog.find((c) => c.id === id))
        .filter((i): i is (typeof catalog)[number] => !!i),
    [estimates, catalog],
  );

  return (
    <MobileShell>
      {/* 헤더 */}
      <div className="px-4 pt-2 pb-3 bg-white border-b border-[#E7EBF2]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              tap("soft");
              setScreen("ai");
            }}
            aria-label="AI 집 안 스캔으로 돌아가기"
            className="shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-b from-white to-[#F1F6FF] border border-[#DCE8FA] flex items-center justify-center text-[#0751D8] shadow-[0_4px_0_#DCE8FA,0_10px_18px_-10px_rgba(7,81,216,0.5),inset_0_1px_0_#fff] active:translate-y-[2px] active:shadow-[0_1px_0_#DCE8FA]"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-[20px] font-black text-[#0F172A] leading-tight">
            5단계. 공간별 품목
          </h1>
          <div className="shrink-0 w-10" />
        </div>

        <p className="mt-2 text-center text-[12px] text-[#6B7280] font-semibold">
          {totalKinds > 0
            ? `${size} · 공간을 눌러 품목을 담아주세요`
            : `${size} · 평수를 고르고 방을 추가·삭제하세요`}
        </p>

        {/* 트럭 적재 게이지 — 담을수록 차오릅니다 */}
        {load.status !== "empty" && (
          <div className="mt-3">
            <TruckGauge load={load} onFixTrucks={applyTrucks} />
          </div>
        )}
      </div>

      {/* 평수 선택 탭 */}
      <div className="bg-white border-b border-[#E7EBF2] px-4 py-3">
        <div className="flex gap-2 overflow-x-auto overflow-y-visible -mx-1 px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SIZE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => pickSize(t.key)}
              className={`px-4 py-2.5 rounded-2xl text-[14px] font-black whitespace-nowrap transition-all duration-150 active:translate-y-[2px] ${
                t.key === size
                  ? "text-white bg-gradient-to-b from-[#4C9BFF] to-[#0751D8] shadow-[0_4px_0_#0640A8,0_8px_16px_rgba(7,81,216,0.32),inset_0_1px_0_rgba(255,255,255,0.5)] active:shadow-[0_1px_0_#0640A8]"
                  : "text-[#2A6FD6] bg-gradient-to-b from-white to-[#F1F6FF] shadow-[0_3px_0_#DCE8FA,inset_0_1px_0_#fff] active:shadow-[0_1px_0_#DCE8FA]"
              }`}
            >
              {t.key}
            </button>
          ))}
        </div>
      </div>

      {/* 디지털 3D 집 구조 */}
      <div className="flex-1 overflow-auto p-4 pb-6 bg-gradient-to-b from-[#EEF6FF] to-[#E6EEFA]">
        <div className="grid grid-cols-2 gap-3">
          {sizeRooms.map((name) => {
            const r = roomOf(name);
            const s = roomSummary(r?.items || {});
            return (
              <div
                key={name}
                className="relative rounded-3xl p-3 bg-gradient-to-b from-white to-[#F2F7FF] border border-[#DCE8FA] shadow-[0_8px_0_#E1EAF8,0_16px_28px_-14px_rgba(7,81,216,0.4),inset_0_1px_0_#fff]"
              >
                <button
                  onClick={() => {
                    tap("soft");
                    if (r) setCurrentRoom(r.id);
                    setOpenRoom(name);
                    setPickerOpen(false);
                    setQ("");
                  }}
                  className="w-full text-left active:translate-y-[2px] transition-transform"
                >
                  <span
                    className={`inline-block px-3 py-1 rounded-xl text-white text-[14px] font-black bg-gradient-to-b ${
                      ROOM_TINT[name] || "from-[#4C9BFF] to-[#0751D8]"
                    } shadow-[0_3px_0_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.45)]`}
                  >
                    {name}
                  </span>
                  <div className="mt-1 relative flex items-center justify-center h-[86px]">
                    <Art3D src={ROOM_IMG[name] || ROOM_IMG["작은방"]} alt={name} size={82} />
                  </div>
                  {/* 담은 품목 미리보기 — 3D 아이콘 3개까지, 나머지는 +N */}
                  {(() => {
                    const entries = Object.entries(r?.items ?? {});
                    if (entries.length === 0) return null;
                    const shownItems = entries.slice(0, 3);
                    const rest = entries.length - shownItems.length;
                    const nameOf = (id: string) => catalog.find((c) => c.id === id)?.name || id;
                    return (
                      <>
                        <div className="mt-1 flex items-center justify-center gap-1.5">
                          {shownItems.map(([id, qty]) => (
                            <span
                              key={id}
                              className="relative rounded-xl bg-gradient-to-b from-white to-[#EAF2FF] border border-[#CFE0FA] p-0.5 shadow-[0_2px_0_#DCE8FA,inset_0_1px_0_#fff]"
                            >
                              <ItemArt id={id} name={nameOf(id)} size={34} />
                              {qty > 1 && (
                                <span className="absolute -top-1 -right-1 min-w-4 px-1 rounded-full bg-[#0751D8] text-white text-[9px] font-black text-center">
                                  {qty}
                                </span>
                              )}
                            </span>
                          ))}
                          {rest > 0 && (
                            <span className="self-center rounded-xl bg-[#EAF2FF] border border-[#CFE0FA] px-1.5 py-2 text-[12px] font-black text-[#0751D8]">
                              +{rest}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 truncate text-center text-[11px] font-bold text-[#5A6478]">
                          {shownItems.map(([id]) => nameOf(id)).join(", ")}
                        </div>
                      </>
                    );
                  })()}
                  <div className="mt-1 text-center text-[12px] font-extrabold text-[#0F172A]">
                    {s.kinds > 0 ? `${s.kinds}종 · ${s.count}개` : "품목 없음"}
                  </div>
                </button>
                {s.count > 0 && (
                  <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-gradient-to-b from-[#4C9BFF] to-[#0751D8] text-white text-[12px] font-black flex items-center justify-center shadow-[0_3px_0_#0640A8,inset_0_1px_0_rgba(255,255,255,0.5)]">
                    {s.count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <BottomButtonBar>
        <PrimaryButton onClick={() => setScreen("options")}>
          <span className="inline-flex items-center gap-2">다음: 옵션·보관료</span>
        </PrimaryButton>
      </BottomButtonBar>

      {/* 품목 추가 드로어 */}
      {room && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-[#0F172A]/45 backdrop-blur-[2px]"
            onClick={() => setOpenRoom(null)}
          />
          <div
            className={`relative w-full max-w-md flex flex-col rounded-t-3xl bg-gradient-to-b from-white to-[#F5F9FF] shadow-[0_-14px_40px_rgba(7,81,216,0.28)] pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
              // 품목을 고를 때는 시트를 위로 더 끌어올려 넓게 보여 줍니다
              pickerOpen ? "h-[95dvh] max-h-[95dvh]" : "max-h-[86dvh]"
            }`}
          >
            <div className="px-4 pt-3 pb-2 flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-xl text-white text-[15px] font-black bg-gradient-to-b ${
                  ROOM_TINT[room.name] || "from-[#4C9BFF] to-[#0751D8]"
                } shadow-[0_3px_0_rgba(0,0,0,0.18)]`}
              >
                {room.name}
              </span>
              <span className="text-[13px] font-extrabold text-[#6B7280]">
                {roomSummary(room.items).kinds}종 · {roomSummary(room.items).count}개
              </span>
              <button
                onClick={() => setOpenRoom(null)}
                className="ml-auto w-9 h-9 rounded-full bg-white border border-[#DCE8FA] flex items-center justify-center shadow-[0_3px_0_#EDF2FA]"
                aria-label="닫기"
              >
                <X className="w-5 h-5 text-[#334155]" />
              </button>
            </div>

            {/* 등록된 품목 뱃지 */}
            <div className="px-4 pt-3">
              {picked.length === 0 ? (
                <p className="text-[13px] font-bold text-[#9AA4B2]">아직 등록된 품목이 없습니다</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {picked.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-2xl bg-gradient-to-b from-white to-[#EAF2FF] border border-[#CFE0FA] shadow-[0_3px_0_#DCE8FA,inset_0_1px_0_#fff]"
                    >
                      <ItemArt id={p.id} name={p.name} size={26} />
                      <span className="text-[13px] font-extrabold text-[#0F172A]">{p.name}</span>
                      <span className="text-[13px] font-black text-[#0751D8] tabular-nums">
                        {p.qty}
                      </span>
                      <button
                        onClick={() => setConfirmRemove({ id: p.id, name: p.name })}
                        className="ml-0.5 text-[#94A3B8]"
                        aria-label={`${p.name} 삭제`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 직접 품목 선택 (기본 접힘) */}
            <div className="px-4 pt-3">
              <button
                onClick={() => {
                  tap("soft");
                  setPickerOpen((v) => !v);
                }}
                className="w-full py-3.5 rounded-2xl bg-white border border-[#DCE8FA] flex items-center justify-center gap-2 font-black text-[16px] text-[#0751D8] shadow-[0_5px_0_#EDF2FA,inset_0_1px_0_#fff] active:translate-y-[3px] active:shadow-none"
              >
                <Hand className="w-5 h-5" /> 직접 품목 선택
                <ChevronDown
                  className={`w-5 h-5 transition-transform ${pickerOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            {pickerOpen && (
              <div className="flex-1 min-h-[44dvh] overflow-auto px-4 pt-3 space-y-3">
                {/* 자주 담는 품목 — 검색 없이 눌러서 바로 담습니다 */}
                <div className="rounded-2xl border border-[#DCE8FA] bg-white px-4 py-3 space-y-2 shadow-[inset_0_1px_0_#fff]">
                  <div className="text-[13.5px] font-black text-[#0F172A]">
                    자주 담는 품목
                    <span className="ml-1.5 text-[11.5px] font-semibold text-[#9AA4B2]">
                      눌러서 바로 담기
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {frequent.map((it) => {
                      const qty = room?.items[it.id] || 0;
                      return (
                        <button
                          key={it.id}
                          onClick={() => {
                            setQty(it.id, qty + 1);
                            tap("success");
                          }}
                          className="flex min-h-12 items-center gap-1.5 rounded-2xl border pl-1.5 pr-3.5 text-[13px] font-black transition-transform active:translate-y-[2px]"
                          style={{
                            borderColor: qty > 0 ? "#287BFF" : "#DCE8FA",
                            background: qty > 0 ? "#F2F7FF" : "#FFFFFF",
                            color: qty > 0 ? "#0751D8" : "#475569",
                            boxShadow: qty > 0 ? "0 3px 0 #BBD3FF" : "0 2px 0 #EDF2FA",
                          }}
                        >
                          <ItemArt id={it.id} name={it.name} size={32} />
                          {it.name}
                          {qty > 0 && (
                            <span className="ml-0.5 rounded-full bg-[#0751D8] px-1.5 py-0.5 text-[10px] font-black text-white">
                              {qty}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto -mx-1 px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {ITEM_TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => {
                        tap("soft");
                        setTab(t.key);
                        setQ("");
                      }}
                      className={`shrink-0 px-4 py-2.5 rounded-2xl text-[14px] font-black whitespace-nowrap transition-all active:translate-y-[2px] ${
                        !q && t.key === tab
                          ? "text-white bg-gradient-to-b from-[#4C9BFF] to-[#0B5FE0] shadow-[0_4px_0_#0640A8,inset_0_1px_0_rgba(255,255,255,0.45)]"
                          : "text-[#2A6FD6] bg-gradient-to-b from-white to-[#F1F6FF] shadow-[0_3px_0_#DCE8FA,inset_0_1px_0_#fff]"
                      }`}
                    >
                      {t.key}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                  <TextInput
                    placeholder="품목명을 검색하세요"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* 소분류로 묶어서 3D 카드로 보여줍니다 */}
                <div className="space-y-4">
                  {[...new Set(items.map((i) => i.sub || "기타"))].map((g) => (
                    <div key={g}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-1 rounded-xl text-[12px] font-black text-white bg-gradient-to-b from-[#7FB6FF] to-[#2A6FD6] shadow-[0_2px_0_#1F5AB0]">
                          {g}
                        </span>
                        <span className="flex-1 h-px bg-[#E1EAF8]" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {items
                          .filter((i) => (i.sub || "기타") === g)
                          .map((it) => {
                            const qty = room.items[it.id] || 0;
                            return (
                              <div
                                key={it.id}
                                className={`relative rounded-2xl p-2 flex flex-col items-center gap-1 border transition-all ${
                                  qty > 0
                                    ? "border-[#287BFF] bg-gradient-to-b from-[#F5F9FF] to-[#DCE9FF] shadow-[0_5px_0_#BBD3FF,inset_0_1px_0_#fff]"
                                    : "border-[#E3EBF7] bg-gradient-to-b from-white to-[#F7FAFF] shadow-[0_4px_0_#EDF2FA,inset_0_1px_0_#fff]"
                                }`}
                              >
                                {/* 고른 품목은 파란 테두리 + 체크 */}
                                {qty > 0 && (
                                  <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-b from-[#4C9BFF] to-[#0751D8] shadow-[0_2px_0_#0640A8]">
                                    <Check className="h-3.5 w-3.5 text-white" />
                                  </span>
                                )}
                                <button
                                  onClick={() => {
                                    tap("soft");
                                    setQty(it.id, qty + 1);
                                  }}
                                  className="w-full flex flex-col items-center gap-1 active:translate-y-[2px] transition-transform"
                                >
                                  <ItemArt id={it.id} name={it.name} size={62} />
                                  <span className="text-[12px] font-extrabold text-[#0F172A] text-center leading-tight line-clamp-2">
                                    {it.name}
                                  </span>
                                </button>
                                {qty > 0 && (
                                  <div className="w-full flex items-center justify-between gap-1">
                                    <button
                                      onClick={() => decQty(it.id, it.name, qty)}
                                      className="w-7 h-7 rounded-xl bg-white border border-[#CFE0FA] text-[#0751D8] font-black shadow-[0_2px_0_#DCE8FA]"
                                      aria-label={`${it.name} 감소`}
                                    >
                                      −
                                    </button>
                                    <span className="text-[14px] font-black text-[#0751D8] tabular-nums">
                                      {qty}
                                    </span>
                                    <button
                                      onClick={() => setQty(it.id, qty + 1)}
                                      className="w-7 h-7 rounded-xl bg-gradient-to-b from-[#4C9BFF] to-[#0751D8] text-white font-black shadow-[0_2px_0_#0640A8]"
                                      aria-label={`${it.name} 증가`}
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="py-3 text-center text-[13px] font-bold text-[#9AA4B2]">
                      검색 결과가 없습니다
                    </p>
                  )}
                </div>

                <button
                  onClick={addCustom}
                  className="w-full py-3.5 rounded-2xl border-2 border-dashed border-[#287BFF] text-[#0751D8] font-black flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> {q ? `「${q}」 품목 추가` : "품목 직접 추가"}
                </button>
                {/* 아래 「이 공간 완료」 버튼에 목록이 가리지 않도록 여백을 둡니다 */}
                <div aria-hidden className="h-6" />
              </div>
            )}

            <div className="border-t border-[#E7EBF2] bg-white/95 px-4 pt-3 pb-1 backdrop-blur-sm">
              <PrimaryButton onClick={() => setOpenRoom(null)}>
                <span className="inline-flex items-center gap-2">
                  <Check className="w-5 h-5" /> 이 공간 완료
                </span>
              </PrimaryButton>
            </div>

            {/* 수량을 0으로 줄이거나 뱃지의 X 를 눌렀을 때 */}
            {confirmRemove && (
              <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
                <div
                  className="absolute inset-0 bg-[#0F172A]/40"
                  onClick={() => setConfirmRemove(null)}
                />
                <div className="relative w-full max-w-[300px] rounded-3xl bg-white p-5 text-center shadow-[0_16px_40px_rgba(15,23,42,0.3)]">
                  <div className="text-[16px] font-black text-[#0F172A]">
                    이 품목을 공간에서 삭제할까요?
                  </div>
                  <p className="mt-1.5 text-[13px] font-bold text-[#6B7280]">
                    「{room.name}」의 {confirmRemove.name}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setConfirmRemove(null)}
                      className="flex-1 rounded-2xl border border-[#DCE8FA] bg-white py-3 font-black text-[14px] text-[#334155] shadow-[0_3px_0_#EDF2FA]"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => {
                        tap("soft");
                        setQty(confirmRemove.id, 0);
                        setConfirmRemove(null);
                      }}
                      className="flex-1 rounded-2xl bg-gradient-to-b from-[#FF6B6B] to-[#D9282A] py-3 font-black text-[14px] text-white shadow-[0_3px_0_#A81E20]"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </MobileShell>
  );
}

// ============ AI Recognition ============
export function AIRecognition() {
  const { draft, updateDraft, setScreen, currentRoomId, setCurrentRoom } = useApp();
  const [results, setResults] = useState<DetectedItem[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [onlyHigh, setOnlyHigh] = useState(true);
  /** 찰칵 하는 순간 마스코트가 플래시를 터뜨립니다 */
  const [shooting, setShooting] = useState(false);

  /** 담을 공간 — 스캔이 끝나면 여기서 고른 방으로 들어갑니다 */
  const [roomId, setRoomId] = useState<string>(() => currentRoomId || draft.rooms[0]?.id || "");
  const targetRoom = draft.rooms.find((r) => r.id === roomId) || draft.rooms[0];

  /** 음성으로 바로 담기 */
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const recRef = useRef<RecognitionLike | null>(null);
  const recorderRef = useRef<WavRecorder | null>(null);
  const keepRef = useRef(false);
  const roomIdRef = useRef(roomId);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const mascotState: MascotState = busy || voiceBusy ? "analyzing" : shooting ? "shooting" : "idle";

  const flash = () => {
    setShooting(true);
    window.setTimeout(() => setShooting(false), 650);
  };

  /** 이 값 이상만 「확실한 품목」으로 봅니다 */
  const THRESHOLD = 0.95;
  const PCT = Math.round(THRESHOLD * 100);
  const shown = onlyHigh ? results.filter((r) => r.confidence >= THRESHOLD) : results;
  const lowCount = results.filter((r) => r.confidence < THRESHOLD).length;

  const analyze = async (images: string[], source: "photo" | "video") => {
    setBusy(true);
    setResults([]);
    try {
      const res = await recognizeItems({ data: { images, source } });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setResults(res.items);
      const high = res.items.filter((i) => i.confidence >= THRESHOLD).length;
      if (high === 0) {
        toast.info(`${PCT}% 이상 확실한 품목이 없습니다. 더 밝고 가까이 촬영해 주세요.`);
        setOnlyHigh(false);
      } else {
        toast.success(`AI 인식 완료 — 정확도 ${PCT}% 이상 ${high}개 품목`);
        tap("success");
      }
      if (res.roomGuess) toast.info(`추정 공간: ${res.roomGuess}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI 분석에 실패했습니다");
    } finally {
      setBusy(false);
    }
  };

  const onPhoto = async (f: File) => {
    flash();
    setVideoUrl("");
    setPhotoUrl(URL.createObjectURL(f));
    const dataUrl = await fileToDataUrl(f);
    await analyze([dataUrl], "photo");
  };

  const onVideo = async (f: File) => {
    flash();
    setPhotoUrl("");
    setVideoUrl(URL.createObjectURL(f));
    setBusy(true);
    try {
      const frames = await videoToFrames(f, 5);
      await analyze(frames, "video");
    } catch {
      toast.error("동영상을 분석하지 못했습니다");
      setBusy(false);
    }
  };

  /** 고른 공간에 품목을 바로 더합니다 */
  const addToRoom = (
    add: { id: string; name: string; qty: number }[],
    targetId: string,
  ): string | null => {
    const room = draft.rooms.find((r) => r.id === targetId) || draft.rooms[0];
    if (!room || add.length === 0) return null;
    const items = { ...room.items };
    for (const a of add) items[a.id] = (items[a.id] || 0) + a.qty;
    updateDraft({
      rooms: draft.rooms.map((x) => (x.id === room.id ? { ...x, items } : x)),
    });
    return room.name;
  };

  const apply = () => {
    if (!targetRoom) return;
    const name = addToRoom(shown, targetRoom.id);
    if (!name) return;
    setCurrentRoom(targetRoom.id);
    toast.success(`「${name}」에 ${shown.length}개 품목을 담았습니다`);
    setScreen("step6");
  };

  // ---- 음성으로 바로 담기 (대화 없이, 말하는 즉시 들어갑니다) ----

  const applySpeech = async (rawText: string) => {
    const targetId = roomIdRef.current;
    setVoiceBusy(true);
    try {
      // 녹음된 실제 음성을 AI 음성인식으로 다시 확인해 인식률을 크게 높입니다
      const text = await refineWithAiStt(recorderRef.current, rawText);
      const res = await parseVoiceOrder({
        data: { text, rooms: draft.rooms.map((r) => r.name) },
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (!res.items.length) {
        toast.error("품목을 못 알아들었어요. 다시 말씀해 주세요.");
        return;
      }
      // 말할 때 방 이름을 같이 말했으면 그 방으로 담습니다
      const spoken = res.room
        ? draft.rooms.find((r) => r.name.replace(/\s/g, "") === res.room?.replace(/\s/g, ""))
        : undefined;
      const finalId = spoken?.id || targetId;
      if (spoken && spoken.id !== targetId) setRoomId(spoken.id);

      const name = addToRoom(res.items, finalId);
      if (!name) return;
      tap("success");
      const summary = res.items.map((i) => `${i.name} ${i.qty}`).join(", ");
      toast.success(`「${name}」 · ${summary}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "음성 해석에 실패했습니다");
    } finally {
      setVoiceBusy(false);
    }
  };

  const stopVoice = () => {
    keepRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* 이미 멈춘 경우 */
    }
    void recorderRef.current?.stop();
    recorderRef.current = null;
    setListening(false);
    setHeard("");
  };

  const startVoice = () => {
    const SR = recognitionCtor();
    if (!SR) {
      toast.error("이 기기에서는 음성 인식을 지원하지 않습니다");
      return;
    }
    if (!isSecureForMic()) {
      toast.error(INSECURE_MIC_MESSAGE);
      return;
    }
    if (!targetRoom) {
      toast.error("담을 공간을 먼저 골라 주세요");
      return;
    }
    const rec = new SR();
    rec.lang = "ko-KR";
    rec.continuous = true;
    rec.interimResults = true;
    // 후보를 여러 개 받아 그중 가장 확신하는 문장을 씁니다
    rec.maxAlternatives = 5;
    recRef.current = rec;

    rec.onresult = (ev: SpeechEventLike) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (!r.isFinal) {
          interim += r[0].transcript;
          continue;
        }
        const best = bestAlternative(r);
        if (!best.transcript.trim()) continue;
        setHeard("");
        void applySpeech(best.transcript.trim());
      }
      if (interim) setHeard(interim);
    };

    rec.onerror = (ev: SpeechErrorLike) => {
      const code = ev?.error ?? "";
      if (code === "no-speech") return;
      keepRef.current = false;
      setListening(false);
      toast.error(speechErrorMessage(code));
    };

    // 브라우저가 스스로 멈춰도 계속 듣습니다
    rec.onend = () => {
      if (keepRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* 재시작 실패 시 아래에서 끕니다 */
        }
      }
      setListening(false);
    };

    try {
      rec.start();
      keepRef.current = true;
      setListening(true);
      const recorder = new WavRecorder();
      recorderRef.current = recorder;
      void recorder.start().catch(() => {
        recorderRef.current = null;
      });
      tap("soft");
    } catch {
      setListening(false);
      toast.error("마이크를 시작하지 못했습니다");
    }
  };

  // 화면을 벗어나면 마이크를 끕니다
  useEffect(() => {
    return () => {
      keepRef.current = false;
      try {
        recRef.current?.stop();
      } catch {
        /* 이미 멈춘 경우 */
      }
      void recorderRef.current?.stop();
      recorderRef.current = null;
    };
  }, []);

  return (
    <MobileShell>
      <TopBar title="AI 집 안 스캔" onBack={() => setScreen("step4")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto pb-24">
        {/* 마스코트가 직접 촬영해 주는 히어로 영역 */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#EDF5FF] to-[#DCEBFF] px-5 pt-4 pb-5 text-center">
          <ScanMascot state={mascotState} size={164} className="mx-auto" />
          <div className="mt-1 text-[17px] font-black text-[#0F172A]">
            {busy ? "집 안을 살펴보는 중이에요" : "제가 대신 찍어 드릴게요"}
          </div>
          <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[#5A6478]">
            {busy
              ? "가구·가전을 찾아 수량을 세고 있습니다"
              : "방을 한 바퀴 비추면 AI가 품목을 알아서 담아요"}
          </p>
        </div>

        {(videoUrl || photoUrl) && (
          <Card className="py-4">
            {videoUrl ? (
              <video src={videoUrl} controls className="w-full rounded-xl" />
            ) : (
              <img src={photoUrl} alt="업로드한 사진" className="w-full rounded-xl" />
            )}
          </Card>
        )}

        {/* 담을 공간 고르기 — 스캔·음성 결과가 여기로 들어갑니다 */}
        <div className="rounded-3xl border border-[#DCE8FA] bg-white px-4 py-3.5">
          <div className="text-[14px] font-black text-[#0F172A]">
            어느 공간에 담을까요?
            <span className="ml-1.5 text-[11.5px] font-semibold text-[#9AA4B2]">
              눌러서 바꿀 수 있어요
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {draft.rooms.map((r) => {
              const on = r.id === targetRoom?.id;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    tap("soft");
                    setRoomId(r.id);
                  }}
                  className={`rounded-2xl px-3.5 py-2 text-[13.5px] font-black transition-transform active:translate-y-[2px] ${
                    on
                      ? `text-white bg-gradient-to-b ${
                          ROOM_TINT[r.name] || "from-[#4C9BFF] to-[#0751D8]"
                        } shadow-[0_3px_0_rgba(0,0,0,0.18)]`
                      : "text-[#334155] bg-white border border-[#DCE8FA] shadow-[0_3px_0_#EDF2FA]"
                  }`}
                >
                  {r.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 음성으로 바로 담기 — 말하면 그대로 들어갑니다 */}
        <button
          onClick={() => (listening ? stopVoice() : startVoice())}
          disabled={busy}
          className={`flex w-full items-center justify-center gap-2 rounded-3xl py-4 font-black text-[15px] text-white transition-transform active:translate-y-[3px] active:shadow-none disabled:opacity-60 ${
            listening
              ? "bg-gradient-to-b from-[#FF6B6B] to-[#D9282A] shadow-[0_5px_0_#A81E20]"
              : "bg-gradient-to-b from-[#34D399] to-[#059669] shadow-[0_5px_0_#047857,inset_0_1px_0_rgba(255,255,255,0.4)]"
          }`}
        >
          <Mic className="h-5 w-5" />
          {listening ? "듣는 중 — 누르면 끝내기" : "말해서 바로 담기"}
        </button>
        {(listening || heard || voiceBusy) && (
          <div className="rounded-2xl border border-[#DCE8FA] bg-white px-3.5 py-2.5 text-[13px] font-bold text-[#0751D8]">
            {voiceBusy
              ? "담는 중..."
              : heard
                ? `“${heard}”`
                : "말씀하세요 — 예) 냉장고 하나, 침대 두 개"}
          </div>
        )}

        {/* 촬영 — 사진 / 동영상 */}
        <div className="grid grid-cols-2 gap-3">
          <label
            className={`flex flex-col items-center gap-1.5 rounded-3xl py-4 text-white shadow-[0_5px_0_#0645B0,inset_0_1px_0_rgba(255,255,255,0.4)] transition-transform active:translate-y-[3px] active:shadow-none ${
              busy ? "pointer-events-none opacity-60" : "cursor-pointer"
            }`}
            style={{ background: "linear-gradient(180deg, #4A94FF 0%, #0751D8 100%)" }}
          >
            <Camera className="h-6 w-6" />
            <span className="text-[15px] font-black">사진 촬영</span>
            <span className="text-[11px] font-semibold opacity-85">한 장이면 충분해요</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPhoto(f);
              }}
            />
          </label>

          <label
            className={`flex flex-col items-center gap-1.5 rounded-3xl py-4 text-white shadow-[0_5px_0_#7A1FB0,inset_0_1px_0_rgba(255,255,255,0.4)] transition-transform active:translate-y-[3px] active:shadow-none ${
              busy ? "pointer-events-none opacity-60" : "cursor-pointer"
            }`}
            style={{ background: "linear-gradient(180deg, #C084FC 0%, #9333EA 100%)" }}
          >
            <Video className="h-6 w-6" />
            <span className="text-[15px] font-black">동영상 촬영</span>
            <span className="text-[11px] font-semibold opacity-85">방을 한 바퀴 쭉</span>
            <input
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onVideo(f);
              }}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="py-4 rounded-2xl bg-white border border-[#E7EBF2] font-semibold flex items-center justify-center gap-2 cursor-pointer">
            <ImageIcon className="w-5 h-5" /> 사진 불러오기
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPhoto(f);
              }}
            />
          </label>
          <label className="py-4 rounded-2xl bg-white border border-[#E7EBF2] font-semibold flex items-center justify-center gap-2 cursor-pointer">
            <ImageIcon className="w-5 h-5" /> 동영상 불러오기
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onVideo(f);
              }}
            />
          </label>
        </div>

        {busy && (
          <Card className="text-center py-6">
            <div className="font-bold text-[#0751D8]">AI가 분석 중입니다...</div>
            <div className="text-xs text-[#6B7280] mt-1">가구·가전을 찾아 수량을 세는 중</div>
          </Card>
        )}

        <div className="text-xs text-[#6B7280] bg-[#F5F7FB] rounded-xl px-3 py-2">
          💡 밝고 선명하게, 물건 전체가 나오도록 촬영할수록 인식률이 높아집니다.
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold">인식 결과</div>
              <button
                onClick={() => setOnlyHigh((v) => !v)}
                className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#EDF2FB] text-[#0751D8]"
              >
                {onlyHigh ? `${PCT}% 이상만 보기 (숨김 ${lowCount})` : "전체 보기"}
              </button>
            </div>
            {shown.map((r) => (
              <Card key={r.id} className="space-y-2.5">
                {/* 이름·정확도 — 좁은 화면에서 글자가 세로로 쪼개지지 않도록
                    min-w-0 을 주고 수량 조절은 아랫줄로 내렸습니다 */}
                <div className="flex items-start gap-3">
                  <ItemArt id={r.id} name={r.name} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-black text-[#0F172A]">{r.name}</div>
                    <div className="mt-0.5 text-[12px] font-semibold leading-snug text-[#6B7280]">
                      정확도 {Math.round(r.confidence * 100)}%
                      {r.note ? <span className="block">{r.note}</span> : null}
                    </div>
                  </div>
                  <span className="shrink-0">
                    {r.confidence >= THRESHOLD ? (
                      <Check className="h-5 w-5 text-[#16A34A]" />
                    ) : (
                      <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10.5px] font-black text-[#B45309]">
                        확인
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Counter
                    value={r.qty}
                    onChange={(n) =>
                      setResults(results.map((x) => (x.id === r.id ? { ...x, qty: n } : x)))
                    }
                  />
                  <button
                    onClick={() => setResults(results.filter((x) => x.id !== r.id))}
                    className="flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-[13px] font-bold text-[#EF4444]"
                    aria-label={`${r.name} 삭제`}
                  >
                    <Trash2 className="h-4 w-4" /> 삭제
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <BottomButtonBar>
        <div className="space-y-2">
          {results.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setResults([]);
                  setVideoUrl("");
                  setPhotoUrl("");
                }}
                className="flex-1 py-4 rounded-2xl border border-[#E7EBF2] font-bold"
              >
                다시 촬영
              </button>
              <PrimaryButton onClick={apply} className="flex-1" disabled={shown.length === 0}>
                {targetRoom ? `「${targetRoom.name}」에 담기` : "담고 다음으로"}
              </PrimaryButton>
            </div>
          )}
          {/* 스캔은 선택입니다 — 건너뛰어도 5단계에서 직접 담을 수 있습니다 */}
          <button
            onClick={() => {
              tap("soft");
              setScreen("step6");
            }}
            className="w-full py-4 rounded-2xl border border-[#DCE8FA] bg-white font-black text-[15px] text-[#0751D8] shadow-[0_4px_0_#EDF2FA] active:translate-y-[2px] active:shadow-none"
          >
            {results.length > 0 ? "담지 않고 넘어가기" : "건너뛰고 직접 담기"}
          </button>
        </div>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ Options & Storage ============
export function OptionsScreen() {
  const { draft, updateDraft, setScreen } = useApp();
  const days = useMemo(
    () => storageDays(draft.storageStart, draft.storageEnd),
    [draft.storageStart, draft.storageEnd],
  );
  const storageOn = usesStorage(draft);

  return (
    <MobileShell>
      <TopBar title="6단계. 옵션·보관료" onBack={() => setScreen("step6")} />
      <div className="p-5 space-y-3 flex-1 overflow-auto pb-24">
        {draft.options.length === 0 && (
          <div className="text-center text-[#6B7280] py-10 text-sm">
            추가된 옵션 품목이 없습니다. 아래에서 직접 추가해 주세요.
          </div>
        )}
        {draft.options.map((o, i) => (
          <Card key={o.id}>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-3 font-semibold flex-1">
                <input
                  type="checkbox"
                  checked={o.enabled}
                  onChange={(e) => {
                    tap("soft");
                    updateDraft({
                      options: draft.options.map((x, j) =>
                        j === i ? { ...x, enabled: e.target.checked } : x,
                      ),
                    });
                  }}
                  className="w-5 h-5"
                />
                <ItemArt name={o.name} size={44} />
                {o.name}
              </label>
              <button
                onClick={() => {
                  tap("soft");
                  updateDraft({ options: draft.options.filter((_, j) => j !== i) });
                }}
                className="p-2 text-[#EF4444]"
                aria-label="옵션 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {o.enabled && (
              <div className="mt-3 space-y-2">
                <MoneyInput
                  value={o.price}
                  step={1000}
                  placeholder="추가 금액 입력"
                  onChange={(n) =>
                    updateDraft({
                      options: draft.options.map((x, j) => (j === i ? { ...x, price: n } : x)),
                    })
                  }
                />
                <label className="flex items-center gap-2 text-sm font-semibold text-[#0751D8]">
                  <input
                    type="checkbox"
                    className="w-5 h-5"
                    checked={o.separate}
                    onChange={(e) => {
                      tap("soft");
                      updateDraft({
                        options: draft.options.map((x, j) =>
                          j === i ? { ...x, separate: e.target.checked } : x,
                        ),
                      });
                    }}
                  />
                  별도 (견적 합계에서 제외)
                </label>
              </div>
            )}
          </Card>
        ))}
        <button
          onClick={() => {
            const name = prompt("추가할 옵션 품목 이름");
            if (!name) return;
            const price = Number((prompt("추가 금액 (원)", "0") || "").replace(/[^\d]/g, "")) || 0;
            updateDraft({
              options: [
                ...draft.options,
                { id: `op_${Date.now()}`, name, enabled: true, price, separate: false },
              ],
            });
            tap("success");
          }}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-[#287BFF] text-[#0751D8] font-bold flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" /> 옵션 품목 직접 추가
        </button>
        <Card className="space-y-2">
          <div className="font-bold">특약사항</div>
          <textarea
            value={draft.specialTerms}
            onChange={(e) => updateDraft({ specialTerms: e.target.value })}
            placeholder="예) 사다리차 사용료 별도, 주차 공간 확보 필요, 폐기물 처리 미포함 등"
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-[#DFE6F2] bg-gradient-to-b from-[#F8FAFD] to-white text-base shadow-[inset_0_2px_4px_rgba(15,23,42,0.06)] focus:outline-none focus:border-[#287BFF] resize-none"
          />
        </Card>
        {draft.moveType !== "보관이사" && (
          <label className="flex items-center gap-3 bg-white rounded-2xl border border-[#E7EBF2] px-4 min-h-14 py-3 font-semibold">
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={Boolean(draft.storageEnabled)}
              onChange={(e) => {
                tap("soft");
                updateDraft({ storageEnabled: e.target.checked });
              }}
            />
            보관 서비스 추가
          </label>
        )}
        {storageOn && (
          <Card className="space-y-3">
            <div className="font-bold">보관 정보</div>
            <Field label="보관 시작일">
              <TextInput
                type="date"
                value={draft.storageStart}
                onChange={(e) => updateDraft({ storageStart: e.target.value })}
              />
            </Field>
            <Field label="보관 종료일">
              <TextInput
                type="date"
                value={draft.storageEnd}
                onChange={(e) => updateDraft({ storageEnd: e.target.value })}
              />
            </Field>
            <Field label="하루 보관료">
              <MoneyInput
                value={draft.storageDaily}
                onChange={(n) => updateDraft({ storageDaily: n })}
                step={1000}
              />
            </Field>
            {days < 0 ? (
              <div className="text-sm font-semibold text-[#EF4444]">
                보관 종료일이 시작일보다 빠릅니다. 날짜를 다시 확인해 주세요.
              </div>
            ) : (
              <div className="text-sm">
                보관 일수: <b>{days}일</b> · 하루 {won(draft.storageDaily)} · 총 보관료:{" "}
                <b className="text-[#0751D8]">{won(Math.max(0, days) * draft.storageDaily)}</b>
              </div>
            )}
          </Card>
        )}
      </div>
      <BottomButtonBar>
        <PrimaryButton onClick={() => setScreen("result")}>견적 계산 보기</PrimaryButton>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ Result ============
export function Result() {
  const { draft, setScreen, saveDraft, updateDraft, estimates } = useApp();
  const [detail, setDetail] = useState(false);
  const [detailEdit, setDetailEdit] = useState(false);
  const [edit, setEdit] = useState(false);
  /** 견적 완료 확인창 */
  const [confirmDone, setConfirmDone] = useState(false);
  /** 고객에게 나갈 내용을 보여 주는 미리보기 */
  const [preview, setPreview] = useState(false);
  /** 종이 견적서 화면 */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetEdit, setSheetEdit] = useState(false);
  const [confirmSheet, setConfirmSheet] = useState(false);

  /** 견적서를 처음 열 때 견적번호를 붙입니다 (한 번 붙으면 바뀌지 않습니다) */
  const openSheet = () => {
    tap("soft");
    if (!draft.sheetNo) {
      updateDraft({
        sheetNo: makeSheetNo(estimates),
        sheetVersion: draft.sheetVersion ?? 1,
      });
    }
    saveDraft();
    setSheetOpen(true);
  };

  /** 공간별 품목 — 담긴 방만, 담긴 순서대로 */
  const sheetRooms: SheetRoom[] = draft.rooms
    .map((r) => ({
      name: r.name,
      items: Object.entries(r.items).map(([id, qty]) => ({
        id,
        name:
          ITEM_CATALOG.find((c) => c.id === id)?.name ||
          (draft.customItems || []).find((c) => c.id === id)?.name ||
          id,
        qty,
      })),
    }))
    .filter((r) => r.items.length > 0);

  const [adjust, setAdjust] = useState(0);
  const calc = calcEstimate(draft);
  const total = calc.total + adjust;
  const parts = adjust ? [...calc.parts, { label: "할인·조정", amount: adjust }] : calc.parts;
  const extraLabels = new Set((draft.extraCharges ?? []).map((x) => x.label || "추가 항목"));
  // 사다리차·옵션·보관료는 따로 더해지는 항목이라 「기본 운송료」에서 뺍니다
  const transportAuto = calc.parts
    .filter(
      (p) =>
        p.label !== "옵션 비용" &&
        p.label !== "보관료" &&
        p.label !== "사다리차 비용" &&
        !extraLabels.has(p.label),
    )
    .reduce((s, p) => s + p.amount, 0);

  useEffect(() => {
    if (draft.total !== total) updateDraft({ total });
  }, [total, draft.total, updateDraft]);
  const summaryText = () =>
    `[JIMPICK 견적]\n${draft.customerName}님\n이사일: ${formatMoveDateTime(draft.moveDate, draft.moveTime)}\n${draft.fromAddress} → ${draft.toAddress}\n예상 견적: ${won(total)}`;
  /** 고객이 열어 볼 견적서 주소 */
  const shareUrl = () =>
    typeof window === "undefined" ? "" : `${window.location.origin}/share/${draft.id}`;

  /** 고객에게 보낼 견적 문자 — 화면의 「이사 정보」와 같은 내용으로 채웁니다 */
  const estimateMessage = () =>
    buildEstimateMessage({
      shareUrl: shareUrl(),
      customerName: draft.customerName,
      phone: draft.phone,
      moveDateText: formatMoveDateTime(draft.moveDate, draft.moveTime),
      moveType: draft.moveType,
      fromAddress: `${draft.fromAddress} ${draft.fromDetail || ""}`.trim(),
      toAddress: `${draft.toAddress} ${draft.toDetail || ""}`.trim(),
      distanceKm: draft.distanceKm,
      durationMin: draft.durationMin,
      workEnv: String(draft.workEnv),
      fromFloor: draft.fromFloor,
      toFloor: draft.toFloor,
      truck1t: draft.truck1t,
      truck5t: draft.truck5t,
      ladder: draft.ladder,
      ladderWhere:
        draft.ladderFrom || draft.ladderTo
          ? `${[draft.ladderFrom && "출발지", draft.ladderTo && "도착지"]
              .filter(Boolean)
              .join("·")}${draft.ladderSeparate ? " · 별도" : ""}`
          : undefined,
      workers: draft.workers,
      kitchenStaff: draft.kitchenStaff,
      storageText: usesStorage(draft)
        ? `보관: ${draft.storageStart || "-"} ~ ${draft.storageEnd || "-"} (${Math.max(
            0,
            storageDays(draft.storageStart, draft.storageEnd),
          )}일 · 하루 ${won(draft.storageDaily)})`
        : undefined,
      options: draft.options
        .filter((o) => o.enabled)
        .map((o) => `${o.name} · ${o.separate ? "별도" : won(o.price)}`),
      memo: draft.memo || undefined,
      totalText: won(total),
    });

  /**
   * 문자 앱을 내용이 채워진 채로 엽니다. 보내기는 사장님이 직접 누릅니다.
   * 컴퓨터처럼 문자 앱이 없는 기기에서는 내용을 복사해 드립니다.
   */
  const sendSMS = () => {
    tap("soft");
    const body = estimateMessage();
    if (!isSendablePhone(draft.phone)) {
      void navigator.clipboard?.writeText(body).catch(() => {});
      toast.error("고객 연락처가 올바르지 않습니다", {
        description: "1단계에서 휴대폰 번호를 확인해 주세요. 견적 내용은 복사해 두었습니다.",
      });
      return;
    }
    if (!hasSmsApp()) {
      void navigator.clipboard?.writeText(body).catch(() => {});
      toast("이 기기에는 문자 앱이 없습니다", {
        description: "견적 내용을 복사했습니다. 휴대폰에서 열면 문자 앱이 바로 열립니다.",
      });
      return;
    }
    window.location.href = smsHref(draft.phone, body);
  };
  const sendKakao = () => {
    tap("soft");
    void navigator.clipboard?.writeText(summaryText()).catch(() => {});
    toast("카카오톡 발송은 준비 중인 기능입니다", {
      description: "견적 내용을 복사했습니다. 공유 링크와 함께 전달해 주세요.",
    });
  };

  return (
    <MobileShell>
      <TopBar title="견적 결과" onBack={() => setScreen("options")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto pb-24">
        <div
          className="rounded-2xl p-6 text-white text-center"
          style={{ background: "linear-gradient(135deg, #0A2A6C 0%, #0751D8 100%)" }}
        >
          <div className="text-sm opacity-90">예상 견적 금액</div>
          <div className="text-4xl font-black my-3">{won(total)}</div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setDetail((v) => !v)}
              className="text-sm bg-white/20 rounded-full px-4 py-2 font-semibold"
            >
              {detail ? "간단히 보기" : "상세 내역 보기"}
            </button>
          </div>
        </div>
        {detail && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="font-bold text-base">상세 내역</div>
              <button
                onClick={() => {
                  tap("soft");
                  setDetailEdit((v) => !v);
                }}
                className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#EEF4FF] text-[#0751D8] flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> {detailEdit ? "수정 완료" : "내역 수정"}
              </button>
            </div>

            {detailEdit ? (
              <div className="space-y-3">
                <Field label="기본 운송료">
                  <MoneyInput
                    value={draft.transportOverride ?? transportAuto}
                    onChange={(n) => updateDraft({ transportOverride: n })}
                    step={10000}
                  />
                </Field>
                {calc.parts
                  .filter((p) => ["사다리차 비용", "옵션 비용", "보관료"].includes(p.label))
                  .map((p) => (
                    <div key={p.label} className="flex justify-between text-sm">
                      <span className="text-[#6B7280]">{p.label}</span>
                      <span className="font-semibold">{won(p.amount)}</span>
                    </div>
                  ))}
                <div className="border-t border-[#E7EBF2] pt-3 space-y-3">
                  {(draft.extraCharges ?? []).map((x) => (
                    <div key={x.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <TextInput
                          value={x.label}
                          placeholder="항목명 (예: 보양 작업비)"
                          onChange={(e) =>
                            updateDraft({
                              extraCharges: (draft.extraCharges ?? []).map((y) =>
                                y.id === x.id ? { ...y, label: e.target.value } : y,
                              ),
                            })
                          }
                        />
                        <button
                          onClick={() => {
                            tap("soft");
                            updateDraft({
                              extraCharges: (draft.extraCharges ?? []).filter((y) => y.id !== x.id),
                            });
                          }}
                          className="shrink-0 w-10 h-10 rounded-xl border border-[#F3C7C7] text-[#EF4444] flex items-center justify-center"
                          aria-label="항목 삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <MoneyInput
                        value={x.amount}
                        step={10000}
                        onChange={(n) =>
                          updateDraft({
                            extraCharges: (draft.extraCharges ?? []).map((y) =>
                              y.id === x.id ? { ...y, amount: n } : y,
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      tap("soft");
                      updateDraft({
                        extraCharges: [
                          ...(draft.extraCharges ?? []),
                          { id: `x_${Date.now()}`, label: "", amount: 0 },
                        ],
                      });
                    }}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-[#BFD4FF] text-[#0751D8] font-bold text-sm"
                  >
                    + 항목 추가
                  </button>
                </div>
                {draft.transportOverride !== null && draft.transportOverride !== undefined && (
                  <button
                    onClick={() => {
                      tap("soft");
                      updateDraft({ transportOverride: null });
                    }}
                    className="text-xs text-[#6B7280] underline"
                  >
                    기본 운송료 자동 계산으로 되돌리기
                  </button>
                )}
              </div>
            ) : (
              parts.map((p, i) => (
                <div key={`${p.label}_${i}`} className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">{p.label}</span>
                  <span className="font-semibold">{won(p.amount)}</span>
                </div>
              ))
            )}
            <div className="border-t border-[#E7EBF2] pt-2 mt-2 flex justify-between font-bold">
              <span>합계</span>
              <span className="text-[#0751D8]">{won(total)}</span>
            </div>
          </Card>
        )}

        <Card className="space-y-2 text-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="font-bold text-base">이사 정보</div>
            <button
              onClick={() => {
                tap("soft");
                setEdit((v) => !v);
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#EEF4FF] text-[#0751D8] flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" /> {edit ? "수정 완료" : "견적 수정"}
            </button>
          </div>
          {edit ? (
            <div className="space-y-3 pt-1">
              <Field label="고객명">
                <TextInput
                  value={draft.customerName}
                  onChange={(e) => updateDraft({ customerName: e.target.value })}
                />
              </Field>
              <Field label="연락처">
                <TextInput
                  value={draft.phone}
                  onChange={(e) => updateDraft({ phone: formatPhone(e.target.value) })}
                />
              </Field>
              <Field label="이사일">
                <TextInput
                  type="date"
                  value={draft.moveDate}
                  onChange={(e) => updateDraft({ moveDate: e.target.value })}
                />
              </Field>
              <Field label="출발지">
                <TextInput
                  value={draft.fromAddress}
                  onChange={(e) => updateDraft({ fromAddress: e.target.value })}
                />
              </Field>
              <Field label="도착지">
                <TextInput
                  value={draft.toAddress}
                  onChange={(e) => updateDraft({ toAddress: e.target.value })}
                />
              </Field>
              <Field label="거리 (km)">
                <TextInput
                  type="number"
                  value={draft.distanceKm}
                  onChange={(e) => updateDraft({ distanceKm: Number(e.target.value) || 0 })}
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="1톤">
                  <TextInput
                    type="number"
                    value={draft.truck1t}
                    onChange={(e) => updateDraft({ truck1t: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="5톤">
                  <TextInput
                    type="number"
                    value={draft.truck5t}
                    onChange={(e) => updateDraft({ truck5t: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="사다리">
                  <TextInput
                    type="number"
                    value={draft.ladder}
                    onChange={(e) => updateDraft({ ladder: Number(e.target.value) || 0 })}
                  />
                </Field>
              </div>
              <Field label="할인·조정 금액 (1만원 단위 · 음수 가능)">
                <MoneyInput value={adjust} step={10000} allowNegative onChange={setAdjust} />
              </Field>
            </div>
          ) : (
            <>
              <div>
                👤 {draft.customerName || "이름 미입력"} · {draft.phone || "연락처 미입력"}
              </div>
              <div>📅 {formatMoveDateTime(draft.moveDate, draft.moveTime)}</div>
              <div>🚚 {draft.moveType}</div>
              <div className="text-[#6B7280]">
                출발: {draft.fromAddress} {draft.fromDetail}
              </div>
              <div className="text-[#6B7280]">
                도착: {draft.toAddress} {draft.toDetail}
              </div>
              <div>
                실거리 {draft.distanceKm}km
                {draft.durationMin ? ` · 약 ${draft.durationMin}분` : ""} · {draft.workEnv} ·{" "}
                {draft.fromFloor}층→{draft.toFloor}층
              </div>
              <div>
                1톤 {draft.truck1t} · 5톤 {draft.truck5t} · 사다리 {draft.ladder}
                {(draft.ladderFrom || draft.ladderTo) &&
                  ` (${[draft.ladderFrom && "출발지", draft.ladderTo && "도착지"].filter(Boolean).join("·")}${
                    draft.ladderSeparate ? " · 별도" : ""
                  })`}
              </div>
              <div>
                작업 인원: 남자 {draft.workers}명 · 주방 {draft.kitchenStaff}명
              </div>
              {usesStorage(draft) && (
                <div>
                  보관: {draft.storageStart || "-"} ~ {draft.storageEnd || "-"} (
                  {Math.max(0, storageDays(draft.storageStart, draft.storageEnd))}일 · 하루{" "}
                  {won(draft.storageDaily)})
                </div>
              )}
              {draft.options
                .filter((o) => o.enabled)
                .map((o) => (
                  <div key={o.id}>
                    ➕ {o.name} · {o.separate ? "별도" : won(o.price)}
                  </div>
                ))}
              {draft.memo && <div className="text-[#6B7280]">메모: {draft.memo}</div>}
            </>
          )}
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={sendSMS}
            className="py-4 rounded-2xl bg-white border border-[#DFE6F2] font-bold flex items-center justify-center gap-2 shadow-[0_4px_0_#E3E9F5,0_10px_20px_-8px_rgba(15,23,42,0.25)] active:translate-y-[2px] active:shadow-[0_2px_0_#E3E9F5]"
          >
            <MessageSquare className="w-5 h-5" /> 문자 발송
          </button>
          <button
            onClick={sendKakao}
            className="py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-[#3C1E1E] shadow-[0_4px_0_#D8B400,0_10px_20px_-8px_rgba(250,225,0,0.6)] active:translate-y-[2px] active:shadow-[0_2px_0_#D8B400]"
            style={{ background: "linear-gradient(180deg, #FFEE58 0%, #FAE100 100%)" }}
          >
            <Send className="w-5 h-5" /> 카카오톡 발송
          </button>
        </div>
        <button
          onClick={openSheet}
          className="w-full py-4 rounded-2xl font-black text-[16px] text-white flex items-center justify-center gap-2 shadow-[0_5px_0_#0640A8,0_12px_24px_-10px_rgba(7,81,216,0.5)] active:translate-y-[3px] active:shadow-[0_2px_0_#0640A8]"
          style={{ background: "linear-gradient(180deg,#4C9BFF 0%,#0751D8 100%)" }}
        >
          <FileText className="w-5 h-5" /> 견적서 확인
        </button>

        <button
          onClick={() => {
            tap("success");
            saveDraft();
            const url = `${window.location.origin}/share/${draft.id}`;
            void navigator.clipboard?.writeText(url);
            toast.success("고객용 공유 링크가 복사되었습니다");
          }}
          className="w-full py-4 rounded-2xl bg-white border border-[#DFE6F2] font-bold flex items-center justify-center gap-2 shadow-[0_4px_0_#E3E9F5,0_10px_20px_-8px_rgba(15,23,42,0.25)] active:translate-y-[2px] active:shadow-[0_2px_0_#E3E9F5]"
        >
          <LinkIcon className="w-5 h-5" /> 공유 링크 복사
        </button>
        <button
          onClick={() => {
            tap("soft");
            saveDraft();
            const url = `${window.location.origin}/share/${draft.id}?staff=1`;
            void navigator.clipboard?.writeText(url);
            toast.success("직원용 작업 지시서 링크를 복사했습니다", {
              description: "금액은 표시되지 않습니다 (미공개)",
            });
          }}
          className="w-full py-4 rounded-2xl bg-gradient-to-b from-[#F1F6FF] to-[#E4EDFC] border border-[#DCE8FA] text-[#0751D8] font-black flex items-center justify-center gap-2 shadow-[0_4px_0_#D6E2F5] active:translate-y-[2px] active:shadow-[0_2px_0_#D6E2F5]"
        >
          <Users className="w-5 h-5" /> 직원용 공유 (금액 미공개)
        </button>

        <button
          onClick={() => {
            tap("success");
            saveDraft();
            toast.success("견적이 저장되었습니다");
          }}
          className="w-full py-4 rounded-2xl bg-white border border-[#DFE6F2] font-bold flex items-center justify-center gap-2 shadow-[0_4px_0_#E3E9F5,0_10px_20px_-8px_rgba(15,23,42,0.25)] active:translate-y-[2px] active:shadow-[0_2px_0_#E3E9F5]"
        >
          <Check className="w-5 h-5" /> 견적 저장
        </button>
      </div>

      <BottomButtonBar>
        <PrimaryButton onClick={() => setConfirmDone(true)}>견적 완료</PrimaryButton>
      </BottomButtonBar>

      {/* 종이 견적서 */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#E9EFF8]">
          <div className="flex items-center gap-2 border-b border-[#DCE8FA] bg-white px-4 py-3">
            <button
              onClick={() => {
                setSheetOpen(false);
                setSheetEdit(false);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#DCE8FA] bg-white shadow-[0_3px_0_#EDF2FA]"
              aria-label="닫기"
            >
              <ChevronLeft className="h-5 w-5 text-[#334155]" />
            </button>
            <div className="text-[16px] font-black text-[#0F172A]">
              {sheetEdit ? "견적서 수정" : "이사 견적서"}
            </div>
            {draft.sheetConfirmedAt && (
              <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[11px] font-black text-[#15803D]">
                확정
              </span>
            )}
            <span className="ml-auto text-[12px] font-bold text-[#6B7280]">{draft.sheetNo}</span>
          </div>

          <div className="flex-1 overflow-auto pb-4">
            {sheetEdit ? (
              <div className="space-y-3 p-4">
                <Field label="고객명">
                  <TextInput
                    value={draft.customerName}
                    onChange={(e) => updateDraft({ customerName: e.target.value })}
                  />
                </Field>
                <Field label="이사 날짜">
                  <TextInput
                    type="date"
                    value={draft.moveDate}
                    onChange={(e) => updateDraft({ moveDate: e.target.value })}
                  />
                </Field>
                <Field label="출발지">
                  <TextInput
                    value={draft.fromAddress}
                    onChange={(e) => updateDraft({ fromAddress: e.target.value })}
                  />
                </Field>
                <Field label="도착지">
                  <TextInput
                    value={draft.toAddress}
                    onChange={(e) => updateDraft({ toAddress: e.target.value })}
                  />
                </Field>
                <Field label="할인 금액">
                  <MoneyInput
                    value={draft.discount ?? 0}
                    step={10000}
                    onChange={(n) => updateDraft({ discount: n })}
                  />
                </Field>
                <Field label="예약금">
                  <MoneyInput
                    value={draft.deposit ?? 0}
                    step={10000}
                    onChange={(n) => updateDraft({ deposit: n })}
                  />
                </Field>
                <Field label="담당자 이름">
                  <TextInput
                    value={draft.staffName ?? ""}
                    placeholder="예: 김용달"
                    onChange={(e) => updateDraft({ staffName: e.target.value })}
                  />
                </Field>
                <Field label="안내 문구">
                  <TextInput
                    value={draft.sheetNote ?? ""}
                    placeholder="위 내용으로 정성껏 이사해 드리겠습니다."
                    onChange={(e) => updateDraft({ sheetNote: e.target.value })}
                  />
                </Field>
                <p className="text-[12.5px] font-semibold leading-relaxed text-[#6B7280]">
                  품목과 수량은 5단계 「공간별 품목」에서, 차량·옵션은 앞 단계에서 고치면
                  견적서에 바로 반영됩니다. 고객이 처음 넣은 신청 정보는 그대로 남습니다.
                </p>
              </div>
            ) : (
              <EstimateSheet
                draft={draft}
                rooms={sheetRooms}
                parts={parts}
                total={total}
                companyPhone={draft.phone ? undefined : undefined}
              />
            )}
          </div>

          <div className="border-t border-[#DCE8FA] bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  tap("soft");
                  if (sheetEdit) {
                    // 수정을 끝내면 이력을 남기고 차수를 올립니다
                    const before = draft.sheetSnapshot?.total ?? total;
                    updateDraft({
                      sheetVersion: (draft.sheetVersion ?? 1) + (draft.sheetConfirmedAt ? 1 : 0),
                      sheetHistory: [
                        ...(draft.sheetHistory ?? []),
                        {
                          version: draft.sheetVersion ?? 1,
                          at: Date.now(),
                          staff: draft.staffName || "담당자",
                          beforeTotal: before,
                          afterTotal: total,
                        },
                      ],
                    });
                    saveDraft();
                  }
                  setSheetEdit((v) => !v);
                }}
                className="rounded-2xl border border-[#DCE8FA] bg-white py-3 text-[13.5px] font-black text-[#0751D8] shadow-[0_3px_0_#EDF2FA]"
              >
                {sheetEdit ? "수정 완료" : "견적서 수정"}
              </button>
              <button
                onClick={() => {
                  tap("soft");
                  window.print();
                }}
                className="rounded-2xl border border-[#DCE8FA] bg-white py-3 text-[13.5px] font-black text-[#0751D8] shadow-[0_3px_0_#EDF2FA]"
              >
                인쇄 · PDF
              </button>
              <button
                onClick={() => {
                  tap("soft");
                  setConfirmSheet(true);
                }}
                className="rounded-2xl bg-gradient-to-b from-[#4C9BFF] to-[#0751D8] py-3 text-[13.5px] font-black text-white shadow-[0_3px_0_#0640A8]"
              >
                문자발송
              </button>
            </div>
          </div>

          {/* 발송 전 확인 */}
          {confirmSheet && (
            <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
              <div
                className="absolute inset-0 bg-[#0F172A]/45"
                onClick={() => setConfirmSheet(false)}
              />
              <div className="relative w-full max-w-[320px] rounded-3xl bg-white p-5 text-center shadow-[0_16px_40px_rgba(15,23,42,0.3)]">
                <div className="text-[17px] font-black text-[#0F172A]">
                  견적서 내용을 확인하셨습니까?
                </div>
                <p className="mt-1.5 text-[13px] font-bold text-[#6B7280]">
                  확정하면 지금 금액({won(total)})이 그대로 보관됩니다.
                </p>
                <div className="mt-4 space-y-2">
                  <PrimaryButton
                    onClick={() => {
                      const snap = {
                        sheetNo: draft.sheetNo ?? "",
                        version: draft.sheetVersion ?? 1,
                        confirmedAt: Date.now(),
                        total,
                        parts,
                        rooms: sheetRooms,
                      };
                      updateDraft({ sheetConfirmedAt: snap.confirmedAt, sheetSnapshot: snap });
                      saveDraft();
                      setConfirmSheet(false);
                      setSheetOpen(false);
                      toast.success("견적서가 확정되었습니다");
                      setPreview(true);
                    }}
                  >
                    견적 확정
                  </PrimaryButton>
                  <button
                    onClick={() => setConfirmSheet(false)}
                    className="w-full rounded-2xl border border-[#DCE8FA] bg-white py-3.5 font-black text-[14px] text-[#334155] shadow-[0_3px_0_#EDF2FA]"
                  >
                    다시 확인
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 고객이 받을 내용 미리보기 — 문자 + 견적서가 함께 갑니다 */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-[#0F172A]/50" onClick={() => setPreview(false)} />
          <div className="relative flex h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-[#EEF3FA] shadow-[0_-14px_40px_rgba(7,81,216,0.28)]">
            <div className="flex items-center gap-2 border-b border-[#E2E8F2] bg-white px-4 py-3">
              <div className="text-[16px] font-black text-[#0F172A]">고객이 받을 내용</div>
              <span className="rounded-full bg-[#EAF2FF] px-2 py-0.5 text-[11px] font-black text-[#0751D8]">
                미리보기
              </span>
              <button
                onClick={() => setPreview(false)}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-[#DCE8FA] bg-white shadow-[0_3px_0_#EDF2FA]"
                aria-label="닫기"
              >
                <X className="h-5 w-5 text-[#334155]" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-auto p-4 pb-6">
              {/* ① 문자 */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-black text-[#5A6478]">
                  <MessageSquare className="h-4 w-4" /> 문자 ({draft.phone || "연락처 미입력"})
                </div>
                <div className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-b from-[#4C9BFF] to-[#0751D8] px-3.5 py-3 text-[13px] font-semibold leading-relaxed text-white shadow-[0_3px_0_#0640A8]">
                  {estimateMessage()}
                </div>
              </div>

              {/* ② 문자 속 링크를 누르면 열리는 견적서 */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-black text-[#5A6478]">
                  <LinkIcon className="h-4 w-4" /> 링크를 누르면 열리는 견적서
                </div>
                <div className="overflow-hidden rounded-3xl border border-[#DCE8FA] bg-white shadow-[0_6px_18px_-10px_rgba(7,81,216,0.4)]">
                  <div
                    className="px-5 py-5 text-center text-white"
                    style={{ background: "linear-gradient(135deg,#287BFF 0%,#0751D8 100%)" }}
                  >
                    <div className="text-[12px] font-bold opacity-90">JIMPICK 이사 견적서</div>
                    <div className="mt-1 text-[28px] font-black tracking-tight">{won(total)}</div>
                    <div className="mt-1 text-[12px] font-semibold opacity-90">
                      {draft.customerName || "고객"}님 ·{" "}
                      {formatMoveDateTime(draft.moveDate, draft.moveTime)}
                    </div>
                  </div>

                  <div className="space-y-1.5 px-4 py-4 text-[12.5px] font-semibold text-[#334155]">
                    <div>🚚 {draft.moveType}</div>
                    <div className="text-[#6B7280]">출발: {draft.fromAddress}</div>
                    <div className="text-[#6B7280]">도착: {draft.toAddress}</div>
                    <div>
                      실거리 {draft.distanceKm}km
                      {draft.durationMin ? ` · 약 ${draft.durationMin}분` : ""} · {draft.workEnv} ·{" "}
                      {draft.fromFloor}층→{draft.toFloor}층
                    </div>
                  </div>

                  {/* 담은 품목 3D 미리보기 */}
                  {(() => {
                    const all = draft.rooms.flatMap((r) =>
                      Object.entries(r.items).map(([id, qty]) => ({ id, qty, room: r.name })),
                    );
                    if (all.length === 0) return null;
                    const head = all.slice(0, 8);
                    const rest = all.length - head.length;
                    const nameOf = (id: string) =>
                      ITEM_CATALOG.find((c) => c.id === id)?.name ||
                      (draft.customItems || []).find((c) => c.id === id)?.name ||
                      id;
                    return (
                      <div className="border-t border-[#EDF2FA] px-4 py-3">
                        <div className="text-[12.5px] font-black text-[#0F172A]">
                          담는 품목{" "}
                          <span className="font-bold text-[#6B7280]">
                            {all.length}종 · {all.reduce((s, i) => s + i.qty, 0)}개
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {head.map((it) => (
                            <span
                              key={`${it.room}-${it.id}`}
                              className="relative rounded-xl border border-[#CFE0FA] bg-gradient-to-b from-white to-[#EAF2FF] p-0.5"
                            >
                              <ItemArt id={it.id} name={nameOf(it.id)} size={32} />
                              {it.qty > 1 && (
                                <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#0751D8] px-1 text-center text-[9px] font-black text-white">
                                  {it.qty}
                                </span>
                              )}
                            </span>
                          ))}
                          {rest > 0 && (
                            <span className="self-center rounded-xl bg-[#EAF2FF] px-2 py-2 text-[12px] font-black text-[#0751D8]">
                              +{rest}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="border-t border-[#EDF2FA] bg-[#F8FBFF] px-4 py-3">
                    {parts.map((p) => (
                      <div key={p.label} className="flex justify-between text-[12.5px] font-semibold">
                        <span className="text-[#6B7280]">{p.label}</span>
                        <span className="text-[#0F172A] tabular-nums">{won(p.amount)}</span>
                      </div>
                    ))}
                    <div className="mt-2 flex justify-between border-t border-[#E2E8F2] pt-2 text-[14px] font-black">
                      <span>합계</span>
                      <span className="text-[#0751D8] tabular-nums">{won(total)}</span>
                    </div>
                  </div>
                </div>
                <p className="mt-1.5 text-[11.5px] font-semibold text-[#94A3B8]">
                  실제 주소: {shareUrl()}
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t border-[#E2E8F2] bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <PrimaryButton onClick={sendSMS} disabled={!isSendablePhone(draft.phone)}>
                <span className="inline-flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" /> 이대로 문자 보내기
                </span>
              </PrimaryButton>
              <button
                onClick={() => {
                  tap("soft");
                  void navigator.clipboard?.writeText(shareUrl());
                  toast.success("견적서 링크가 복사되었습니다");
                }}
                className="w-full rounded-2xl border border-[#DCE8FA] bg-white py-3.5 font-black text-[14px] text-[#0751D8] shadow-[0_3px_0_#EDF2FA]"
              >
                견적서 링크만 복사
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 견적 완료 확인 — 고객에게 문자를 보낼지 여기서 고릅니다 */}
      {confirmDone && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-[#0F172A]/45 backdrop-blur-[2px]"
            onClick={() => setConfirmDone(false)}
          />
          <div className="relative w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-14px_40px_rgba(7,81,216,0.28)]">
            <div className="text-[19px] font-black text-[#0F172A]">견적을 완료할까요?</div>
            <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-[#6B7280]">
              {draft.customerName || "고객"}님 · {won(total)}
              <br />
              {isSendablePhone(draft.phone)
                ? `${draft.phone} 로 견적 문자를 보낼 수 있습니다.`
                : "연락처가 올바르지 않아 문자는 보낼 수 없습니다."}
            </p>

            <div className="mt-4 space-y-2">
              {/* 보내기 전에 고객이 받을 내용을 그대로 보여 줍니다 */}
              <button
                onClick={() => {
                  tap("soft");
                  saveDraft();
                  setConfirmDone(false);
                  setPreview(true);
                }}
                className="w-full rounded-2xl border-2 border-[#287BFF] bg-white py-4 font-black text-[15px] text-[#0751D8] shadow-[0_4px_0_#DCE8FA] active:translate-y-[2px] active:shadow-none"
              >
                <span className="inline-flex items-center gap-2">
                  <Eye className="h-5 w-5" /> 고객에게 보낼 내용 미리보기
                </span>
              </button>

              <PrimaryButton
                onClick={() => {
                  setConfirmDone(false);
                  saveDraft();
                  toast.success("견적이 완료되었습니다");
                  // 저장이 끝난 뒤 문자 앱을 엽니다
                  sendSMS();
                }}
                disabled={!isSendablePhone(draft.phone)}
              >
                <span className="inline-flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" /> 완료하고 문자 보내기
                </span>
              </PrimaryButton>

              <button
                onClick={() => {
                  setConfirmDone(false);
                  tap("success");
                  saveDraft();
                  toast.success("견적이 완료되었습니다");
                  setScreen("home");
                }}
                className="w-full rounded-2xl border border-[#DCE8FA] bg-white py-4 font-black text-[15px] text-[#0751D8] shadow-[0_4px_0_#EDF2FA] active:translate-y-[2px] active:shadow-none"
              >
                문자 없이 완료
              </button>

              <button
                onClick={() => setConfirmDone(false)}
                className="w-full py-3 text-[14px] font-bold text-[#94A3B8]"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}

// ============ History ============
export function History() {
  const { estimates, setScreen, loadEstimate, deleteEstimate } = useApp();
  const [q, setQ] = useState("");
  const list = estimates.filter(
    (e) => !q || e.customerName.includes(q) || e.phone.includes(q) || e.moveDate.includes(q),
  );
  return (
    <MobileShell>
      <TopBar title="견적 내역" />
      <div className="p-4 space-y-3 flex-1 overflow-auto pb-24">
        <TextInput
          placeholder="고객명·연락처·날짜 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {list.length === 0 && (
          <div className="text-center text-[#6B7280] py-16">저장된 견적이 없습니다.</div>
        )}
        {list.map((e) => (
          <Card key={e.id}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold">{e.customerName || "이름 없음"}</div>
                <div className="text-xs text-[#6B7280]">{e.phone}</div>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-[#EEF4FF] text-[#0751D8] font-semibold">
                {e.status}
              </span>
            </div>
            <div className="text-sm text-[#6B7280] mt-2">
              {e.moveDate || "-"} · {e.fromAddress || "?"} → {e.toAddress || "?"}
            </div>
            <div className="text-lg font-black text-[#0751D8] mt-1">{won(e.total)}</div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => loadEstimate(e.id)}
                className="flex-1 py-2 rounded-xl bg-[#EEF4FF] text-[#0751D8] text-sm font-semibold"
              >
                상세 보기
              </button>
              <button
                onClick={() => {
                  if (confirm("삭제하시겠습니까?")) deleteEstimate(e.id);
                }}
                className="px-3 py-2 rounded-xl bg-[#FEE2E2] text-[#EF4444]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>
      <BottomNav />
    </MobileShell>
  );
}

// ============ Customers ============
export function Customers() {
  const { estimates } = useApp();
  const [q, setQ] = useState("");
  const map = new Map<
    string,
    { name: string; phone: string; last: number; count: number; lastAmount: number }
  >();
  for (const e of estimates) {
    if (!e.phone) continue;
    const k = e.phone;
    const cur = map.get(k);
    if (!cur || e.createdAt > cur.last) {
      map.set(k, {
        name: e.customerName,
        phone: e.phone,
        last: e.createdAt,
        count: (cur?.count || 0) + 1,
        lastAmount: e.total,
      });
    } else {
      cur.count += 1;
    }
  }
  const list = Array.from(map.values()).filter(
    (c) => !q || c.name.includes(q) || c.phone.includes(q),
  );
  return (
    <MobileShell>
      <TopBar title="고객 관리" />
      <div className="p-4 space-y-3 flex-1 overflow-auto pb-24">
        <TextInput placeholder="고객 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        {list.length === 0 && (
          <div className="text-center text-[#6B7280] py-16">고객 정보가 없습니다.</div>
        )}
        {list.map((c) => (
          <Card key={c.phone}>
            <div className="flex justify-between">
              <div>
                <div className="font-bold">{c.name}</div>
                <div className="text-xs text-[#6B7280]">{c.phone}</div>
                <div className="text-xs text-[#6B7280] mt-1">
                  최근: {new Date(c.last).toLocaleDateString("ko-KR")} · {c.count}회
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-[#0751D8]">{won(c.lastAmount)}</div>
                <div className="flex gap-1 mt-2">
                  <a href={`tel:${c.phone}`} className="p-2 bg-[#EEF4FF] rounded-lg">
                    <Phone className="w-4 h-4 text-[#0751D8]" />
                  </a>
                  <a href={`sms:${c.phone}`} className="p-2 bg-[#EEF4FF] rounded-lg">
                    <MessageSquare className="w-4 h-4 text-[#0751D8]" />
                  </a>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <BottomNav />
    </MobileShell>
  );
}

// ============ Settings ============
export function SettingsScreen() {
  const { logout, setScreen } = useApp();
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);
  useEffect(() => setPricing(getPricing()), []);
  const setP = (patch: Partial<Pricing>) => {
    const next = { ...pricing, ...patch };
    setPricing(next);
    savePricing(next);
  };
  return (
    <MobileShell>
      <TopBar title="설정" />
      <div className="p-4 space-y-3 flex-1 overflow-auto pb-24">
        <button
          onClick={() => {
            tap();
            setScreen("subscription");
          }}
          className="w-full text-left rounded-2xl p-4 text-white font-bold shadow-[0_6px_0_#0645B0]"
          style={{ background: "linear-gradient(135deg, #287BFF 0%, #0751D8 100%)" }}
        >
          <div className="text-base">구독 · 결제 관리</div>
          <div className="text-xs font-medium opacity-90 mt-1">요금제 변경, 결제 내역 확인</div>
        </button>
        <Card className="space-y-3">
          <div className="font-bold">사업자 정보</div>
          <Field label="상호명">
            <TextInput defaultValue="JIMPICK" />
          </Field>
          <Field label="대표자명">
            <TextInput defaultValue="짐픽 사장" />
          </Field>
          <Field label="연락처">
            <TextInput defaultValue="010-0000-0000" />
          </Field>
          <Field label="사업자등록번호">
            <TextInput defaultValue="000-00-00000" />
          </Field>
        </Card>
        <Card className="space-y-3">
          <div className="font-bold">문자 기본 문구</div>
          <textarea
            defaultValue="안녕하세요, JIMPICK입니다. 요청하신 이사 견적을 안내드립니다."
            className="w-full px-4 py-3 rounded-xl border border-[#E7EBF2] bg-white text-sm min-h-24"
          />
        </Card>
        <Card className="space-y-3">
          <div className="font-bold">견적 단가 설정</div>
          <div className="text-xs text-[#6B7280]">
            여기서 저장한 단가로 모든 견적 금액이 자동 계산됩니다.
          </div>
          <div className="space-y-3">
            <Field label="1톤 차량">
              <MoneyInput
                value={pricing.truck1t}
                step={10000}
                onChange={(n) => setP({ truck1t: n })}
                inputClassName="h-14 py-0 leading-[3.5rem] text-[18px] font-bold text-[#111827]"
              />
            </Field>
            <Field label="5톤 차량">
              <MoneyInput
                value={pricing.truck5t}
                step={10000}
                onChange={(n) => setP({ truck5t: n })}
                inputClassName="h-14 py-0 leading-[3.5rem] text-[18px] font-bold text-[#111827]"
              />
            </Field>
          </div>
          <button
            onClick={() => {
              tap("soft");
              setPricing(DEFAULT_PRICING);
              savePricing(DEFAULT_PRICING);
              toast.success("기본 단가로 되돌렸습니다");
            }}
            className="text-xs text-[#6B7280] underline"
          >
            기본 단가로 되돌리기
          </button>
        </Card>
        <Card className="space-y-2 text-sm">
          <div className="font-bold text-base">구독 안내</div>
          <div>· 무료 체험 3일</div>
          <div>· 이후 월 22,000원 (부가세 포함)</div>
          <div>· 약정 없이 언제든 해지 가능</div>
          <div>· 재구독 시 기존 데이터 복원</div>
        </Card>
        <button
          onClick={logout}
          className="w-full py-4 rounded-2xl bg-white border border-[#EF4444] text-[#EF4444] font-bold flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" /> 로그아웃
        </button>
      </div>
      <BottomNav />
    </MobileShell>
  );
}

// ============ Stats ============
export function StatsScreen() {
  const { estimates, setScreen } = useApp();
  const now = new Date();
  const thisMonth = estimates.filter((e) => {
    const d = new Date(e.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const sum = (list: typeof estimates) => list.reduce((s, e) => s + (e.total || 0), 0);
  const avg = estimates.length ? Math.round(sum(estimates) / estimates.length) : 0;
  const byType = Array.from(
    estimates.reduce(
      (m, e) => m.set(e.moveType, (m.get(e.moveType) ?? 0) + 1),
      new Map<string, number>(),
    ),
  ).sort((a, b) => b[1] - a[1]);
  const maxType = byType[0]?.[1] ?? 1;

  return (
    <MobileShell>
      <TopBar title="통계 확인" onBack={() => setScreen("home")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto pb-24">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "전체 견적", value: `${estimates.length}건` },
            { label: "이번 달 견적", value: `${thisMonth.length}건` },
            { label: "이번 달 매출", value: won(sum(thisMonth)) },
            { label: "평균 견적가", value: won(avg) },
          ].map((c) => (
            <Card key={c.label} className="py-4">
              <div className="text-xs text-[#6B7280]">{c.label}</div>
              <div className="text-lg font-black text-[#0751D8] mt-1">{c.value}</div>
            </Card>
          ))}
        </div>
        <Card className="space-y-3">
          <div className="font-bold">이사 유형별 건수</div>
          {byType.length === 0 && (
            <div className="text-sm text-[#6B7280]">저장된 견적이 없습니다.</div>
          )}
          {byType.map(([name, count]) => (
            <div key={name} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{name}</span>
                <span className="font-semibold">{count}건</span>
              </div>
              <div className="h-2 rounded-full bg-[#EEF4FF] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(count / maxType) * 100}%`,
                    background: "linear-gradient(90deg, #4A94FF 0%, #0751D8 100%)",
                  }}
                />
              </div>
            </div>
          ))}
        </Card>
        <Card className="space-y-2">
          <div className="font-bold">최근 견적</div>
          {estimates.slice(0, 5).map((e) => (
            <div key={e.id} className="flex justify-between text-sm">
              <span className="text-[#6B7280]">
                {e.customerName || "이름 없음"} · {e.moveDate || "-"}
              </span>
              <span className="font-semibold">{won(e.total || 0)}</span>
            </div>
          ))}
          {estimates.length === 0 && <div className="text-sm text-[#6B7280]">기록이 없습니다.</div>}
        </Card>
      </div>
    </MobileShell>
  );
}
