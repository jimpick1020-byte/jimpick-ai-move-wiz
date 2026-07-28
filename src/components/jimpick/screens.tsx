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
} from "lucide-react";
import {
  useApp,
  ITEM_CATALOG,
  CATEGORIES,
  calcEstimate,
  formatPhone,
  won,
  type MoveType,
  type Room,
} from "@/lib/jimpick";
import {
  MobileShell,
  TopBar,
  PrimaryButton,
  BottomButtonBar,
  BottomNav,
  Counter,
  Card,
  Field,
  TextInput,
} from "./ui";
import { toast } from "sonner";
import { tap } from "@/lib/feedback";

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
        <div className="space-y-2.5 w-full mt-8">
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 px-2">
              <div className="w-9 h-9 rounded-xl bg-[#EEF4FF] flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#0751D8]" />
              </div>
              <span className="font-semibold text-[#111827]">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-6">
          <img src={truckImg} alt="JIMPICK 트럭" className="w-full max-w-[340px]" />
        </div>
      </div>
    </MobileShell>
  );
}

// ============ Login ============
export function Login() {
  const { login, savedId } = useApp();
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
            { label: "통계 확인", icon: BarChart3, s: "settings" as const },
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
        {err && <div className="text-sm text-[#EF4444]">{err}</div>}
      </div>
      <BottomButtonBar>
        <PrimaryButton onClick={next}>다음: 주소 검색</PrimaryButton>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ Step 2: Address ============
const SAMPLE_ADDRESSES = [
  "서울특별시 강남구 테헤란로 123",
  "서울특별시 마포구 월드컵북로 400",
  "서울특별시 송파구 올림픽로 300",
  "경기도 성남시 분당구 판교역로 235",
  "인천광역시 연수구 송도과학로 100",
  "부산광역시 해운대구 우동 1418",
];

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
  onSelect: (a: string) => void;
  onDetail: (d: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = q ? SAMPLE_ADDRESSES.filter((a) => a.includes(q)) : SAMPLE_ADDRESSES;
  return (
    <Card className="space-y-3">
      <div className="font-bold">{label}</div>
      <div className="flex gap-2">
        <TextInput
          placeholder="주소를 검색하세요 (예: 강남)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        <button
          onClick={() => setOpen(true)}
          className="px-4 rounded-xl text-white font-semibold"
          style={{ background: "linear-gradient(135deg, #287BFF, #0751D8)" }}
        >
          <Search className="w-5 h-5" />
        </button>
      </div>
      {open && (
        <div className="border border-[#E7EBF2] rounded-xl max-h-48 overflow-auto bg-white">
          {results.map((a) => (
            <button
              key={a}
              onClick={() => {
                onSelect(a);
                setOpen(false);
                setQ("");
              }}
              className="w-full text-left px-4 py-3 hover:bg-[#F5F7FB] text-sm border-b last:border-b-0 border-[#E7EBF2]"
            >
              {a}
            </button>
          ))}
        </div>
      )}
      {value && (
        <div className="text-sm bg-[#F5F7FB] rounded-xl p-3 font-medium">{value}</div>
      )}
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
  const hasBoth = draft.fromAddress && draft.toAddress;
  useEffect(() => {
    if (hasBoth && !draft.distanceKm) {
      const km = 5 + Math.round(Math.random() * 40);
      updateDraft({ distanceKm: km, durationMin: Math.round(km * 3) });
    }
  }, [hasBoth, draft.distanceKm, updateDraft]);
  return (
    <MobileShell>
      <TopBar title="2단계. 주소 검색" onBack={() => setScreen("step1")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto">
        <AddressSearch
          label="출발지"
          value={draft.fromAddress}
          detail={draft.fromDetail}
          onSelect={(a) => updateDraft({ fromAddress: a, distanceKm: 0 })}
          onDetail={(d) => updateDraft({ fromDetail: d })}
        />
        <AddressSearch
          label="도착지"
          value={draft.toAddress}
          detail={draft.toDetail}
          onSelect={(a) => updateDraft({ toAddress: a, distanceKm: 0 })}
          onDetail={(d) => updateDraft({ toDetail: d })}
        />
        {hasBoth && (
          <Card>
            <div className="font-bold mb-2">경로 안내</div>
            <div className="h-40 rounded-xl bg-gradient-to-br from-[#DDE9FF] to-[#EEF4FF] relative overflow-hidden">
              <div className="absolute top-4 left-4 w-4 h-4 rounded-full bg-[#0751D8] ring-4 ring-white" />
              <div className="absolute bottom-4 right-4 w-4 h-4 rounded-full bg-[#EF4444] ring-4 ring-white" />
              <svg className="absolute inset-0 w-full h-full">
                <line x1="16" y1="16" x2="100%" y2="100%" stroke="#287BFF" strokeWidth="3" strokeDasharray="6 4" />
              </svg>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 text-center">
              <div>
                <div className="text-xs text-[#6B7280]">거리</div>
                <div className="text-lg font-bold">{draft.distanceKm} km</div>
              </div>
              <div>
                <div className="text-xs text-[#6B7280]">예상 이동시간</div>
                <div className="text-lg font-bold">{draft.durationMin} 분</div>
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
  const maxFloor = draft.workEnv === "계단" ? 6 : 50;
  return (
    <MobileShell>
      <TopBar title="3단계. 작업 조건" onBack={() => setScreen("step2")} />
      <div className="p-5 space-y-5 flex-1 overflow-auto">
        <Field label="작업 환경">
          <div className="grid grid-cols-2 gap-3">
            <Card
              selected={draft.workEnv === "계단"}
              onClick={() =>
                updateDraft({ workEnv: "계단", fromFloor: Math.min(draft.fromFloor, 6), toFloor: Math.min(draft.toFloor, 6) })
              }
              className="text-center py-6"
            >
              <Art3D src={ENV_IMG["계단"]} alt="계단" size={72} className="mx-auto mb-2" />
              <div className="font-bold">계단 (수작업)</div>
            </Card>
            <Card
              selected={draft.workEnv === "엘리베이터"}
              onClick={() => updateDraft({ workEnv: "엘리베이터" })}
              className="text-center py-6"
            >
              <Art3D src={ENV_IMG["엘리베이터"]} alt="엘리베이터" size={72} className="mx-auto mb-2" />
              <div className="font-bold">엘리베이터</div>
            </Card>
          </div>
        </Field>
        <Field label="사다리차">
          <Card selected={draft.ladder > 0}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Art3D src={VEHICLE_IMG.ladder} alt="사다리차" size={56} />
                <div>
                  <div className="font-semibold">사다리차 대수</div>
                  <div className="text-xs text-[#6B7280]">필요 시 입력 (0~5대)</div>
                </div>
              </div>
              <Counter value={draft.ladder} onChange={(n) => updateDraft({ ladder: n })} min={0} max={5} />
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
    { key: "ladder" as const, name: "사다리차", img: VEHICLE_IMG.ladder, max: 5, val: draft.ladder },
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
            <Field label="사다리차 금액 (원)">
              <TextInput
                type="number"
                inputMode="numeric"
                placeholder="금액 입력"
                value={draft.ladderPrice || ""}
                onChange={(e) => updateDraft({ ladderPrice: Number(e.target.value) || 0 })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-[#0751D8]">
              <input
                type="checkbox"
                className="w-5 h-5"
                checked={draft.ladderSeparate}
                onChange={(e) => {
                  tap("soft");
                  updateDraft({ ladderSeparate: e.target.checked });
                }}
              />
              별도 (견적 합계에서 제외)
            </label>
          </div>
        </Card>
        <div className="text-xs text-[#6B7280] text-center px-4">
          ※ 차량은 견적 상황에 따라 변경될 수 있습니다.
        </div>
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
  const catalog = [
    ...ITEM_CATALOG,
    ...(draft.customItems || []).map((c) => ({ ...c, emoji: "📦" })),
  ].filter((i) => !(draft.hiddenItems || []).includes(i.id));
  const items = catalog.filter(
    (i) => (cat === "전체" || i.cat === cat) && (!q || i.name.includes(q))
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
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${
                c === cat ? "bg-[#EEF4FF] text-[#0751D8] border border-[#287BFF]" : "bg-white border border-[#E7EBF2] text-[#6B7280]"
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
          className="w-full py-3 rounded-2xl bg-white border-2 border-[#287BFF] text-[#0751D8] font-bold flex items-center justify-center gap-2"
        >
          <Camera className="w-5 h-5" /> AI 사진 인식으로 자동 입력
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
  const [results, setResults] = useState<{ id: string; name: string; qty: number; emoji: string }[]>([]);
  const scan = () => {
    setResults([
      { id: "sofa", name: "소파", qty: 2, emoji: "🛋️" },
      { id: "fridge", name: "냉장고", qty: 1, emoji: "🧊" },
      { id: "washer", name: "세탁기", qty: 1, emoji: "🌀" },
      { id: "tv", name: "TV", qty: 1, emoji: "📺" },
    ]);
    toast.success("AI 인식 완료");
  };
  const apply = () => {
    const room = draft.rooms.find((r) => r.id === currentRoomId) || draft.rooms[0];
    if (!room) return;
    const items = { ...room.items };
    for (const r of results) items[r.id] = (items[r.id] || 0) + r.qty;
    updateDraft({
      rooms: draft.rooms.map((x) => (x.id === room.id ? { ...x, items } : x)),
    });
    toast.success(`「${room.name}」에 적용되었습니다`);
    setScreen("step6");
  };
  return (
    <MobileShell>
      <TopBar title="AI 사진 인식" onBack={() => setScreen("step6")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto">
        <Card className="text-center py-10">
          <Camera className="w-16 h-16 mx-auto text-[#0751D8]" />
          <div className="font-bold mt-3">사진을 찍거나 불러와 주세요.</div>
          <div className="text-sm text-[#6B7280] mt-1">
            AI가 가구와 가전, 잔짐을 자동으로 인식합니다.
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={scan}
            className="py-4 rounded-2xl bg-white border border-[#E7EBF2] font-semibold flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" /> 카메라 촬영
          </button>
          <button
            onClick={scan}
            className="py-4 rounded-2xl bg-white border border-[#E7EBF2] font-semibold flex items-center justify-center gap-2"
          >
            <ImageIcon className="w-5 h-5" /> 사진 불러오기
          </button>
        </div>
        {results.length > 0 && (
          <div className="space-y-2">
            <div className="font-bold">인식 결과</div>
            {results.map((r, i) => (
              <Card key={r.id} className="flex items-center gap-3">
                <Art3D src={ITEM_IMG[r.id]} alt={r.name} size={48} />
                <div className="flex-1">
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-[#6B7280]">인식됨</div>
                </div>
                <Counter
                  value={r.qty}
                  onChange={(n) => setResults(results.map((x, j) => (j === i ? { ...x, qty: n } : x)))}
                />
                <button
                  onClick={() => setResults(results.filter((_, j) => j !== i))}
                  className="p-2 text-[#EF4444]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <Check className="w-5 h-5 text-[#16A34A]" />
              </Card>
            ))}
          </div>
        )}
      </div>
      <BottomButtonBar>
        <div className="flex gap-2">
          <button
            onClick={() => setResults([])}
            className="flex-1 py-4 rounded-2xl border border-[#E7EBF2] font-bold"
          >
            다시 촬영
          </button>
          <PrimaryButton onClick={apply} className="flex-1">
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
        {draft.options.map((o, i) => (
          <Card key={o.id}>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-3 font-semibold">
                <input
                  type="checkbox"
                  checked={o.enabled}
                  onChange={(e) =>
                    updateDraft({
                      options: draft.options.map((x, j) =>
                        j === i ? { ...x, enabled: e.target.checked } : x
                      ),
                    })
                  }
                  className="w-5 h-5"
                />
                {o.name}
              </label>
            </div>
            {o.enabled && (
              <TextInput
                type="number"
                inputMode="numeric"
                placeholder="금액 입력"
                value={o.price || ""}
                onChange={(e) =>
                  updateDraft({
                    options: draft.options.map((x, j) =>
                      j === i ? { ...x, price: Number(e.target.value) || 0 } : x
                    ),
                  })
                }
                className="mt-3"
              />
            )}
          </Card>
        ))}
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
            <Field label="하루 보관 단가 (원)">
              <TextInput
                type="number"
                value={draft.storageDaily}
                onChange={(e) => updateDraft({ storageDaily: Number(e.target.value) || 0 })}
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
  const { total, parts } = calcEstimate(draft);
  useEffect(() => {
    if (draft.total !== total) updateDraft({ total });
  }, [total, draft.total, updateDraft]);
  const sendSMS = () => {
    const msg = `[JIMPICK 견적]\n${draft.customerName}님\n이사일: ${draft.moveDate} ${draft.moveTime}\n${draft.fromAddress} → ${draft.toAddress}\n예상 견적: ${won(total)}`;
    if (confirm(`아래 문자를 발송하시겠습니까?\n\n${msg}`)) {
      toast.success("문자 발송 완료 (데모)");
    }
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
          <button
            onClick={() => setDetail((v) => !v)}
            className="text-sm bg-white/20 rounded-full px-4 py-2 font-semibold"
          >
            {detail ? "간단히 보기" : "상세 내역 보기"}
          </button>
        </div>
        {detail && (
          <Card className="space-y-2">
            {parts.map((p) => (
              <div key={p.label} className="flex justify-between text-sm">
                <span className="text-[#6B7280]">{p.label}</span>
                <span className="font-semibold">{won(p.amount)}</span>
              </div>
            ))}
            <div className="border-t border-[#E7EBF2] pt-2 mt-2 flex justify-between font-bold">
              <span>합계</span>
              <span className="text-[#0751D8]">{won(total)}</span>
            </div>
          </Card>
        )}
        <Card className="space-y-2 text-sm">
          <div className="font-bold text-base mb-2">이사 정보</div>
          <div>👤 {draft.customerName} · {draft.phone}</div>
          <div>📅 {draft.moveDate} {draft.moveTime}</div>
          <div>🚚 {draft.moveType}</div>
          <div className="text-[#6B7280]">출발: {draft.fromAddress} {draft.fromDetail}</div>
          <div className="text-[#6B7280]">도착: {draft.toAddress} {draft.toDetail}</div>
          <div>거리 {draft.distanceKm}km · {draft.workEnv} · {draft.fromFloor}층→{draft.toFloor}층</div>
          <div>남자 {draft.workers}명 · 이모 {draft.kitchenStaff}명</div>
          <div>1톤 {draft.truck1t} · 5톤 {draft.truck5t} · 사다리 {draft.ladder}</div>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={sendSMS} className="py-4 rounded-2xl bg-white border border-[#E7EBF2] font-bold flex items-center justify-center gap-2">
            <MessageSquare className="w-5 h-5" /> 문자 발송
          </button>
          <button
            onClick={() => {
              saveDraft();
              toast.success("견적이 저장되었습니다");
            }}
            className="py-4 rounded-2xl bg-white border border-[#E7EBF2] font-bold flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" /> 견적 저장
          </button>
        </div>
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
  const { logout } = useApp();
  return (
    <MobileShell>
      <TopBar title="설정" />
      <div className="p-4 space-y-3 flex-1 overflow-auto">
        <Card className="space-y-3">
          <div className="font-bold">사업자 정보</div>
          <Field label="상호명"><TextInput defaultValue="JIMPICK" /></Field>
          <Field label="대표자명"><TextInput defaultValue="짐픽 사장" /></Field>
          <Field label="연락처"><TextInput defaultValue="010-0000-0000" /></Field>
          <Field label="사업자등록번호"><TextInput defaultValue="000-00-00000" /></Field>
        </Card>
        <Card className="space-y-3">
          <div className="font-bold">기본 요금</div>
          <Field label="남자 작업자 1인당"><TextInput defaultValue="150000" /></Field>
          <Field label="주방 이모 1인당"><TextInput defaultValue="150000" /></Field>
          <Field label="1톤 차량"><TextInput defaultValue="250000" /></Field>
          <Field label="5톤 차량"><TextInput defaultValue="850000" /></Field>
          <Field label="사다리차"><TextInput defaultValue="200000" /></Field>
          <Field label="거리 추가 단가 (km당)"><TextInput defaultValue="2000" /></Field>
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
