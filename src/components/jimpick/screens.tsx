import { useEffect, useMemo, useState } from "react";
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
  Phone,
  MessageSquare,
  LogOut,
  Truck,
  ArrowUpDown,
  Video,
  Send,
  Link as LinkIcon,
} from "lucide-react";

import {
  useApp,
  ITEM_CATALOG,
  CATEGORIES,
  OPTION_PRESETS,
  calcEstimate,
  formatPhone,
  won,
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
import aiRobotPhoto from "@/assets/ai-robot-photo.png";
import aiRobotVideo from "@/assets/ai-robot-video.png";
import { toast } from "sonner";
import { tap } from "@/lib/feedback";
import { KakaoMap } from "./KakaoMap";
import { searchAddress, getRoute, type KakaoPlace } from "@/lib/kakao.functions";
import { recognizeItems, type DetectedItem } from "@/lib/ai.functions";
import { fileToDataUrl, videoToFrames } from "@/lib/media";

// ============ Splash ============
import truckImg from "@/assets/jimpick-truck.png";
import logoImg from "@/assets/jimpick-logo.png";
import { Art3D, ITEM_IMG, ROOM_IMG, VEHICLE_IMG, CHAR_IMG, ENV_IMG } from "@/lib/jimpick-art";

import { FileText, Camera as CamIcon, MapPin, Sparkles, UserCircle } from "lucide-react";

export function Splash() {
  const { setScreen, loggedIn } = useApp();
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
            <span className="text-5xl font-black text-[#0751D8] tracking-tight">JIMPICK</span>
            <span className="text-lg font-bold text-white bg-[#0751D8] rounded-md px-2 py-0.5">7.0</span>
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
        <div className="mt-auto pt-6">
          <img src={truckImg} alt="JIMPICK 트럭" className="w-full max-w-[340px] jp-float" />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            tap("click");
            setScreen(loggedIn ? "home" : "login");
          }}
          className="w-full mt-4 py-4 rounded-2xl text-white text-lg font-black tracking-tight shadow-[0_14px_30px_-10px_rgba(121,40,202,0.6)] transition-transform active:translate-y-[2px]"
          style={{ background: "linear-gradient(90deg,#ff007f 0%,#7928ca 50%,#00dfd8 100%)" }}
        >
          AI 견적 바로 시작하기
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
        <div className="text-center text-xs text-[#6B7280] pt-6">
          © JIMPICK · Ver 7.0.0
        </div>
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
            <Card key={label} onClick={() => setScreen(s)} className="flex flex-col items-center py-4 gap-2">
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
      <div className="p-5 space-y-4 flex-1 overflow-auto">
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
            onChange={(e) => updateDraft({ moveDate: e.target.value })}
          />
        </Field>
        <Field label="시작 시간">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={draft.moveTime.split(" ")[0]}
              onChange={(e) =>
                updateDraft({ moveTime: `${e.target.value} ${draft.moveTime.split(" ")[1] || "09:00"}` })
              }
              className="px-4 py-3 rounded-xl border border-[#E7EBF2] bg-white text-base"
            >
              <option>오전</option>
              <option>오후</option>
            </select>
            <select
              value={draft.moveTime.split(" ")[1] || "09:00"}
              onChange={(e) =>
                updateDraft({ moveTime: `${draft.moveTime.split(" ")[0] || "오전"} ${e.target.value}` })
              }
              className="px-4 py-3 rounded-xl border border-[#E7EBF2] bg-white text-base"
            >
              {Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(2, "0")}:00`).map((h) => (
                <option key={h}>{h}</option>
              ))}
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

  const from = draft.fromX && draft.fromY ? { x: draft.fromX, y: draft.fromY } : null;
  const to = draft.toX && draft.toY ? { x: draft.toX, y: draft.toY } : null;
  const hasBoth = Boolean(draft.fromAddress && draft.toAddress);

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    setRouting(true);
    (async () => {
      try {
        const res = await getRoute({
          data: { originX: from.x, originY: from.y, destX: to.x, destY: to.y },
        });
        if (cancelled) return;
        setPath(res.path ?? null);
        updateDraft({ distanceKm: res.distanceKm, durationMin: res.durationMin });
        if (res.approx) toast.info("실제 경로를 불러오지 못해 예상 거리로 계산했습니다.");
      } catch {
        if (!cancelled) toast.error("경로를 계산하지 못했습니다.");
      } finally {
        if (!cancelled) setRouting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from?.x, from?.y, to?.x, to?.y]);

  return (
    <MobileShell>
      <TopBar title="2단계. 주소 검색" onBack={() => setScreen("step1")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto">
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
          <Card>
            <div className="font-bold mb-2">경로 안내</div>
            <KakaoMap from={from} to={to} path={path} height={180} />
            <div className="grid grid-cols-2 gap-3 mt-3 text-center">
              <div>
                <div className="text-xs text-[#6B7280]">실거리</div>
                <div className="text-lg font-bold">
                  {routing ? "계산 중..." : `${draft.distanceKm} km`}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6B7280]">예상 이동시간</div>
                <div className="text-lg font-bold">
                  {routing ? "계산 중..." : `${draft.durationMin} 분`}
                </div>
              </div>
            </div>
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
        ? { workEnv: next, fromFloor: Math.min(draft.fromFloor, 6), toFloor: Math.min(draft.toFloor, 6) }
        : { workEnv: next },
    );
  };
  return (
    <MobileShell>
      <TopBar title="3단계. 작업 조건" onBack={() => setScreen("step2")} />
      <div className="p-5 space-y-5 flex-1 overflow-auto">
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
              <Art3D src={ENV_IMG["엘리베이터"]} alt="엘리베이터" size={72} className="mx-auto mb-2" />
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
              <Counter value={draft.workers} onChange={(n) => updateDraft({ workers: n })} min={0} max={10} />
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
  const { draft, updateDraft, setScreen } = useApp();
  const vehicles = [
    { key: "truck1t" as const, name: "1톤 차량", img: VEHICLE_IMG.truck1t, max: 10, val: draft.truck1t },
    { key: "truck5t" as const, name: "5톤 차량", img: VEHICLE_IMG.truck5t, max: 10, val: draft.truck5t },
    
  ];
  return (
    <MobileShell>
      <TopBar title="4단계. 차량 선택" onBack={() => setScreen("step3")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto">
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
              <Counter value={v.val} onChange={(n) => updateDraft({ [v.key]: n } as any)} min={0} max={v.max} />
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
                  updateDraft({ ladderFrom: e.target.checked });
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
                  updateDraft({ ladderTo: e.target.checked });
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
              <span className="text-[#0751D8]">{won(draft.ladderFromPrice + draft.ladderToPrice)}</span>
            </div>
          </div>
        </Card>
      </div>
      <BottomButtonBar>
        <PrimaryButton onClick={() => setScreen("step5")}>다음: 방·품목 입력</PrimaryButton>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ Step 5: Rooms ============
export function Step5() {
  const { draft, updateDraft, setScreen, setCurrentRoom } = useApp();
  const [selected, setSelected] = useState<string[]>(draft.rooms.map((r) => r.id));
  const [deleting, setDeleting] = useState<Room | null>(null);
  const addRoom = () => {
    const name = prompt("추가할 방 이름을 입력하세요");
    if (!name) return;
    const room: Room = { id: `r_${Date.now()}`, name, items: {} };
    updateDraft({ rooms: [...draft.rooms, room] });
    setSelected([...selected, room.id]);
  };
  const removeRoom = (r: Room) => setDeleting(r);
  const confirmDelete = () => {
    if (!deleting) return;
    updateDraft({ rooms: draft.rooms.filter((x) => x.id !== deleting.id) });
    setSelected(selected.filter((x) => x !== deleting.id));
    setDeleting(null);
  };
  const next = () => {
    const first = draft.rooms.find((r) => selected.includes(r.id));
    if (!first) return toast.error("방을 하나 이상 선택하세요");
    setCurrentRoom(first.id);
    setScreen("step6");
  };


  return (
    <MobileShell>
      <TopBar title="5단계. 방 선택" onBack={() => setScreen("step4")} />
      <div className="p-5 space-y-3 flex-1 overflow-auto">
        <div className="grid grid-cols-2 gap-3">
          {draft.rooms.map((r) => {
            const sel = selected.includes(r.id);
            return (
              <Card
                key={r.id}
                selected={sel}
                onClick={() =>
                  setSelected(sel ? selected.filter((x) => x !== r.id) : [...selected, r.id])
                }
                className="text-center py-5 relative"
              >
                <Art3D src={ROOM_IMG[r.name] || ROOM_IMG["거실"]} alt={r.name} size={84} className="mb-2" />
                <div className="font-bold">{r.name}</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRoom(r);
                  }}
                  className="absolute top-2 right-2 p-1 text-[#EF4444]"
                  aria-label="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Card>
            );
          })}
        </div>
        <button
          onClick={addRoom}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-[#287BFF] text-[#0751D8] font-bold flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" /> 방 추가
        </button>
      </div>
      {deleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="font-bold text-lg">방 삭제</div>
            <div className="text-sm text-[#6B7280]">
              「{deleting.name}」 방을 삭제하시겠습니까? 저장된 품목도 함께 삭제됩니다.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleting(null)}
                className="flex-1 py-3 rounded-xl border border-[#E7EBF2] font-semibold"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 rounded-xl bg-[#EF4444] text-white font-semibold"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomButtonBar>
        <PrimaryButton onClick={next}>다음: 품목 입력</PrimaryButton>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ Step 6: Items ============
export function Step6() {
  const { draft, updateDraft, setScreen, currentRoomId, setCurrentRoom } = useApp();
  const [cat, setCat] = useState<string>("전체");
  const [q, setQ] = useState("");
  const roomId = currentRoomId || draft.rooms[0]?.id;
  useEffect(() => {
    if (!currentRoomId && draft.rooms[0]) setCurrentRoom(draft.rooms[0].id);
  }, [currentRoomId, draft.rooms, setCurrentRoom]);
  const room = draft.rooms.find((r) => r.id === roomId);
  // 방을 클릭하면 그 방에 선택된 품목만 보여줍니다.
  const [onlySelected, setOnlySelected] = useState(true);
  useEffect(() => {
    setOnlySelected(true);
  }, [roomId]);
  const catalog = [
    ...ITEM_CATALOG,
    ...(draft.customItems || []).map((c) => ({ ...c, emoji: "📦" })),
  ].filter((i) => !(draft.hiddenItems || []).includes(i.id));
  const selectedCount = room ? Object.keys(room.items).length : 0;
  const showSelectedOnly = onlySelected && !q && selectedCount > 0;
  const items = catalog.filter(
    (i) =>
      (showSelectedOnly
        ? (room?.items[i.id] || 0) > 0
        : cat === "전체" || i.cat === cat) && (!q || i.name.includes(q))
  );
  const addItem = () => {
    const name = prompt("추가할 품목 이름");
    if (!name) return;
    const catName =
      prompt(`분류를 입력하세요 (가구/가전/주방/생활용품/잔짐)`, cat === "전체" ? "가구" : cat) || "잔짐";
    const extra = Number(prompt("품목 추가금액 (원, 없으면 0)", "0")) || 0;
    updateDraft({
      customItems: [
        ...(draft.customItems || []),
        { id: `ci_${Date.now()}`, name, cat: catName, extra },
      ],
    });
    tap("success");
    toast.success(`「${name}」 품목이 추가되었습니다`);
  };
  const removeItem = (id: string, name: string) => {
    if (!confirm(`「${name}」 품목을 목록에서 삭제할까요?`)) return;
    updateDraft({
      hiddenItems: [...(draft.hiddenItems || []), id],
      customItems: (draft.customItems || []).filter((c) => c.id !== id),
      rooms: draft.rooms.map((r) => {
        const it = { ...r.items };
        delete it[id];
        return { ...r, items: it };
      }),
    });
    tap("soft");
  };
  const setQty = (itemId: string, qty: number) => {
    if (!room) return;
    const items = { ...room.items };
    if (qty <= 0) delete items[itemId];
    else items[itemId] = qty;
    updateDraft({
      rooms: draft.rooms.map((r) => (r.id === room.id ? { ...r, items } : r)),
    });
  };
  return (
    <MobileShell>
      <TopBar title="6단계. 품목 입력" onBack={() => setScreen("step5")} />
      <div className="p-4 space-y-3 flex-1 overflow-auto">
        <div className="flex gap-2 overflow-auto -mx-1 px-1">
          {draft.rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => setCurrentRoom(r.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
                r.id === roomId
                  ? "bg-[#0751D8] text-white"
                  : "bg-white border border-[#E7EBF2] text-[#6B7280]"
              }`}
            >
              {r.name}
              {Object.keys(r.items).length > 0 && ` (${Object.values(r.items).reduce((a, b) => a + b, 0)})`}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-auto -mx-1 px-1">
          {showSelectedOnly && (
            <button
              onClick={() => {
                setOnlySelected(false);
                tap();
              }}
              className="px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap bg-white border border-[#E7EBF2] text-[#6B7280]"
            >
              전체 품목 보기
            </button>
          )}

          {CATEGORIES.filter((c) => c !== "전체").map((c) => (
            <button
              key={c}
              onClick={() => {
                setCat(c);
                setOnlySelected(false);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${
                !showSelectedOnly && c === cat
                  ? "bg-[#EEF4FF] text-[#0751D8] border border-[#287BFF]"
                  : "bg-white border border-[#E7EBF2] text-[#6B7280]"
              }`}
            >
              {c}
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
        <button
          onClick={() => setScreen("ai")}
          className="w-full py-3 rounded-2xl bg-white border-2 border-[#287BFF] text-[#0751D8] font-bold flex items-center justify-center gap-2 text-sm"
        >
          <Camera className="w-5 h-5" />
          <Video className="w-5 h-5" /> AI 사진·동영상 인식
        </button>

        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => {
            const qty = room?.items[it.id] || 0;
            return (
              <Card key={it.id} selected={qty > 0} className="text-center py-4 relative">
                <button
                  onClick={() => removeItem(it.id, it.name)}
                  className="absolute top-2 right-2 p-1 text-[#EF4444]"
                  aria-label="품목 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {ITEM_IMG[it.id] ? (
                  <Art3D src={ITEM_IMG[it.id]} alt={it.name} size={72} className="mb-2" />
                ) : (
                  <div className="h-[72px] flex items-center justify-center text-4xl mb-2">{it.emoji}</div>
                )}
                <div className="font-bold text-sm mb-2">{it.name}</div>
                <div className="flex justify-center">
                  <Counter value={qty} onChange={(n) => setQty(it.id, n)} min={0} max={20} />
                </div>
              </Card>
            );
          })}
        </div>
        <button
          onClick={addItem}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-[#287BFF] text-[#0751D8] font-bold flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" /> 품목 추가
        </button>
      </div>
      <BottomButtonBar>
        <PrimaryButton onClick={() => setScreen("options")}>다음: 옵션·보관료</PrimaryButton>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ AI Recognition ============
export function AIRecognition() {
  const { draft, updateDraft, setScreen, currentRoomId } = useApp();
  const [results, setResults] = useState<DetectedItem[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [onlyHigh, setOnlyHigh] = useState(true);

  const THRESHOLD = 0.9;
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
        toast.info("90% 이상 확신하는 품목이 없습니다. 더 밝고 가까이 촬영해 주세요.");
        setOnlyHigh(false);
      } else {
        toast.success(`AI 인식 완료 — 정확도 90% 이상 ${high}개 품목`);
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
    setVideoUrl("");
    setPhotoUrl(URL.createObjectURL(f));
    const dataUrl = await fileToDataUrl(f);
    await analyze([dataUrl], "photo");
  };

  const onVideo = async (f: File) => {
    setPhotoUrl("");
    setVideoUrl(URL.createObjectURL(f));
    setBusy(true);
    try {
      const frames = await videoToFrames(f, 6);
      await analyze(frames, "video");
    } catch {
      toast.error("동영상을 분석하지 못했습니다");
      setBusy(false);
    }
  };

  const apply = () => {
    const room = draft.rooms.find((r) => r.id === currentRoomId) || draft.rooms[0];
    if (!room) return;
    const items = { ...room.items };
    for (const r of shown) items[r.id] = (items[r.id] || 0) + r.qty;
    updateDraft({
      rooms: draft.rooms.map((x) => (x.id === room.id ? { ...x, items } : x)),
    });
    toast.success(`「${room.name}」에 ${shown.length}개 품목이 적용되었습니다`);
    setScreen("step6");
  };

  return (
    <MobileShell>
      <TopBar title="AI 사진·동영상 인식" onBack={() => setScreen("step6")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto">
        {(videoUrl || photoUrl) && (
          <Card className="py-4">
            {videoUrl ? (
              <video src={videoUrl} controls className="w-full rounded-xl" />
            ) : (
              <img src={photoUrl} alt="업로드한 사진" className="w-full rounded-xl" />
            )}
          </Card>
        )}

        <Card className="flex items-center gap-3">
          <img
            src={aiRobotPhoto}
            alt="AI 사진 인식 로봇"
            width={768}
            height={768}
            loading="lazy"
            className="w-24 h-24 object-contain drop-shadow-[0_12px_16px_rgba(7,81,216,0.25)]"
          />
          <div className="flex-1">
            <div className="font-bold text-lg">AI 사진 인식</div>
            <div className="text-sm text-[#6B7280] mt-1 mb-3">가구·가전을 90% 정확도로 자동 인식합니다.</div>
            <label className="block w-full py-3 rounded-2xl text-white text-center font-bold cursor-pointer shadow-[0_4px_0_#0645B0]" style={{ background: "linear-gradient(180deg, #4A94FF 0%, #0751D8 100%)" }}>
              사진 촬영
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPhoto(f);
                }}
              />
            </label>
          </div>
        </Card>

        <Card className="flex items-center gap-3">
          <img
            src={aiRobotVideo}
            alt="AI 동영상 인식 로봇"
            width={768}
            height={768}
            loading="lazy"
            className="w-24 h-24 object-contain drop-shadow-[0_12px_16px_rgba(7,81,216,0.25)]"
          />
          <div className="flex-1">
            <div className="font-bold text-lg">AI 동영상 인식</div>
            <div className="text-sm text-[#6B7280] mt-1 mb-3">방을 천천히 한 바퀴 촬영하면 장면을 나눠 분석합니다.</div>
            <label className="block w-full py-3 rounded-2xl text-white text-center font-bold cursor-pointer shadow-[0_4px_0_#0645B0]" style={{ background: "linear-gradient(180deg, #4A94FF 0%, #0751D8 100%)" }}>
              동영상 촬영
              <input
                type="file"
                accept="video/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onVideo(f);
                }}
              />
            </label>
          </div>
        </Card>

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
                {onlyHigh ? `90% 이상만 보기 (숨김 ${lowCount})` : "전체 보기"}
              </button>
            </div>
            {shown.map((r, i) => (
              <Card key={r.id} className="flex items-center gap-3">
                <Art3D src={ITEM_IMG[r.id]} alt={r.name} size={48} />
                <div className="flex-1">
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-[#6B7280]">
                    정확도 {Math.round(r.confidence * 100)}%{r.note ? ` · ${r.note}` : ""}
                  </div>
                </div>
                <Counter
                  value={r.qty}
                  onChange={(n) =>
                    setResults(results.map((x) => (x.id === r.id ? { ...x, qty: n } : x)))
                  }
                />
                <button
                  onClick={() => setResults(results.filter((x) => x.id !== r.id))}
                  className="p-2 text-[#EF4444]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {r.confidence >= THRESHOLD ? (
                  <Check className="w-5 h-5 text-[#16A34A]" />
                ) : (
                  <span className="text-[10px] font-bold text-[#F59E0B]">확인</span>
                )}
                <span className="sr-only">{i}</span>
              </Card>
            ))}
          </div>
        )}
      </div>
      <BottomButtonBar>
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
            적용하기
          </PrimaryButton>
        </div>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ Options & Storage ============
export function OptionsScreen() {
  const { draft, updateDraft, setScreen } = useApp();
  const days = useMemo(() => {
    if (!draft.storageStart || !draft.storageEnd) return 0;
    return Math.max(
      0,
      Math.round(
        (new Date(draft.storageEnd).getTime() - new Date(draft.storageStart).getTime()) / 86400000
      )
    );
  }, [draft.storageStart, draft.storageEnd]);
  return (
    <MobileShell>
      <TopBar title="옵션·보관료 입력" onBack={() => setScreen("step6")} />
      <div className="p-5 space-y-3 flex-1 overflow-auto">
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
                        j === i ? { ...x, enabled: e.target.checked } : x
                      ),
                    });
                  }}
                  className="w-5 h-5"
                />
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
                          j === i ? { ...x, separate: e.target.checked } : x
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
        {draft.moveType === "보관이사" && (
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
            <Field label="하루 보관 단가">
              <MoneyInput
                value={draft.storageDaily}
                onChange={(n) => updateDraft({ storageDaily: n })}
                step={1000}
              />
            </Field>
            <div className="text-sm">
              보관 일수: <b>{days}일</b> · 총 보관료:{" "}
              <b className="text-[#0751D8]">{won(days * draft.storageDaily)}</b>
            </div>
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
  const { draft, setScreen, saveDraft, updateDraft } = useApp();
  const [detail, setDetail] = useState(false);
  const [detailEdit, setDetailEdit] = useState(false);
  const [edit, setEdit] = useState(false);
  
  const [adjust, setAdjust] = useState(0);
  const calc = calcEstimate(draft);
  const total = calc.total + adjust;
  const parts = adjust ? [...calc.parts, { label: "할인·조정", amount: adjust }] : calc.parts;
  useEffect(() => {
    if (draft.total !== total) updateDraft({ total });
  }, [total, draft.total, updateDraft]);
  const sendSMS = () => {
    const msg = `[JIMPICK 견적]\n${draft.customerName}님\n이사일: ${draft.moveDate} ${draft.moveTime}\n${draft.fromAddress} → ${draft.toAddress}\n예상 견적: ${won(total)}`;
    if (confirm(`아래 문자를 발송하시겠습니까?\n\n${msg}`)) {
      tap("success");
      toast.success("문자 발송 완료 (데모)");
    }
  };
  const sendKakao = () => {
    const msg = `[JIMPICK 견적]\n${draft.customerName}님\n이사일: ${draft.moveDate} ${draft.moveTime}\n${draft.fromAddress} → ${draft.toAddress}\n예상 견적: ${won(total)}`;
    tap("success");
    try {
      void navigator.clipboard?.writeText(msg);
    } catch {}
    window.open(`https://sharer.kakao.com/talk/friends/picker/link?text=${encodeURIComponent(msg)}`, "_blank");
    toast.success("카카오톡으로 견적 내용을 전달했습니다 (내용 복사됨)");
  };
  return (
    <MobileShell>
      <TopBar title="견적 결과" onBack={() => setScreen("options")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto">
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
                    value={
                      draft.transportOverride ?? (calc.parts.find((p) => p.label === "기본 운송료")?.amount ?? 0)
                    }
                    onChange={(n) => updateDraft({ transportOverride: n })}
                    step={10000}
                  />
                </Field>
                {calc.parts
                  .filter((p) => ["계단 추가비", "옵션 비용", "보관료"].includes(p.label))
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
                <TextInput value={draft.customerName} onChange={(e) => updateDraft({ customerName: e.target.value })} />
              </Field>
              <Field label="연락처">
                <TextInput value={draft.phone} onChange={(e) => updateDraft({ phone: formatPhone(e.target.value) })} />
              </Field>
              <Field label="이사일">
                <TextInput type="date" value={draft.moveDate} onChange={(e) => updateDraft({ moveDate: e.target.value })} />
              </Field>
              <Field label="출발지">
                <TextInput value={draft.fromAddress} onChange={(e) => updateDraft({ fromAddress: e.target.value })} />
              </Field>
              <Field label="도착지">
                <TextInput value={draft.toAddress} onChange={(e) => updateDraft({ toAddress: e.target.value })} />
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
                  <TextInput type="number" value={draft.truck1t} onChange={(e) => updateDraft({ truck1t: Number(e.target.value) || 0 })} />
                </Field>
                <Field label="5톤">
                  <TextInput type="number" value={draft.truck5t} onChange={(e) => updateDraft({ truck5t: Number(e.target.value) || 0 })} />
                </Field>
                <Field label="사다리">
                  <TextInput type="number" value={draft.ladder} onChange={(e) => updateDraft({ ladder: Number(e.target.value) || 0 })} />
                </Field>
              </div>
              <Field label="할인·조정 금액 (원, 음수 가능)">
                <TextInput
                  type="number"
                  value={adjust}
                  onChange={(e) => setAdjust(Number(e.target.value) || 0)}
                />
              </Field>
            </div>
          ) : (
            <>
              <div>👤 {draft.customerName} · {draft.phone}</div>
              <div>📅 {draft.moveDate} {draft.moveTime}</div>
              <div>🚚 {draft.moveType}</div>
              <div className="text-[#6B7280]">출발: {draft.fromAddress} {draft.fromDetail}</div>
              <div className="text-[#6B7280]">도착: {draft.toAddress} {draft.toDetail}</div>
              <div>거리 {draft.distanceKm}km · {draft.workEnv} · {draft.fromFloor}층→{draft.toFloor}층</div>
              <div>
                1톤 {draft.truck1t} · 5톤 {draft.truck5t} · 사다리 {draft.ladder}
                {(draft.ladderFrom || draft.ladderTo) &&
                  ` (${[draft.ladderFrom && "출발지", draft.ladderTo && "도착지"].filter(Boolean).join("·")}${
                    draft.ladderSeparate ? " · 별도" : ""
                  })`}
              </div>
              {draft.options.filter((o) => o.enabled).map((o) => (
                <div key={o.id}>
                  ➕ {o.name} · {o.separate ? "별도" : won(o.price)}
                </div>
              ))}
            </>
          )}
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={sendSMS} className="py-4 rounded-2xl bg-white border border-[#DFE6F2] font-bold flex items-center justify-center gap-2 shadow-[0_4px_0_#E3E9F5,0_10px_20px_-8px_rgba(15,23,42,0.25)] active:translate-y-[2px] active:shadow-[0_2px_0_#E3E9F5]">
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
        <PrimaryButton
          onClick={() => {
            saveDraft();
            toast.success("견적이 완료되었습니다");
            setScreen("home");
          }}
        >
          견적 완료
        </PrimaryButton>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ History ============
export function History() {
  const { estimates, setScreen, loadEstimate, deleteEstimate } = useApp();
  const [q, setQ] = useState("");
  const list = estimates.filter(
    (e) => !q || e.customerName.includes(q) || e.phone.includes(q) || e.moveDate.includes(q)
  );
  return (
    <MobileShell>
      <TopBar title="견적 내역" />
      <div className="p-4 space-y-3 flex-1 overflow-auto">
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
  const map = new Map<string, { name: string; phone: string; last: number; count: number; lastAmount: number }>();
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
  const list = Array.from(map.values()).filter((c) => !q || c.name.includes(q) || c.phone.includes(q));
  return (
    <MobileShell>
      <TopBar title="고객 관리" />
      <div className="p-4 space-y-3 flex-1 overflow-auto">
        <TextInput placeholder="고객 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        {list.length === 0 && <div className="text-center text-[#6B7280] py-16">고객 정보가 없습니다.</div>}
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
  return (
    <MobileShell>
      <TopBar title="설정" />
      <div className="p-4 space-y-3 flex-1 overflow-auto">
        <button
          onClick={() => { tap(); setScreen("subscription"); }}
          className="w-full text-left rounded-2xl p-4 text-white font-bold shadow-[0_6px_0_#0645B0]"
          style={{ background: "linear-gradient(135deg, #287BFF 0%, #0751D8 100%)" }}
        >
          <div className="text-base">구독 · 결제 관리</div>
          <div className="text-xs font-medium opacity-90 mt-1">요금제 변경, 결제 내역 확인</div>
        </button>
        <Card className="space-y-3">
          <div className="font-bold">사업자 정보</div>
          <Field label="상호명"><TextInput defaultValue="JIMPICK" /></Field>
          <Field label="대표자명"><TextInput defaultValue="짐픽 사장" /></Field>
          <Field label="연락처"><TextInput defaultValue="010-0000-0000" /></Field>
          <Field label="사업자등록번호"><TextInput defaultValue="000-00-00000" /></Field>
        </Card>
        <Card className="space-y-3">
          <div className="font-bold">문자 기본 문구</div>
          <textarea
            defaultValue="안녕하세요, JIMPICK입니다. 요청하신 이사 견적을 안내드립니다."
            className="w-full px-4 py-3 rounded-xl border border-[#E7EBF2] bg-white text-sm min-h-24"
          />
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
