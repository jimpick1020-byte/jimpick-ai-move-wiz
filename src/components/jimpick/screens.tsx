import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ChangeEvent as ReactChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Bell,
  ClipboardList,
  Users,
  BarChart3,
  Plus,
  Minus,
  Search,
  Camera,
  Image as ImageIcon,
  Check,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  Phone,
  MessageSquare,
  LogOut,
  Truck,
  ArrowUpDown,
  Video,
  X,
  ChevronDown,
  ChevronLeft,
  Mic,
  ShieldCheck,
  ChevronRight,
  CircleDollarSign,
  User,
  Calendar,
  CheckCircle2,
  Headphones,
  History as HistoryIcon,
  BookOpen,
} from "lucide-react";

import {
  useApp,
  ITEM_CATALOG,
  BROWSE_ITEMS,
  CATS5,
  cat5For,
  suggestRoomName,
  itemNameById,
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
  sideConditionText,
  workConditionSummary,
  type Estimate,
  type Pricing,
  type MoveType,
  type Room,
  type WorkEnv,
  type WorkMethod,
  type Screen,
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
import { MoveDateCalendar, type CalendarBooking } from "./MoveDateCalendar";
import {
  DEFAULT_SIZE_PRESETS,
  resolvePreset,
  type PresetRoom,
  type SizePresets,
} from "@/lib/size-presets";
import { getSizePresets } from "@/lib/size-presets.functions";

import { toast } from "sonner";
import { tap } from "@/lib/feedback";
import { KakaoMap } from "./KakaoMap";
import { searchAddress, getRoute, type KakaoPlace } from "@/lib/kakao.functions";
import { recognizeItems, type DetectedItem } from "@/lib/ai.functions";
import { parseVoice, type ItemMatch } from "@/lib/voice-parse";
import { mergeTranscript } from "@/lib/voice-fields";
import { WavRecorder } from "@/lib/recorder";
import { sendSmsViaEdge, resendManagerNotice, type EdgeSmsResult } from "@/lib/sms.edge";
import { hasSession, signIn, signOut } from "@/lib/auth";
import { setRememberMe } from "@/integrations/supabase/auth-persistence";
import { AuthField, AuthInput, AuthPrimaryButton, AuthShell } from "./AuthUi";
import { Button } from "@/components/ui/button";
import { createStaffShare, markStaffShareShared } from "@/lib/staff-share.functions";
import {
  shareToKakao,
  loadKakaoShareSdk,
  maskName,
  areaOf,
  buildStaffKakaoLines,
  type StaffSheetSnapshot,
} from "@/lib/staff-share";

import { SmsConnectionCard } from "./SmsConnectionCard";
import { SmsNoticeCard } from "./SmsNoticeCard";
import { DepositPanel } from "./DepositPanel";
import { PaymentPanel } from "./PaymentPanel";
import { ReminderPanel } from "./ReminderPanel";

import {
  TERMS_VERSION,
  TERMS_NAME,
  TERMS_EFFECTIVE_AT,
  TERMS_SOURCE,
  TERMS_SUMMARY,
  TERMS_FULL,
  TERMS_NOTICE,
} from "@/lib/terms";
import {
  publishEstimateTerms,
  getTermsStatuses,
  getReservationCounts,
  cancelReservation,
  getReservationSheet,
  renameReservationCustomer,
  getReservationCustomerName,
  getManagerNotices,
  ownerConfirmContract,
  type TermsStatusRow,
  type ManagerNoticeRow,
} from "@/lib/terms.functions";
import { getCompanyDefaults, saveCompanyDefaults } from "@/lib/company-defaults.functions";
import { saveEstimateDraft } from "@/lib/draft-sync.functions";
import {
  getFavoriteItems,
  saveFavoriteItems,
  FAVORITE_LIMIT,
} from "@/lib/favorite-items.functions";
import {
  uploadCert,
  certSignedUrl,
  removeCert,
  validateCertFile,
  formatBusinessNumber,
  isValidBusinessNumber,
} from "@/lib/business-cert";

/** 음성인식 정확도를 올려 주는 힌트 (자주 쓰는 이사 품목·공간 이름) */
const VOICE_HINT =
  "이사 견적 품목: 냉장고, 김치냉장고, 세탁기, 건조기, 스타일러, TV, 에어컨, 공기청정기, 정수기, 전자레인지, 에어프라이어, 식기세척기, 침대, 매트리스, 장롱, 붙박이장, 화장대, 서랍장, 소파, TV장, 식탁, 의자, 책상, 책장, 신발장, 빨래건조대, 청소기, 로봇청소기, 안마의자, 러닝머신, 피아노, 금고, 어항, 옷박스, 대박스, 중박스, 바구니, 이불백. 공간: 안방, 작은방, 입구방, 거실, 부엌, 베란다.";

/*
 * 참고 — 서버 음성인식(src/lib/stt.functions.ts 의 transcribeAudio)은 그대로 있습니다.
 * 다만 브라우저 음성인식과 녹음기(getUserMedia)를 동시에 켜면 마이크를 서로 뺏겨
 * 아무 것도 인식되지 않습니다. 그래서 한 번 누를 때는 브라우저 음성인식만 씁니다.
 */
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
import charC from "@/assets/jimpick-char-c.png";
import logoImg from "@/assets/jimpick-logo.png";
import { Art3D, ItemArt, ROOM_IMG, VEHICLE_IMG, CHAR_IMG, ENV_IMG } from "@/lib/jimpick-art";
import { TruckGauge } from "./TruckGauge";
import { JimpickCharacter } from "./JimpickCharacter";
import { tileDataUrl, photoQuality } from "@/lib/media";

import {
  icon3dFor,
  DEFAULT_ICON3D,
  ICON3D,
  Icon3D,
  registerCustomIcons,
} from "@/lib/jimpick-icon3d";
import {
  deactivateItemIcon,
  generateItemIcon,
  findItemIcon,
  cleanItemName,
  normItemName,
  updateItemIcon,
  type IconResult,
} from "@/lib/item-icon.functions";
import { itemSubgroup, sortByGroup, itemSubRank } from "@/lib/item-groups";
import { ITEM_KINDS, kindOf, guessKind } from "@/lib/item-kinds";
import { shrinkPhoto } from "@/lib/photo-shrink";
import { useExperimentalFeatures } from "@/lib/use-experimental-features";
import { ExperimentalFeatureSettings } from "./admin";

/** 공간별 품목 접기·펼치기 상태를 기억하는 자리 */
const ROOM_OPEN_KEY = "jimpick_step6_open_rooms";
import { EstimateSheet, type SheetRoom } from "./EstimateSheet";
import { printSheet } from "@/lib/sheet-export";
import { ScanMascot, type MascotState } from "./ScanMascot";
import { buildEstimateMessage, isSendablePhone, smsHref, hasSmsApp } from "@/lib/sms";
import { checkSendable, type MissingField } from "@/lib/send-check";
import { useEntitlement, TRIAL_EXPIRED_MESSAGE } from "@/lib/use-entitlement";

import {
  FileText,
  Camera as CamIcon,
  MapPin,
  Sparkles,
  UserCircle,
  Hand,
  Calculator,
  Box,
  Sofa,
} from "lucide-react";
import houseImg from "@/assets/step6-house.png";

/** 이름이 비슷한 품목은 기존 소분류가 달라도 한 제목 아래 연속 배치합니다. */
const ITEM_FAMILIES: { match: RegExp; label: string; rank: number }[] = [
  // 「화분받침대」처럼 침대가 아닌 물건은 침대 묶음에 들어오지 않게 합니다
  { match: /화분|식물|받침대/, label: "생활·기타", rank: 80 },
  { match: /침대|매트리스|토퍼|헤드보드|평상/, label: "침대·매트리스", rank: 10 },
  { match: /옷장|장롱|붙박이장|행거|드레스룸|이불장/, label: "옷장·행거", rank: 11 },
  { match: /서랍장|드레서|체스트|협탁|화장대|경대/, label: "서랍장·화장대·협탁", rank: 12 },
  { match: /소파|리클라이너|안락의자|빈백|흔들의자/, label: "소파·안락의자", rank: 20 },
  { match: /거실테이블|소파테이블|티테이블|커피테이블|네스팅|콘솔테이블/, label: "거실 테이블", rank: 21 },
  { match: /tv장|거실장|아트월|장식장|진열장|사이드보드/i, label: "거실장·진열장", rank: 22 },
  { match: /책상|데스크/, label: "책상", rank: 30 },
  { match: /책장|선반/, label: "책장·선반", rank: 31 },
  { match: /수납장|캐비닛|정리함|수납벤치|신발장|신발 정리대/, label: "수납장", rank: 32 },
  { match: /식탁|다이닝|홈바테이블/, label: "식탁", rank: 40 },
  { match: /의자|벤치|스툴/, label: "의자", rank: 41 },
  { match: /찬장|그릇장|주방.*수납|팬트리|레인지대|전자레인지선반|주방트롤리/, label: "주방 수납", rank: 42 },
  { match: /냉장고|냉동고|와인셀러/, label: "냉장고", rank: 50 },
  { match: /세탁기|건조기|워시타워|스타일러|의류건조/, label: "세탁·의류가전", rank: 51 },
  { match: /에어컨|공기청정기|제습기|가습기|선풍기|히터|실링팬|오일히터/, label: "냉난방·공기", rank: 52 },
  { match: /tv|티비|모니터|스피커|서브우퍼|오디오|프로젝터|피아노|오르간|게임|턴테이블/i, label: "TV·영상·음향", rank: 53 },
  { match: /청소기|스팀청소/, label: "청소가전", rank: 54 },
  { match: /전자레인지|오븐|에어프라이어|가스레인지|인덕션|전기레인지|밥솥|커피|믹서|토스터|전기포트|식기세척기|정수기|제빙기|렌지후드|음식물/, label: "주방가전", rank: 55 },
];

function itemFamily(name: string, fallback: string) {
  const found = ITEM_FAMILIES.find(({ match }) => match.test(name));
  return found ?? { label: fallback || "기타", rank: 90 };
}

export function Splash() {
  const { setScreen, loggedIn, resetDraft } = useApp();
  // 음성 입력·AI 사진 인식은 아직 시험 기능이라 일반 사장님 화면에서는 감춥니다
  const { features: splashFeatures } = useExperimentalFeatures();
  const showVoiceLab = splashFeatures.isSuperAdmin && splashFeatures.voiceItemInput;
  const showVisionLab =
    splashFeatures.isSuperAdmin && (splashFeatures.aiPhotoScan || splashFeatures.aiVideoScan);
  const [typedText, setTypedText] = useState("");
  const fullText = "AI로 견적을 받아보세요!";

  /** 음성 입력 화면(AI 인식)으로 바로 이동 — 새 견적을 시작합니다 */
  const goVoiceInput = (e: ReactMouseEvent) => {
    e.stopPropagation();
    resetDraft();
    setScreen("ai");
  };

  useEffect(() => {
    let idx = 0;
    setTypedText("");
    const interval = setInterval(() => {
      idx += 1;
      setTypedText(fullText.slice(0, idx));
      if (idx >= fullText.length) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setScreen(loggedIn ? "home" : "login"), 2500);
    return () => clearTimeout(t);
  }, [setScreen, loggedIn]);

  // 기능 목록 순서: 간편한 견적 → AI 사진 인식 → 음성으로 간편 입력 →
  // 정확한 거리·시간 → 맞춤형 견적 제공 → 고객 관리 & 기록.
  // '음성으로 간편 입력'은 장식이 아니라 실제 음성 입력 화면으로 연결됩니다.
  const features: {
    icon: typeof FileText;
    label: string;
    onClick?: (e: ReactMouseEvent) => void;
    ariaLabel?: string;
  }[] = [
    { icon: FileText, label: "간편한 견적 작성" },
    { icon: Box, label: "목록에 없는 물건도 바로 추가" },
    ...(showVisionLab ? [{ icon: CamIcon, label: "AI 사진 인식" }] : []),
    ...(showVoiceLab
      ? [
          {
            icon: Mic,
            label: "음성으로 간편 입력",
            onClick: goVoiceInput,
            ariaLabel: "음성으로 간편 입력 — 눌러서 음성 입력 시작",
          },
        ]
      : []),
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
          <div className="flex items-baseline justify-center">
            <span className="text-6xl font-black text-[#25282D] tracking-tight drop-shadow-[0_4px_10px_rgba(7,81,216,0.25)]">
              JIMPICK
            </span>
          </div>
          <div className="text-lg font-bold text-[#25282D] mt-3">AI 이사 견적 앱</div>
          <div className="text-sm text-[#6B7280] mt-1">이사 견적, 더 쉽고 정확하게!</div>
        </div>
        <div className="space-y-2 w-full mt-8">
          {features.map(({ icon: Icon, label, onClick, ariaLabel }) => (
            <div
              key={label}
              onClick={onClick}
              role={onClick ? "button" : undefined}
              tabIndex={onClick ? 0 : undefined}
              aria-label={ariaLabel ?? label}
              onKeyDown={
                onClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ")
                        onClick?.(e as unknown as ReactMouseEvent);
                    }
                  : undefined
              }
              className={`group flex items-center gap-3 px-3 py-2 rounded-2xl transition-all duration-200 hover:bg-gradient-to-r hover:from-[#F3F7FF] hover:to-[#FDF2FA] hover:shadow-[0_10px_24px_-14px_rgba(121,40,202,0.55)] hover:-translate-y-[1px]${
                onClick ? " cursor-pointer" : ""
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#3578C8] shrink-0 transition-transform duration-200 group-hover:scale-125" />
              <div className="w-9 h-9 rounded-xl bg-[#F7F8F5] flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#25282D]" />
              </div>
              <span className="font-semibold text-[#25282D]">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-4 pb-1 flex flex-col items-center gap-2">
          <div className="relative flex flex-col items-center">
            {/* 말풍선 idle 애니메이션 + 타이핑 효과.
                typedText 가 비어도 문구가 사라지지 않도록 fullText 로 대체하고,
                흰 배경 위에서 잘 보이도록 진한 남색 글자를 씁니다. */}
            <div
              className="jp-bubble-float absolute -top-10 z-10 pointer-events-none"
              role="img"
              aria-label={fullText}
            >
              <div className="relative px-4 py-2 rounded-2xl bg-white/95 shadow-[0_8px_24px_-6px_rgba(7,81,216,0.35)] border border-[#3578C8]/10">
                <span
                  className="text-sm font-extrabold text-[#0B3EA8] whitespace-nowrap"
                  aria-label={fullText}
                >
                  {typedText || fullText}
                  <span className="jp-typing-cursor" />
                </span>
                {/* 말풍선 꼬리 */}
                <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-white/95 rotate-45 border-b border-r border-[#3578C8]/10" />
              </div>
            </div>

            <img
              src={charC}
              alt="JIMPICK 캐릭터"
              className="w-full max-w-[220px] jp-float jp-soft-blink [image-rendering:auto]"
            />
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setScreen(loggedIn ? "home" : "login");
            setTimeout(() => tap("click"), 0);
          }}
          className="w-full mt-2 mb-1 py-5 rounded-2xl text-white text-lg font-black tracking-tight shadow-[0_14px_30px_-10px_rgba(53,120,200,0.5)] transition-transform active:translate-y-[2px]"
          style={{ background: "linear-gradient(90deg,#3578C8 0%,#2C63A8 100%)" }}
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
  /** 아이디 저장 — 다음 접속 때 아이디 칸만 미리 채웁니다 (세션과 무관) */
  const [remember, setRemember] = useState(!!savedId);
  /**
   * 로그인 상태 유지 — 처음에는 꺼져 있습니다(공용 PC 안전).
   * 사장님이 직접 선택한 경우에만 브라우저를 닫아도 세션이 유지됩니다.
   */
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const emailError =
    id.length === 0
      ? ""
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id.trim())
        ? ""
        : "이메일 주소를 정확히 입력해 주세요.";

  /**
   * 실제 계정으로 로그인합니다.
   *
   * 예전에는 아이디만 맞으면 들어왔지만, 그러면 계정 세션이 없어서
   * 문자발송 같은 서버 기능이 「로그인이 필요합니다」로 막힙니다.
   */
  const submit = async () => {
    if (busy) return;
    setErr("");
    setShowSignup(false);
    if (!id.trim()) {
      setErr("아이디(이메일)를 입력해 주세요.");
      return;
    }
    if (emailError) {
      setErr(emailError);
      return;
    }
    if (!pw) {
      setErr("비밀번호를 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      // 로그인 직전에 세션 저장 위치를 정합니다(유지 ON=브라우저 종료 후에도 유지).
      setRememberMe(keepLoggedIn);
      const r = await signIn(id, pw);
      if (!r.ok) {
        setErr(r.error ?? "로그인하지 못했습니다.");
        setShowSignup(!!r.needSignup);
        return;
      }
      login(id, remember);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell>
      <header className="flex min-h-[190px] flex-col items-center justify-center bg-auth-primary px-4 text-auth-primary-foreground">
        <img src={logoImg} alt="JIMPICK 로고" className="size-14 object-contain" />
        <div className="mt-2 text-3xl font-black">JIMPICK</div>
        <div className="mt-1 text-sm font-medium opacity-90">AI 이사 견적</div>
      </header>
      <form
        className="flex flex-1 flex-col gap-5 px-4 py-7 sm:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        <div>
          <h1 className="text-2xl font-bold text-auth-text">JIMPICK 로그인</h1>
          <p className="mt-1 text-sm text-auth-muted">사장님 계정으로 로그인하세요.</p>
        </div>
        <AuthField id="login-email" label="아이디(이메일)" error={emailError}>
          <AuthInput
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="jimpick@example.com"
            value={id}
            onChange={(e) => setId(e.target.value)}
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "login-email-error" : undefined}
          />
        </AuthField>
        <AuthField id="login-password" label="비밀번호">
          <div className="relative">
            <AuthInput
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="비밀번호"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              aria-invalid={false}
              aria-describedby={undefined}
              className="pr-13"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              className="absolute right-1 top-1/2 size-11 -translate-y-1/2 text-auth-muted focus-visible:ring-2 focus-visible:ring-auth-primary"
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </Button>
          </div>
        </AuthField>
        <div className="grid grid-cols-1 gap-1 min-[360px]:grid-cols-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-auth-text">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-6 accent-auth-primary"
            />
            아이디 저장
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-auth-text">
            <input
              type="checkbox"
              checked={keepLoggedIn}
              onChange={(e) => setKeepLoggedIn(e.target.checked)}
              className="size-6 accent-auth-primary"
            />
            로그인 상태 유지
          </label>
        </div>
        <p className="-mt-3 text-sm text-auth-muted">
          공용 컴퓨터에서는 로그인 상태 유지를 해제해 주세요.
        </p>
        {err && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-md bg-auth-soft p-3 text-sm font-semibold text-auth-error"
          >
            {err}
          </div>
        )}
        {showSignup && (
          <div className="rounded-md bg-auth-soft p-3 text-sm text-auth-muted">
            처음이시면 아래 「업체 회원가입」으로 계정을 먼저 만들어 주세요. 계정이 있어야 견적서
            문자발송이 됩니다.
          </div>
        )}
        <AuthPrimaryButton type="submit" busy={busy}>
          {busy ? "로그인 중…" : "로그인"}
        </AuthPrimaryButton>
        <Button
          type="button"
          variant="outline"
          onClick={() => setScreen("signup")}
          className="h-12 w-full rounded-[14px] border-auth-primary bg-background text-base font-bold text-auth-primary hover:bg-auth-soft"
        >
          업체 회원가입
        </Button>
        <p className="-mt-3 text-center text-sm text-auth-muted">
          가입 후 한 달 동안 모든 기능을 무료로 체험할 수 있습니다.
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setScreen("forgot")}
          className="h-12 w-full text-base font-bold text-auth-primary underline underline-offset-4"
        >
          아이디 · 비밀번호 찾기
        </Button>
        <div className="mt-auto pt-4 text-center text-xs text-auth-muted">
          © JIMPICK · Ver 7.0.0
        </div>
      </form>
    </AuthShell>
  );
}

// ============ Home ============
export function HomeScreen() {
  const { setScreen, resetDraft, estimates, loadEstimate } = useApp();
  /** null = 아직 불러오는 중, "" = 상호명 없음/실패, 그 외 = 상호명 */
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCompanyDefaults()
      .then((res) => {
        if (cancelled) return;
        const name = res.ok ? (res.data?.companyName ?? "").trim() : "";
        setCompanyName(name);
      })
      .catch(() => {
        if (!cancelled) setCompanyName("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const greetingName =
    companyName === null ? "…" : companyName ? `${companyName} 사장님 👋` : "사장님 👋";

  const total = estimates.length;
  const done = estimates.filter((e) => e.status === "완료").length;
  const inProg = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // 아래 숫자는 모두 저장된 견적에서 바로 계산합니다 (예시 숫자를 쓰지 않습니다)
  const phoneKey = (e: (typeof estimates)[number]) =>
    (e.phone || "").replace(/[^0-9]/g, "") || `이름:${e.customerName || ""}`;
  const customerCount = new Set(estimates.filter((e) => e.customerName || e.phone).map(phoneKey))
    .size;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const newThisMonth = new Set(
    estimates
      .filter((e) => e.createdAt >= monthStart.getTime() && (e.customerName || e.phone))
      .map(phoneKey),
  ).size;
  const doneSum = estimates
    .filter((e) => e.status === "완료")
    .reduce((s, e) => s + (e.total || 0), 0);
  const recent = [...estimates].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  const { blocked, remainingText, entitlement } = useEntitlement();

  return (
    <MobileShell>
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <JimpickCharacter state="idle" size={54} className="shrink-0" />
          <div className="min-w-0">
            <div className="text-[16px] text-[#6B7280]">안녕하세요!</div>
            <div className="truncate text-xl font-bold">{greetingName}</div>
          </div>
        </div>
        <Bell className="w-6 h-6 shrink-0 text-[#25282D]" />
      </div>

      <div className="px-5 space-y-4 flex-1 pb-4">
        {entitlement?.isSuperAdmin && (
          <div className="inline-flex items-center rounded-full bg-[#E7F3EE] px-3 py-1 text-xs font-bold text-[#3E9B78]">
            JIMPICK 서비스 관리자
          </div>
        )}
        {!entitlement?.isSuperAdmin && blocked && (
          <div className="rounded-2xl border border-[#FCA5A5] bg-[#FBEAEA] p-4">
            <div className="text-sm font-bold text-[#D95C5C] break-keep">
              {TRIAL_EXPIRED_MESSAGE}
            </div>
            <div className="mt-1 text-xs text-[#7F1D1D] break-keep">
              저장된 고객·견적 기록은 그대로 볼 수 있습니다. 새 견적 작성과 문자 발송은 구독 후
              사용할 수 있습니다.
            </div>
            <button
              onClick={() => setScreen("subscription")}
              className="mt-3 w-full rounded-xl bg-[#3578C8] py-2.5 text-sm font-bold text-white"
            >
              구독하고 계속 사용하기
            </button>
          </div>
        )}
        {!blocked && entitlement?.state === "trial" && remainingText && (
          <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2.5 text-xs font-semibold text-[#25282D] break-keep">
            한 달 무료체험 · 문자 무제한 ({entitlement.freeSmsUsed}건 사용)
            <div className="mt-0.5 font-medium text-[#1D4ED8]">
              무료체험 {entitlement.trialDaysLeft}일 남음 · 문자는 체험 기간 동안 무제한
            </div>
          </div>
        )}
        {!blocked && entitlement?.state === "trial" && entitlement.canSendSms === false && (
          <div className="rounded-2xl border border-[#FCA5A5] bg-[#FBEAEA] p-4">
            <div className="text-sm font-bold text-[#D95C5C] break-keep">
              {entitlement.smsMessage}
            </div>
            <button
              onClick={() => setScreen("subscription")}
              className="mt-3 w-full rounded-xl bg-[#3578C8] py-2.5 text-sm font-bold text-white"
            >
              구독하기
            </button>
          </div>
        )}
        {entitlement?.state === "active" && (
          <div className="rounded-2xl border border-[#BFE3D3] bg-[#E7F3EE] px-4 py-2.5 text-xs font-semibold text-[#3E9B78]">
            구독 이용 중
            {entitlement.periodEnd
              ? ` · 다음 결제 예정일 ${new Date(entitlement.periodEnd).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}`
              : ""}
          </div>
        )}
        <div
          onClick={() => {
            if (blocked) {
              toast.error(TRIAL_EXPIRED_MESSAGE);
              setScreen("subscription");
              return;
            }
            resetDraft();
            setScreen("step1");
          }}
          className="rounded-2xl p-5 text-white cursor-pointer active:scale-[0.98] shadow-[0_6px_20px_rgba(15,23,42,0.10)]"
          style={{ background: "linear-gradient(135deg, #3578C8 0%, #3578C8 100%)" }}
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
              <Icon className="w-7 h-7 text-[#25282D]" />
              <span className="text-sm font-semibold text-center">{label}</span>
            </Card>
          ))}
        </div>
        {/* 견적 현황 — 저장된 견적을 그대로 셉니다 */}
        <Card className="rounded-[14px]">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList className="h-[20px] w-[20px] text-[#25282D]" strokeWidth={1.8} />
            <div className="text-[17px] font-bold">견적 현황</div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-[14px] bg-[#F7F8F5] py-3">
              <div className="text-2xl font-black text-[#25282D]">{total}</div>
              <div className="mt-0.5 text-[15px] text-[#6B7280]">총 견적</div>
            </div>
            <div className="rounded-[14px] bg-[#F7F8F5] py-3">
              <div className="text-2xl font-black text-[#25282D]">{inProg}</div>
              <div className="mt-0.5 text-[15px] text-[#6B7280]">진행 중</div>
            </div>
            <div className="rounded-[14px] bg-[#F7F8F5] py-3">
              <div className="text-2xl font-black text-[#3E9B78]">{done}</div>
              <div className="mt-0.5 text-[15px] text-[#6B7280]">완료</div>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F1F5FA]">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, background: "linear-gradient(135deg, #3578C8, #3578C8)" }}
            />
          </div>
          <div className="mt-1 text-right text-[15px] text-[#6B7280]">완료율 {pct}%</div>
        </Card>

        {/* 고객 현황 — 전화번호로 같은 고객을 한 사람으로 셉니다 */}
        <Card className="rounded-[14px]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-[20px] w-[20px] text-[#25282D]" strokeWidth={1.8} />
              <div className="text-[17px] font-bold">고객 현황</div>
            </div>
            <button
              onClick={() => setScreen("customers")}
              className="shrink-0 whitespace-nowrap text-[16px] font-bold text-[#25282D]"
            >
              전체 보기
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[14px] bg-[#F7F8F5] px-3 py-3">
              <div className="text-2xl font-black text-[#25282D]">{customerCount}</div>
              <div className="mt-0.5 text-[15px] text-[#6B7280]">등록 고객</div>
            </div>
            <div className="rounded-[14px] bg-[#F7F8F5] px-3 py-3">
              <div className="text-2xl font-black text-[#25282D]">{newThisMonth}</div>
              <div className="mt-0.5 text-[15px] text-[#6B7280]">이번 달 신규</div>
            </div>
          </div>
          <div className="mt-2 rounded-[14px] bg-[#F7F8F5] px-3 py-3">
            <div className="text-[15px] text-[#6B7280]">완료 견적 금액 합계</div>
            <div className="mt-0.5 text-xl font-black text-[#25282D]">
              {doneSum.toLocaleString()}원
            </div>
          </div>
        </Card>

        {/* 최근 작업 — 최근 저장된 견적 3건 */}
        <Card className="rounded-[14px]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HistoryIcon className="h-[20px] w-[20px] text-[#25282D]" strokeWidth={1.8} />
              <div className="text-[17px] font-bold">최근 작업</div>
            </div>
            <button
              onClick={() => setScreen("history")}
              className="shrink-0 whitespace-nowrap text-[16px] font-bold text-[#25282D]"
            >
              전체 보기
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="rounded-[14px] bg-[#F7F8F5] px-3 py-5 text-center text-[16px] text-[#6B7280]">
              아직 저장된 견적이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((e) => (
                <button
                  key={e.id}
                  onClick={() => loadEstimate(e.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-[14px] bg-[#F7F8F5] px-3 py-3 text-left active:translate-y-[1px]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[16px] font-bold">
                      {e.customerName || "이름 없음"}
                      <span className="ml-1.5 font-normal text-[#6B7280]">{e.status}</span>
                    </div>
                    <div className="truncate text-[15px] text-[#6B7280]">
                      {new Date(e.createdAt).toLocaleDateString("ko-KR")}
                      {e.toAddress ? ` · ${e.toAddress}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 whitespace-nowrap text-[16px] font-black text-[#25282D]">
                    {(e.total || 0).toLocaleString()}원
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
      <BottomNav />
    </MobileShell>
  );
}

/**
 * 고객 이름을 입력·수정했을 때, 그 견적번호로 저장된 계약·입금·안내문자 기록의
 * 고객 이름도 서버에서 같이 맞춰 줍니다. 계약이 없으면 아무 일도 하지 않습니다.
 */
function syncContractName(estimateId: string, name: string) {
  const clean = (name ?? "").trim();
  if (!estimateId || !clean) return;
  void renameReservationCustomer({ data: { estimateId, customerName: clean } }).catch(() => {
    /* 저장에 실패하면 화면 값은 그대로 두고 다음 저장 때 다시 시도합니다 */
  });
}

// ============ Step 1: Customer ============
export function Step1() {
  const {
    draft,
    updateDraft,
    setScreen,
    loadEstimate,
    openEstimate,
    estimates,
    deleteEstimate,
    applyCustomerName,
  } = useApp();
  const [err, setErr] = useState("");
  /** 날짜별 확정 예약 건수 — 실제 예약 데이터(estimate_terms)에서 집계해 달력에 표시 */
  const [bookingCounts, setBookingCounts] = useState<Record<string, number>>({});
  const [bookings, setBookings] = useState<Record<string, CalendarBooking[]>>({});
  const loadBookings = useCallback(() => {
    getReservationCounts()
      .then((r) => {
        if (!r?.ok) return;
        setBookingCounts(r.counts);
        setBookings(
          Object.fromEntries(
            Object.entries(r.reservations ?? {}).map(([d, list]) => [
              d,
              list.map((b) => ({
                estimateId: b.estimateId,
                termsId: b.termsId,
                customerName: b.customerName,
                total: b.total,
                sheetNo: b.sheetNo,
                confirmedBy: b.confirmedBy,
                moveTime: b.moveTime,
                fromArea: b.fromArea,
                toArea: b.toArea,
                moveType: b.moveType,
                truck: b.truck,
                staffName: b.staffName,
              })),
            ]),
          ),
        );
      })
      .catch(() => {
        /* 못 읽으면 표시만 비웁니다(가짜 숫자를 만들지 않습니다) */
      });
  }, []);
  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const moveTypes: MoveType[] = ["포장이사", "반포장이사", "일반이사", "보관이사", "사무실이사"];
  const next = () => {
    if (!draft.customerName.trim()) return setErr("고객명을 입력해 주세요.");
    if (!draft.phone.trim()) return setErr("연락처를 입력해 주세요.");
    setScreen("step2");
  };
  const swipe = useSwipeNav(() => setScreen("home"), next);
  return (
    <MobileShell className="jp-estimate-flow jp-tone-1">
      <TopBar title="1단계. 고객 정보 입력" onBack={() => setScreen("home")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto pb-24" {...swipe}>
        <Field label="고객명" labelClassName="text-[#2DD4BF]">
          <TextInput
            placeholder="홍길동"
            value={draft.customerName}
            onChange={(e) => updateDraft({ customerName: e.target.value })}
            onBlur={(e) => syncContractName(draft.id, e.target.value)}
          />
        </Field>
        <Field label="연락처" labelClassName="text-[#2DD4BF]">
          <TextInput
            placeholder="010-0000-0000"
            value={draft.phone}
            onChange={(e) => updateDraft({ phone: formatPhone(e.target.value) })}
            inputMode="numeric"
          />
        </Field>
        <Field label="이사 종류" labelClassName="text-[#2DD4BF]">
          <div className="grid grid-cols-2 gap-2">
            {moveTypes.map((t) => {
              // 보관이사는 다른 이사 종류와 '함께' 선택되는 보관 서비스 토글입니다.
              const isStorage = t === "보관이사";
              const selected = isStorage ? usesStorage(draft) : draft.moveType === t;
              return (
                <Card
                  key={t}
                  selected={selected}
                  onClick={() => {
                    if (isStorage) {
                      // 켜고 끄기 — moveType 자체가 보관이사면 끌 때 기본 종류로 되돌립니다.
                      if (usesStorage(draft)) {
                        updateDraft(
                          draft.moveType === "보관이사"
                            ? { storageEnabled: false, moveType: "일반이사" }
                            : { storageEnabled: false },
                        );
                      } else {
                        updateDraft({ storageEnabled: true });
                      }
                    } else {
                      // 기본 이사 종류 선택 — 기존에 보관이사였으면 보관 서비스는 유지합니다.
                      updateDraft({
                        moveType: t,
                        storageEnabled: draft.storageEnabled || draft.moveType === "보관이사",
                      });
                    }
                  }}
                  className="text-center py-3"
                >
                  <div className="text-[17px] font-black text-[#25282D]">{t}</div>
                </Card>
              );
            })}
          </div>
        </Field>
        <Field label="이사 날짜" labelClassName="text-[#2DD4BF]">
          <MoveDateCalendar
            value={draft.moveDate}
            counts={bookingCounts}
            bookings={bookings}
            onOpenBooking={(estimateId, customerName, termsId) => {
              // 정확히 그 견적번호(estimateId)의 견적만 엽니다 → 다른 고객 견적서가 열리지 않습니다.
              const confirmedName = customerName.trim();
              const saved = estimates.find((e) => e.id === estimateId);
              if (saved) {
                loadEstimate(estimateId);
                // 계약에 저장된 실제 고객 이름을 견적서(작성본 + 저장된 목록)에 반영합니다.
                if (confirmedName) applyCustomerName(estimateId, confirmedName);
                // 서버의 최신 이름을 다시 확인합니다(나중에 이름을 바꿔도 최신값 표시).
                getReservationCustomerName({ data: { estimateId } })
                  .then((r) => {
                    if (r?.ok && r.customerName) applyCustomerName(estimateId, r.customerName);
                  })
                  .catch(() => {
                    /* 못 읽으면 저장된 값을 그대로 둡니다(임의로 덮어쓰지 않습니다) */
                  });
                return;
              }
              // 이 기기에 없으면 서버(계약 스냅샷)에서 실제 이름과 함께 불러와 엽니다.
              getReservationSheet({ data: { termsId } })
                .then((r) => {
                  if (r?.ok && r.estimateJson) {
                    try {
                      openEstimate(JSON.parse(r.estimateJson) as Estimate);
                    } catch {
                      toast.error("견적서를 불러오지 못했습니다.");
                    }
                  } else {
                    toast.error(r?.error || "견적서를 불러오지 못했습니다.");
                  }
                })
                .catch(() => toast.error("견적서를 불러오지 못했습니다."));
            }}
            onCancelBooking={(_termsId, estimateId) => {
              // 달력에서 지우면 견적 내역도 함께 삭제됩니다(서버에서 한 번에 처리).
              contractDelete.ask(estimateId);
            }}
            onSelect={(date) =>
              updateDraft({
                moveDate: date,
                storageStart:
                  !draft.storageStart || draft.storageStart === draft.moveDate
                    ? date
                    : draft.storageStart,
              })
            }
          />
        </Field>

        <Field label="시작 시간" labelClassName="text-[#2DD4BF]">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={draft.moveTime.split(" ")[0]}
              onChange={(e) =>
                updateDraft({
                  moveTime: `${e.target.value} ${draft.moveTime.split(" ")[1] || "09:00"}`,
                })
              }
              className="px-4 py-3 rounded-xl border border-[#E5E7EB] bg-white text-[18px] font-bold text-[#25282D]"
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
              className="px-4 py-3 rounded-xl border border-[#E5E7EB] bg-white text-[18px] font-bold text-[#25282D]"
            >
              {Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(2, "0")}:00`).map(
                (h) => (
                  <option key={h}>{h}</option>
                ),
              )}
            </select>
          </div>
        </Field>
        <Field label="고객 메모" labelClassName="text-[#2DD4BF]">
          <textarea
            value={draft.memo}
            onChange={(e) => updateDraft({ memo: e.target.value })}
            placeholder="예) 엘리베이터 예약 필요, 반려동물 있음, 오전 도착 희망 등"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-gradient-to-b from-[#F8FAFD] to-white text-[18px] font-semibold text-[#25282D] placeholder:text-[#7C899D] shadow-[inset_0_2px_4px_rgba(15,23,42,0.06)] focus:outline-none focus:border-[#3578C8] resize-none"
          />
        </Field>
        {err && <div className="text-sm text-[#D95C5C]">{err}</div>}
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
      <div className="text-[18px] font-black text-[#3E9B78]">{label}</div>
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
          style={{ background: "linear-gradient(135deg, #3578C8, #3578C8)" }}
        >
          <Search className="w-5 h-5" />
        </button>
      </div>
      {open && (
        <div className="border border-[#E5E7EB] rounded-xl max-h-52 overflow-auto bg-white">
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
                className="w-full text-left px-4 py-3 hover:bg-[#F7F8F5] text-sm border-b last:border-b-0 border-[#E5E7EB]"
              >
                <div className="text-[17px] font-black text-[#25282D]">{a.name}</div>
                <div className="mt-0.5 text-[15px] font-semibold text-[#6B7280]">
                  {a.roadAddress || a.address}
                </div>
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
          className="w-full text-sm font-semibold rounded-xl py-2.5 border border-[#3578C8] text-[#25282D] bg-white"
        >
          검색이 안 되면: 입력한 주소 그대로 사용
        </button>
      )}
      {value && (
        <div className="rounded-xl bg-[#F7F8F5] p-3 text-[17px] font-bold text-[#25282D]">
          {value}
        </div>
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

  const swipe = useSwipeNav(
    () => setScreen("step1"),
    hasBoth ? () => setScreen("step3") : undefined,
  );
  return (
    <MobileShell className="jp-estimate-flow jp-tone-2">
      <TopBar title="2단계. 주소 검색" onBack={() => setScreen("step1")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto pb-24" {...swipe}>
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
                <div className="text-xs font-semibold text-[#D95C5C] leading-relaxed">
                  {routeError}
                </div>
                <button
                  onClick={() => {
                    tap("click");
                    setTick((t) => t + 1);
                  }}
                  className="px-4 min-h-12 rounded-xl bg-[#3578C8] text-white text-sm font-bold transition-transform active:scale-[0.97]"
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

/**
 * 손가락으로 좌우로 밀면 이전/다음 단계로 넘어갑니다.
 *  · 오른쪽으로 밀기 → 이전(onPrev), 왼쪽으로 밀기 → 다음(onNext)
 *  · 가로로 70px 이상 + 세로 움직임보다 가로가 확실히 클 때만 반응(세로 스크롤·버튼 탭과 충돌 방지)
 */
function useSwipeNav(onPrev?: () => void, onNext?: () => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    },
    onPointerUp: (e: ReactPointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Date.now() - s.t > 800) return; // 너무 느린 드래그(스크롤 등)는 무시
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) onNext?.();
      else onPrev?.();
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}

// ============ Step 3: Work condition ============
/**
 * 층수 입력 — 직접 입력 + 「−/+」 버튼(길게 누르면 연속으로 오르내림).
 * 1~100 정수만 저장합니다.
 */
function FloorStepper({
  value,
  onChange,
  label,
  min = 1,
  max = 100,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  min?: number;
  max?: number;
}) {
  const timers = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval> }>(
    {},
  );
  const valueRef = useRef(value);
  valueRef.current = value;
  const clear = () => {
    if (timers.current.t) clearTimeout(timers.current.t);
    if (timers.current.i) clearInterval(timers.current.i);
    timers.current = {};
  };
  useEffect(() => clear, []);
  const step = (dir: 1 | -1) => {
    const next =
      dir === 1 ? Math.min(max, valueRef.current + 1) : Math.max(min, valueRef.current - 1);
    if (next === valueRef.current) return;
    valueRef.current = next;
    onChange(next);
  };
  const hold = (dir: 1 | -1) => {
    tap("soft");
    step(dir);
    clear();
    // 길게 누르면 계속 오르내립니다
    timers.current.t = setTimeout(() => {
      timers.current.i = setInterval(() => step(dir), 80);
    }, 400);
  };
  return (
    <div className="flex items-center gap-2 select-none">
      <button
        onPointerDown={() => hold(-1)}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        className="w-10 h-10 rounded-full bg-gradient-to-b from-white to-[#F7F8F5] border border-[#E5E7EB] shadow-[0_3px_0_#E5E7EB] flex items-center justify-center active:translate-y-[2px] touch-none"
        aria-label={`${label} 감소`}
      >
        <Minus className="w-5 h-5 text-[#6B7280]" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.min(max, Math.max(min, Math.floor(n))));
        }}
        className="w-16 text-center text-xl font-bold tabular-nums rounded-xl border border-[#E5E7EB] py-1.5"
        aria-label={label}
      />
      <button
        onPointerDown={() => hold(1)}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-[0_3px_0_#285C99] active:translate-y-[2px] touch-none"
        style={{ background: "linear-gradient(180deg, #5B93D6 0%, #3578C8 100%)" }}
        aria-label={`${label} 증가`}
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}

export function Step3() {
  const { draft, updateDraft, setScreen } = useApp();
  const ladderUnit = getPricing().ladder;

  /** 출발지/도착지 작업 방식(계단·엘리베이터)을 각각 독립적으로 설정합니다. 한쪽을 바꿔도 반대편은 그대로 둡니다. */
  // 공용 workEnv(구 데이터 호환·다른 화면 표시용) 계산
  const combineEnv = (f?: WorkMethod, t?: WorkMethod): WorkEnv => {
    const stair = f === "계단" || t === "계단";
    const elev = f === "엘리베이터" || t === "엘리베이터";
    return stair && elev ? "계단+엘리베이터" : stair ? "계단" : elev ? "엘리베이터" : "없음";
  };
  const setSideEnv = (side: "from" | "to", method: WorkMethod) => {
    tap("soft");
    // 계단·엘리베이터를 고르면 그 장소의 사다리차는 해제(계단/엘리베이터/사다리차 중 하나만).
    if (side === "from") {
      updateDraft({
        fromEnv: method,
        workEnv: combineEnv(method, draft.toEnv),
        ladderFrom: false,
        ladderFromPrice: 0,
        ladder: draft.ladderTo ? 1 : 0,
        ladderPrice: draft.ladderToPrice,
      });
    } else {
      updateDraft({
        toEnv: method,
        workEnv: combineEnv(draft.fromEnv, method),
        ladderTo: false,
        ladderToPrice: 0,
        ladder: draft.ladderFrom ? 1 : 0,
        ladderPrice: draft.ladderFromPrice,
      });
    }
  };

  /** 층수 입력 — 1~100 정수만 저장(빈값·소수·범위 밖은 저장하지 않음). 출발지·도착지 독립. */
  const setSideFloor = (side: "from" | "to", raw: number) => {
    if (!Number.isFinite(raw)) return;
    const n = Math.min(100, Math.max(1, Math.floor(raw)));
    updateDraft(side === "from" ? { fromFloor: n } : { toFloor: n });
  };

  /** 출발지/도착지 사다리차 사용 — 각각 독립(4단계 차량 화면과 같은 필드를 씁니다). */
  const toggleSideLadder = (side: "from" | "to") => {
    tap("soft");
    if (side === "from") {
      const on = !draft.ladderFrom;
      const price = on ? draft.ladderFromPrice || ladderUnit : 0;
      updateDraft({
        ladderFrom: on,
        ladderFromPrice: price,
        ladder: (on ? 1 : 0) + (draft.ladderTo ? 1 : 0),
        ladderPrice: price + draft.ladderToPrice,
        // 사다리차를 켜면 그 장소의 계단/엘리베이터 선택 해제(셋 중 하나만).
        ...(on ? { fromEnv: undefined, workEnv: combineEnv(undefined, draft.toEnv) } : {}),
      });
    } else {
      const on = !draft.ladderTo;
      const price = on ? draft.ladderToPrice || ladderUnit : 0;
      updateDraft({
        ladderTo: on,
        ladderToPrice: price,
        ladder: (draft.ladderFrom ? 1 : 0) + (on ? 1 : 0),
        ladderPrice: draft.ladderFromPrice + price,
        ...(on ? { toEnv: undefined, workEnv: combineEnv(draft.fromEnv, undefined) } : {}),
      });
    }
  };
  const swipe = useSwipeNav(
    () => setScreen("step2"),
    () => setScreen("step4"),
  );
  return (
    <MobileShell className="jp-estimate-flow jp-tone-3">
      <TopBar title="3단계. 작업 조건" onBack={() => setScreen("step2")} />
      <div className="p-5 space-y-5 flex-1 overflow-auto pb-24" {...swipe}>
        {(["from", "to"] as const).map((side) => {
          const isFrom = side === "from";
          const place = isFrom ? "출발지" : "도착지";
          const env = isFrom ? draft.fromEnv : draft.toEnv;
          const floor = isFrom ? draft.fromFloor : draft.toFloor;
          const ladderOn = isFrom ? !!draft.ladderFrom : !!draft.ladderTo;
          return (
            <div
              key={side}
              className={isFrom ? "" : "mt-7 border-t-2 border-dashed border-[#D7DEEB] pt-7"}
            >
              <Field label={`${place} 작업 조건`}>
                <div className="grid grid-cols-2 gap-3">
                  <Card
                    selected={env === "계단"}
                    onClick={() => setSideEnv(side, "계단")}
                    className="text-center py-5"
                  >
                    <Art3D src={ENV_IMG["계단"]} alt="계단" size={56} className="mx-auto mb-2" />
                    <div className="text-[17px] font-black text-[#25282D]">계단 (수작업)</div>
                  </Card>
                  <Card
                    selected={env === "엘리베이터"}
                    onClick={() => setSideEnv(side, "엘리베이터")}
                    className="text-center py-5"
                  >
                    <Art3D
                      src={ENV_IMG["엘리베이터"]}
                      alt="엘리베이터"
                      size={56}
                      className="mx-auto mb-2"
                    />
                    <div className="text-[17px] font-black text-[#25282D]">엘리베이터</div>
                  </Card>
                </div>
                {!env && !ladderOn && (
                  <div className="mt-2 text-[13px] font-semibold text-[#D95C5C]">
                    {place} 작업 방식을 선택해 주세요 (계단 / 엘리베이터)
                  </div>
                )}
                <div className="h-3" />
                <Card selected={ladderOn} onClick={() => toggleSideLadder(side)}>
                  <div className="flex items-center gap-3">
                    <Art3D src={VEHICLE_IMG.ladder} alt="사다리차" size={48} />
                    <div className="flex-1">
                      <div className="text-[17px] font-black text-[#25282D]">
                        {place} 사다리차 사용
                      </div>
                      <div className="text-[14px] font-semibold text-[#6B7280]">
                        필요하면 눌러서 선택하세요
                      </div>
                    </div>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        ladderOn ? "bg-[#3578C8] text-white" : "border-2 border-[#E5E7EB]"
                      }`}
                    >
                      {ladderOn && <Check className="w-4 h-4" />}
                    </div>
                  </div>
                </Card>
                <div className="h-3" />
                <Card>
                  <div className="flex items-center justify-between">
                    <div className="text-[17px] font-black text-[#25282D]">{place} 층수</div>
                    <FloorStepper
                      value={floor}
                      onChange={(n) => setSideFloor(side, n)}
                      label={`${place} 층수`}
                    />
                  </div>
                </Card>
              </Field>
            </div>
          );
        })}
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
  const { features } = useExperimentalFeatures();
  const ladderUnit = getPricing().ladder;
  const goNext = () => {
    const first = draft.rooms[0];
    if (first) setCurrentRoom(first.id);
    const canTestAi =
      features.isSuperAdmin &&
      (features.voiceItemInput || features.aiPhotoScan || features.aiVideoScan);
    setScreen(canTestAi ? "ai" : "step6");
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
  const swipe = useSwipeNav(() => setScreen("step3"), goNext);
  return (
    <MobileShell className="jp-estimate-flow jp-tone-4">
      <TopBar title="4단계. 차량 선택" onBack={() => setScreen("step3")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto pb-24" {...swipe}>
        {vehicles.map((v) => (
          <Card key={v.key} selected={v.val > 0}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Art3D src={v.img} alt={v.name} size={72} />

                <div>
                  <div className="text-[19px] font-black text-[#25282D]">{v.name}</div>
                  <div className="text-[14px] font-bold text-[#6B7280]">최대 {v.max}대</div>
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
              <div className="text-[19px] font-black text-[#25282D]">사다리차 사용 위치</div>
              <div className="text-[14px] font-bold text-[#6B7280]">출발지·도착지를 선택하세요</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 px-3 py-3 rounded-xl border border-[#E5E7EB] bg-white font-semibold text-sm">
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
            <label className="flex items-center gap-2 px-3 py-3 rounded-xl border border-[#E5E7EB] bg-white font-semibold text-sm">
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
                <label className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#25282D]">
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
                <label className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#25282D]">
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
              <span className="text-[#25282D]">
                {won(draft.ladderFromPrice + draft.ladderToPrice)}
              </span>
            </div>
          </div>
        </Card>
        {/* 사다리차와 작업 인원 사이 간격 넓히기 */}
        <div aria-hidden className="h-6" />
        <Field label="작업 인원">
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Art3D src={CHAR_IMG.male} alt="남자 작업자" size={56} />
                <div>
                  <div className="text-[17px] font-black text-[#25282D]">남자 작업자</div>
                  <div className="text-[14px] font-bold text-[#6B7280]">0~10명</div>
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
                  <div className="text-[17px] font-black text-[#25282D]">주방 이모</div>
                  <div className="text-[14px] font-bold text-[#6B7280]">0~5명</div>
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
        <PrimaryButton onClick={goNext}>다음: 공간별 품목</PrimaryButton>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ Step 6: Items ============
/** 평수별 집 구조(구획) */
export const SIZE_TABS: { key: string; rooms: string[] }[] = [
  { key: "5~10평", rooms: ["안방", "부엌", "베란다"] },
  { key: "10~20평", rooms: ["안방", "거실", "부엌", "베란다"] },
  { key: "20~30평", rooms: ["안방", "작은방", "거실", "부엌", "베란다"] },
  { key: "30~40평", rooms: ["안방", "작은방", "입구방", "거실", "부엌", "베란다"] },
  { key: "40~50평", rooms: ["안방", "작은방", "입구방", "거실", "부엌", "베란다", "옷방"] },
  { key: "50~60평", rooms: ["안방", "작은방", "입구방", "거실", "부엌", "베란다", "옷방", "서재"] },
];

/** 평수를 못 찾았을 때 쓰는 기본 구간 */
const DEFAULT_SIZE_TAB = SIZE_TABS.find((t) => t.key === "30~40평") ?? SIZE_TABS[0];

export const ROOM_TINT: Record<string, string> = {
  안방: "from-[#5B93D6] to-[#3578C8]",
  작은방: "from-[#5FD08A] to-[#2F9E44]",
  입구방: "from-[#A78BFA] to-[#7C3AED]",
  거실: "from-[#F472B6] to-[#DB2777]",
  부엌: "from-[#FBBF24] to-[#D97706]",
  베란다: "from-[#38BDF8] to-[#0284C7]",
  옷방: "from-[#60A5FA] to-[#2563EB]",
  서재: "from-[#94A3B8] to-[#6B7280]",
};

/** 번호 마지막 4자리 (발송 결과에 가려서 보여 줍니다) */
function digitsTail(phone: string): string {
  const n = (phone || "").replace(/[^0-9]/g, "");
  return n.slice(-4) || "----";
}

/**
 * 아이콘 고르기 후보.
 * 이름으로 추천한 아이콘을 맨 앞에 두고, 그 뒤로 자주 쓰는 아이콘을 붙입니다.
 */
function iconChoices(name: string): string[] {
  const first = name.trim() ? icon3dFor(undefined, name) : DEFAULT_ICON3D;
  const rest = Object.values(ICON3D);
  return [...new Set([first, DEFAULT_ICON3D, ...rest])].slice(0, 60);
}

export function Step6() {
  const {
    draft,
    updateDraft,
    setScreen,
    setCurrentRoom,
    estimates,
    catalogHidden,
    hideCatalogItem,
  } = useApp();
  const [size, setSize] = useState<string>(() => {
    if (draft.sizeTab) return draft.sizeTab;
    const n = draft.rooms.length;
    const hit = SIZE_TABS.find((t) => t.rooms.length === n);
    return hit ? hit.key : "30~40평";
  });
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const [tab, setTab] = useState<string>(CATS5[0]);
  const [q, setQ] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  /** 직접 품목 선택 중 위로 드래그하면 담은 품목 영역을 접어 목록을 넓게 봅니다 */
  const [pickedCollapsed, setPickedCollapsed] = useState(false);
  const grabberY = useRef<number | null>(null);
  /** 수량을 0으로 줄일 때 뜨는 삭제 확인창 */
  const [confirmRemove, setConfirmRemove] = useState<{
    id: string;
    name: string;
    room?: string;
  } | null>(null);
  /** 품목을 다른 공간으로 옮기는 창 */
  const [moveItem, setMoveItem] = useState<{
    id: string;
    name: string;
    qty: number;
    room?: string;
  } | null>(null);

  /**
   * 공간별 담은 품목 접기·펼치기.
   * 접어도 담은 품목·수량은 그대로 남고, 화면을 나갔다 와도 상태가 유지됩니다.
   */
  const [openRooms, setOpenRooms] = useState<string[] | null>(null);
  useEffect(() => {
    let saved: string[] | null = null;
    try {
      const raw = localStorage.getItem(ROOM_OPEN_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) saved = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      /* 저장값을 읽지 못하면 품목이 있는 공간을 펼칩니다 */
    }
    setOpenRooms(
      saved ??
        draft.rooms.filter((r) => Object.keys(r.items).length > 0).map((r) => r.name),
    );
    // 처음 들어올 때 한 번만 정합니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 특정 공간의 품목 수량을 바꿉니다 (다른 공간·품목은 건드리지 않습니다) */
  const setQtyInRoom = (roomName: string, itemId: string, qty: number) => {
    tap("soft");
    updateDraft({
      rooms: draft.rooms.map((r) => {
        if (r.name !== roomName) return r;
        const items = { ...r.items };
        if (qty <= 0) delete items[itemId];
        else items[itemId] = qty;
        return { ...r, items };
      }),
    });
  };

  /** 수량 1에서 더 줄이면 바로 지우지 않고 삭제 확인창을 띄웁니다 */
  const decQtyInRoom = (roomName: string, itemId: string, itemName: string, qty: number) => {
    if (qty <= 1) {
      tap("soft");
      setConfirmRemove({ id: itemId, name: itemName, room: roomName });
      return;
    }
    setQtyInRoom(roomName, itemId, qty - 1);
  };


  /** 사장님이 설정에서 고친 평수별 기본품목 (없으면 기본값) */
  const [ownerPresets, setOwnerPresets] = useState<SizePresets>({});
  useEffect(() => {
    let alive = true;
    getSizePresets()
      .then((r) => {
        if (alive && r.ok) setOwnerPresets(r.presets);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const presetRooms: PresetRoom[] = useMemo(
    () => ownerPresets[size] ?? DEFAULT_SIZE_PRESETS[size] ?? [],
    [ownerPresets, size],
  );

  const tabRooms = (SIZE_TABS.find((t) => t.key === size) || DEFAULT_SIZE_TAB).rooms;
  /** 화면에 보여 줄 공간 — 평수 구획 + 기본품목에 있는 공간 */
  const sizeRooms = useMemo(
    () => [...new Set([...tabRooms, ...presetRooms.map((r) => r.room)])],
    [tabRooms, presetRooms],
  );

  // 20카테고리 병합 목록(기존 이미지·요금 보존 + 1,000 신규) + 직접 추가 품목.
  const catalog = useMemo(
    () =>
      [
        ...BROWSE_ITEMS,
        ...(draft.customItems || []).map((c) => ({
          id: c.id,
          name: c.name,
          cat: c.cat,
          cat5: cat5For(c.cat, c.cat),
          sub: c.subgroup || itemSubgroup(c.name, c.cat),
          emoji: "📦",
          extra: c.extra,
        })),
      ].filter(
        (i) => !(draft.hiddenItems || []).includes(i.id) && !(catalogHidden || []).includes(i.id),
      ),
    [draft.customItems, draft.hiddenItems, catalogHidden],
  );

  /** 품목이 하나도 없는 카테고리 탭은 감춥니다 (박스 품목 제거 후 빈 탭 방지) */
  const visibleCats = useMemo(
    () => CATS5.filter((c) => catalog.some((i) => i.cat5 === c)),
    [catalog],
  );

  /** 화면을 좌우로 드래그하면 앞·뒤 단계로 넘어갑니다 */
  const swipe = useSwipeNav(
    () => setScreen("step4"),
    () => setScreen("options"),
  );
  /** 품목 목록에서 좌우로 드래그하면 분류 탭이 넘어갑니다 */
  const tabSwipe = useSwipeNav(
    () => {
      const i = visibleCats.indexOf(tab as (typeof visibleCats)[number]);
      if (i > 0) {
        tap("soft");
        setQ("");
        setTab(visibleCats[i - 1]);
      }
    },
    () => {
      const i = visibleCats.indexOf(tab as (typeof visibleCats)[number]);
      if (i >= 0 && i < visibleCats.length - 1) {
        tap("soft");
        setQ("");
        setTab(visibleCats[i + 1]);
      }
    },
  );

  /** 평수 변경 확인창 — stage 1: 기본 확인, stage 2: 직접 추가 품목 재확인 */
  const [sizeConfirm, setSizeConfirm] = useState<{ key: string; stage: 1 | 2 } | null>(null);
  /** 품목 목록에 없어서 담지 못한 기본품목 (품목 등록 필요) */
  const [needRegister, setNeedRegister] = useState<{ room: string; name: string; qty: number }[]>(
    [],
  );

  /** 지금 담긴 품목 개수 (평수 변경 확인창을 띄울지 판단합니다) */
  const pickedCount = draft.rooms.reduce((a, r) => a + roomSummary(r.items).count, 0);
  /** 사장님이 직접 추가한 품목이 담겨 있는지 */
  const hasCustomPicked = (draft.customItems || []).some((c) =>
    draft.rooms.some((r) => (r.items[c.id] ?? 0) > 0),
  );

  /**
   * 평수별 기본품목을 실제 품목 데이터에 넣습니다.
   * merge   기존 품목·수량은 그대로 두고 빠진 품목만 추가 (중복 생성 없음)
   * replace 기본품목 구성으로 새로 채움
   */
  const applyPreset = (key: string, mode: "merge" | "replace") => {
    const rows = ownerPresets[key] ?? DEFAULT_SIZE_PRESETS[key] ?? [];
    const resolved = resolvePreset(rows, catalog);
    const baseRooms = (SIZE_TABS.find((t) => t.key === key) || DEFAULT_SIZE_TAB).rooms;
    const names = [...new Set([...baseRooms, ...resolved.rooms.map((r) => r.room)])];

    const rooms = draft.rooms.map((r) => ({ ...r, items: { ...r.items } }));
    for (const n of names) {
      if (!rooms.some((r) => r.name === n))
        rooms.push({ id: `r_${n}`, name: n, items: {} as Record<string, number> });
    }
    if (mode === "replace") for (const r of rooms) r.items = {};
    for (const pr of resolved.rooms) {
      const t = rooms.find((r) => r.name === pr.room);
      if (!t) continue;
      for (const [id, qty] of Object.entries(pr.items)) {
        // 「현재 품목에 추가」는 이미 담긴 품목의 수량을 그대로 유지합니다
        if (mode === "merge" && t.items[id]) continue;
        t.items[id] = qty;
      }
    }

    setSize(key);
    setNeedRegister(resolved.missing);
    setSizeConfirm(null);
    updateDraft({ sizeTab: key, rooms });
    tap("success");
    toast.success(
      mode === "merge" ? `${key} 기본품목을 현재 품목에 추가했습니다` : `${key} 기본품목을 담았습니다`,
    );
  };

  /** 평수 버튼 — 담긴 품목이 있으면 먼저 확인창을 띄웁니다 */
  const pickSize = (key: string) => {
    tap("soft");
    if (pickedCount === 0) {
      applyPreset(key, "replace");
      return;
    }
    setSizeConfirm({ key, stage: 1 });
  };

  /** 전체 선택 해제 — 담긴 품목만 비우고 고객정보·주소·차량·옵션은 그대로입니다 */
  const clearAllItems = () => {
    tap("soft");
    updateDraft({ rooms: draft.rooms.map((r) => ({ ...r, items: {} as Record<string, number> })) });
    setNeedRegister([]);
    toast.success("담은 품목을 모두 비웠습니다");
  };

  /** 품목을 다른 공간으로 옮깁니다 (수량 그대로) */
  const moveItemTo = (itemId: string, qty: number, from: string, to: string) => {
    if (from === to) {
      setMoveItem(null);
      return;
    }
    const rooms = draft.rooms.map((r) => ({ ...r, items: { ...r.items } }));
    if (!rooms.some((r) => r.name === to))
      rooms.push({ id: `r_${to}`, name: to, items: {} as Record<string, number> });
    const src = rooms.find((r) => r.name === from);
    const dst = rooms.find((r) => r.name === to);
    if (!src || !dst) {
      toast.error("옮길 공간을 찾지 못했습니다");
      return;
    }
    delete src.items[itemId];
    dst.items[itemId] = (dst.items[itemId] ?? 0) + qty;
    updateDraft({ rooms });
    setMoveItem(null);
    tap("success");
    toast.success(`${to}(으)로 옮겼습니다`);
  };

  const roomOf = (name: string) => draft.rooms.find((r) => r.name === name);
  const room = openRoom ? roomOf(openRoom) : undefined;

  /**
   * 수량을 정합니다.
   * 담을 공간을 아직 고르지 않았으면 품목 이름에 어울리는 공간으로 자동 배정합니다.
   */
  const setQty = (itemId: string, qty: number, itemName?: string) => {
    let rooms = draft.rooms;
    let target = room;
    if (!target) {
      if (qty <= 0) return;
      const name =
        itemName || catalog.find((c) => c.id === itemId)?.name || itemNameById(itemId) || "";
      const pick = suggestRoomName(name, sizeRooms) || sizeRooms[0];
      if (!pick) return;
      if (!rooms.some((r) => r.name === pick))
        rooms = [...rooms, { id: `r_${pick}`, name: pick, items: {} as Record<string, number> }];
      target = rooms.find((r) => r.name === pick);
      if (!target) return;
      setOpenRoom(pick);
      setCurrentRoom(target.id);
      toast.success(`「${name || "품목"}」을(를) ${pick}에 담았습니다`);
    }
    const tid = target.id;
    const items = { ...target.items };
    if (qty <= 0) delete items[itemId];
    else items[itemId] = qty;
    // 담을 때(수량>0) 최근 선택 목록 맨 앞에 기록합니다(최신순, 중복 제거, 최대 12개).
    const recent =
      qty > 0
        ? [itemId, ...(draft.recentItems || []).filter((x) => x !== itemId)].slice(0, 12)
        : draft.recentItems;
    updateDraft({
      rooms: rooms.map((r) => (r.id === tid ? { ...r, items } : r)),
      ...(recent ? { recentItems: recent } : {}),
    });
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

  /** 품목 만들기·고치기 창 — null 이면 닫힘, id 가 있으면 고치는 중 */
  const [itemForm, setItemForm] = useState<{
    id?: string;
    name: string;
    cat: string;
    qty: number;
    icon: string;
  } | null>(null);
  /** 직접 추가한 품목의 작은 메뉴 */
  const [itemMenu, setItemMenu] = useState<string | null>(null);
  /** 전체 목록에서 삭제 확인 */
  const [confirmCatalogDel, setConfirmCatalogDel] = useState<string | null>(null);

  /** ─── 3D 품목 생성 (검색 결과에 없는 품목의 3D 아이콘 만들기) ───────── */
  /** 만들기 확인 화면 (null 이면 닫힘) */
  const [iconGen, setIconGen] = useState<{
    name: string;
    /** 품목 종류 (= 품목 그룹). 부피는 종류에 따라 자동으로 정해집니다 */
    kind: string;
    /** 담을 공간 — 지금 열어 둔 공간이 기본값입니다 */
    room: string;
    /** 현장에서 찍은 사진 (없어도 됩니다) */
    photo?: string;
    /** 같은 이름이 있어도 새로 만듭니다 (이미지 다시 만들기) */
    force?: boolean;
  } | null>(null);
  /** 품목 그룹(자리) 이동 창 */
  const [groupMove, setGroupMove] = useState<{ id: string; name: string } | null>(null);
  /** 비슷한 이름의 기존 품목이 있을 때 물어봅니다 */
  const [iconSimilar, setIconSimilar] = useState<{ id: string; name: string } | null>(null);
  const [iconBusy, setIconBusy] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);
  /** 같은 업체가 전에 만들어 둔 아이콘 (있으면 다시 만들지 않습니다) */
  const [savedIcon, setSavedIcon] = useState<IconResult | null>(null);

  const openIconGen = () => {
    const name = cleanItemName(q);
    tap("soft");
    if (!room?.name) {
      toast.error("품목을 담을 공간을 먼저 선택해 주세요.");
      return;
    }
    setIconError(null);
    setIconSimilar(null);
    setIconGen({ name, kind: name ? guessKind(name) : "기타", room: room.name });
  };


  /**
   * 만들어진(또는 저장돼 있던) 아이콘을 품목으로 담습니다.
   * 품목 등록 → 고른 공간에 수량 반영까지 모두 성공해야 null(성공)을 돌려줍니다.
   * 담긴 품목은 같은 종류(침대·서랍장·TV 등) 옆으로 자동 정렬돼 보입니다.
   */
  const applyGeneratedIcon = (
    res: IconResult,
    roomName: string,
    opts?: { qty?: number; extra?: number },
  ): string | null => {
    if (!res.itemId || !res.iconUrl) return "아이콘 주소를 받지 못했습니다.";
    const itemId = res.itemId;
    const iconUrl = res.iconUrl;
    const name = cleanItemName(res.name || "") || "이름 수정 필요";
    const cat = res.cat || guessCategory(name);
    const addQty = Math.max(0, Math.min(99, opts?.qty ?? 1));
    const extra = Math.max(0, opts?.extra ?? 0);


    // 고른 공간이 아직 없으면 그 공간을 먼저 만듭니다 (기존 공간·품목은 그대로)
    let rooms = draft.rooms;
    if (!rooms.some((r) => r.name === roomName)) {
      if (!roomName) return "담을 공간을 고르지 못했습니다. 공간을 다시 선택해 주세요.";
      rooms = [
        ...rooms,
        { id: `r_${roomName}`, name: roomName, items: {} as Record<string, number> },
      ];
    }
    const target = rooms.find((r) => r.name === roomName);
    if (!target) return "담을 공간을 찾지 못했습니다. 공간을 다시 선택해 주세요.";

    registerCustomIcons([{ id: itemId, icon: iconUrl }]);
    const list = draft.customItems || [];
    const exists = list.some((c) => c.id === itemId);
    const nextCustom = exists
      ? list.map((c) =>
          c.id === itemId
            ? { ...c, name, cat, subgroup: res.subgroup, size: res.size, extra, icon: iconUrl, active: true }
            : c,
        )
      : [...list, { id: itemId, name, cat, subgroup: res.subgroup, size: res.size, extra, icon: iconUrl, active: true }];
    const nextRooms =
      addQty <= 0
        ? rooms
        : rooms.map((r) =>
            r.id === target.id
              ? { ...r, items: { ...r.items, [itemId]: (r.items[itemId] ?? 0) + addQty } }
              : r,
          );
    // 담기 결과가 실제로 반영됐는지 확인한 뒤에만 완료로 처리합니다
    const placed = nextRooms.find((r) => r.id === target.id)?.items[itemId] ?? 0;
    if (!nextCustom.some((c) => c.id === itemId) || (addQty > 0 && placed < 1))
      return "품목을 공간에 담지 못했습니다. 다시 시도해 주세요.";


    updateDraft({
      customItems: nextCustom,
      hiddenItems: (draft.hiddenItems || []).filter((x) => x !== itemId),
      rooms: nextRooms,
      recentItems: [itemId, ...(draft.recentItems || []).filter((x) => x !== itemId)].slice(0, 12),
    });

    // 품목 목록에서 바로 보이도록 해당 분류 탭을 열고, 담긴 공간을 펼쳐 둡니다
    setTab(cat5For(cat));
    setOpenRooms((prev) => {
      const cur = prev ?? [];
      if (cur.includes(roomName)) return cur;
      const next = [...cur, roomName];
      try {
        localStorage.setItem(ROOM_OPEN_KEY, JSON.stringify(next));
      } catch {
        /* 저장 공간이 없어도 화면 표시는 그대로입니다 */
      }
      return next;
    });
    setSavedIcon(null);
    setIconGen(null);
    setIconSimilar(null);
    setQ("");
    tap("success");
    return null;
  };

  /** 기존 품목을 「추가할 공간」으로 고른 공간에 1개 더 담습니다 (중복 생성 대신) */
  const useExistingItem = (id: string, name: string) => {
    const roomName = iconGen?.room || room?.name || "";
    if (!roomName) {
      setQty(id, 1, name);
    } else {
      // 고른 공간이 목록에 없으면 먼저 만들고, 그 공간의 수량만 1개 올립니다
      let rooms = draft.rooms;
      if (!rooms.some((r) => r.name === roomName))
        rooms = [...rooms, { id: `r_${roomName}`, name: roomName, items: {} as Record<string, number> }];
      updateDraft({
        rooms: rooms.map((r) =>
          r.name === roomName ? { ...r, items: { ...r.items, [id]: (r.items[id] ?? 0) + 1 } } : r,
        ),
        recentItems: [id, ...(draft.recentItems || []).filter((x) => x !== id)].slice(0, 12),
      });
      setOpenRooms((prev) => {
        const cur = prev ?? [];
        if (cur.includes(roomName)) return cur;
        const next = [...cur, roomName];
        try {
          localStorage.setItem(ROOM_OPEN_KEY, JSON.stringify(next));
        } catch {
          /* 저장 공간이 없어도 화면 표시는 그대로입니다 */
        }
        return next;
      });
      toast.success(`「${name}」을(를) ${roomName}에 담았습니다`);
    }
    setIconGen(null);
    setIconSimilar(null);
    setQ("");
  };


  /** 「목록에 없는 품목 추가」 — 저장·이미지 생성·현재 공간 담기를 한 번에 합니다 */
  const runIconGen = async (opts?: { force?: boolean }) => {
    if (!iconGen || iconBusy) return;
    const name = cleanItemName(iconGen.name);
    if (!name) {
      setIconError("품목 이름을 입력해 주세요.");
      return;
    }
    const roomName = iconGen.room || room?.name || "";
    if (!roomName) {
      setIconError("품목을 담을 공간을 먼저 선택해 주세요.");
      return;
    }
    const normalized = normItemName(name);
    if (!opts?.force && !iconGen.force) {
      const exact = catalog.find((item) => normItemName(item.name) === normalized);
      if (exact) {
        useExistingItem(exact.id, exact.name);
        return;
      }
      const similar = catalog.find(
        (item) =>
          normItemName(item.name).includes(normalized) || normalized.includes(normItemName(item.name)),
      );
      if (similar && normalized.length >= 2) {
        setIconSimilar({ id: similar.id, name: similar.name });
        return;
      }
    }
    const kind = kindOf(iconGen.kind);
    const regen = !!(opts?.force || iconGen.force);
    setIconBusy(true);
    setIconError(null);
    setIconSimilar(null);
    try {
      const res = await generateItemIcon({
        data: {
          name,
          cat: kind.cat,
          room: roomName,
          kind: kind.label,
          volume: kind.volume,
          ...(regen ? { force: true } : {}),
          ...(iconGen.photo ? { photo: iconGen.photo } : {}),
        },
      });
      if (!res.ok || !res.iconUrl) {
        setIconError(res.error || "이미지 생성에 실패했습니다.");
        return;
      }
      // 이미 담겨 있는 품목의 그림만 다시 만든 경우에는 수량을 올리지 않습니다
      const already =
        regen && draft.rooms.some((r) => (r.items[res.itemId ?? ""] ?? 0) > 0);
      const failed = applyGeneratedIcon(res, roomName, {
        qty: already ? 0 : 1,
        extra: res.volume ?? kind.volume,
      });
      if (failed) setIconError(failed);
      else toast.success(already ? "이미지를 새로 만들었습니다." : "품목이 추가되었습니다.");

    } catch (e) {
      setIconError(e instanceof Error ? e.message : "네트워크 연결을 확인해 주세요.");
    } finally {
      setIconBusy(false);
    }
  };

  // 검색 결과가 없을 때, 전에 만들어 둔 아이콘이 있으면 먼저 보여 줍니다 (중복 생성 방지)
  const noResult = !!q.trim() && !catalog.some((i) => i.name.includes(q));
  useEffect(() => {
    if (!noResult) {
      setSavedIcon(null);
      return;
    }
    const name = cleanItemName(q);
    if (name.length < 2) {
      setSavedIcon(null);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      findItemIcon({ data: { name } })
        .then((r) => {
          if (!alive) return;
          setSavedIcon(r.ok && r.iconUrl ? r : null);
        })
        .catch(() => alive && setSavedIcon(null));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, noResult]);

  const openEditItem = (id: string) => {
    const c = (draft.customItems || []).find((x) => x.id === id);
    if (!c) return;
    tap("soft");
    setItemMenu(null);
    setItemForm({
      id,
      name: c.name,
      cat: c.cat,
      qty: room?.items[id] ?? 1,
      icon: c.icon || icon3dFor(undefined, c.name),
    });
  };

  /** 창에서 저장 — 새로 만들거나, 이름·분류·아이콘을 고칩니다 */
  const saveItemForm = async () => {
    if (!itemForm) return;
    const name = itemForm.name.trim();
    if (!name) {
      toast.error("품목 이름을 적어 주세요");
      return;
    }
    const list = draft.customItems || [];
    if (itemForm.id) {
      if (itemForm.id.startsWith("ci_ai_")) {
        const saved = await updateItemIcon({ data: { itemId: itemForm.id, name, cat: itemForm.cat } });
        if (!saved.ok) {
          toast.error(saved.error || "품목명을 저장하지 못했습니다");
          return;
        }
      }
      updateDraft({
        customItems: list.map((c) =>
          c.id === itemForm.id
            ? { ...c, name, cat: itemForm.cat, subgroup: itemSubgroup(name, itemForm.cat), icon: itemForm.icon }
            : c,
        ),
      });
      toast.success(`「${name}」을(를) 고쳤습니다`);
    }
    setQ("");
    setItemForm(null);
    tap("success");
  };

  /**
   * 전체 목록에서 지우기 — 실제로 지우지 않고 숨김 처리만 합니다.
   * 지난 견적서에 남아 있는 이름·수량은 그대로 보입니다.
   */
  const removeFromCatalog = async (id: string) => {
    const nm =
      BROWSE_ITEMS.find((x) => x.id === id)?.name ||
      (draft.customItems || []).find((x) => x.id === id)?.name ||
      itemNameById(id) ||
      "품목";
    if (id.startsWith("ci_ai_")) {
      const result = await deactivateItemIcon({ data: { itemId: id } });
      if (!result.ok) {
        toast.error(result.error || "품목을 삭제하지 못했습니다");
        return;
      }
    }
    // 앱 전체에서 숨깁니다 (지난 견적의 이름·수량은 보존)
    hideCatalogItem(id);
    updateDraft({
      hiddenItems: [...(draft.hiddenItems || []), id],
      customItems: (draft.customItems || []).map((x) =>
        x.id === id ? { ...x, active: false } : x,
      ),
      // 지금 방에 담겨 있으면 함께 빼 줍니다
      rooms: draft.rooms.map((r) => {
        if (!(id in r.items)) return r;
        const items = { ...r.items };
        delete items[id];
        return { ...r, items };
      }),
    });
    setItemMenu(null);
    tap("soft");
    toast.success(`「${nm}」을(를) 목록에서 지웠습니다`);
  };

  /**
   * 직접 만든(3D 생성) 품목을 같은 종류의 앞부분에 둡니다.
   * 최근에 만든 품목이 더 앞에 오도록 저장 순서를 뒤에서부터 셉니다.
   */
  const customOrder = useMemo(() => {
    const list = draft.customItems || [];
    const map = new Map<string, number>();
    list.forEach((c, i) => map.set(c.id, -(list.length - i)));
    return map;
  }, [draft.customItems]);
  const newFirst = (id: string) => customOrder.get(id) ?? 0;

  // 검색어가 있으면 전체에서, 없으면 현재 탭에서 보여 주고 같은 종류끼리 정렬합니다.
  const items = catalog
    .filter((i) => (q ? i.name.includes(q) : i.cat5 === tab))
    .slice()
    .sort((a, b) => {
      const af = itemFamily(a.name, a.sub || "기타");
      const bf = itemFamily(b.name, b.sub || "기타");
      return (
        af.rank - bf.rank ||
        af.label.localeCompare(bf.label, "ko") ||
        itemSubRank(a.name) - itemSubRank(b.name) ||
        // 직접 만든 3D 품목은 같은 세부 종류 안에서 맨 앞(최근 생성이 먼저)
        newFirst(a.id) - newFirst(b.id) ||
        a.name.localeCompare(b.name, "ko")
      );
    });
  /**
   * 한 공간에 담긴 품목 목록 —
   * 침대·협탁·서랍장… 처럼 같은 종류끼리 모여 보이도록 정렬해 돌려줍니다.
   */
  const pickedOf = (r: { items: Record<string, number> }) =>
    sortByGroup(
      Object.entries(r.items).map(([id, qty]) => {
        const c = catalog.find((x) => x.id === id);
        const cat = c && "cat" in c ? (c.cat as string) : undefined;
        return {
          id,
          qty,
          name: c?.name || itemNameById(id) || id,
          cat,
        };
      }),
    );
  const picked = room ? pickedOf(room) : [];
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

  /**
   * 자주 담는 품목 —
   * 사장님이 직접 등록한 목록이 있으면 그것을, 없으면 지난 견적 이력에서 뽑습니다.
   */
  const [favIds, setFavIds] = useState<string[] | null>(null);
  const [favEditOpen, setFavEditOpen] = useState(false);
  const [favDraft, setFavDraft] = useState<string[]>([]);
  const [favQuery, setFavQuery] = useState("");
  const [favSaving, setFavSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getFavoriteItems()
      .then((r) => {
        if (alive && r.ok) setFavIds(r.itemIds);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const frequent = useMemo(() => {
    const ids = favIds && favIds.length > 0 ? favIds : frequentItemIds(estimates, 8);
    return ids
      .map((id) => catalog.find((c) => c.id === id))
      .filter((i): i is (typeof catalog)[number] => !!i);
  }, [favIds, estimates, catalog]);

  const openFavEdit = () => {
    tap("soft");
    setFavDraft(favIds && favIds.length > 0 ? favIds : frequent.map((i) => i.id));
    setFavQuery("");
    setFavEditOpen(true);
  };

  const toggleFav = (id: string) => {
    setFavDraft((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= FAVORITE_LIMIT) {
        toast.error(`자주 담는 품목은 최대 ${FAVORITE_LIMIT}개까지 등록할 수 있습니다`);
        return prev;
      }
      return [...prev, id];
    });
    tap("soft");
  };

  const moveFav = (id: string, dir: -1 | 1) => {
    setFavDraft((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    tap("soft");
  };

  const saveFav = async () => {
    if (favSaving) return;
    setFavSaving(true);
    try {
      const r = await saveFavoriteItems({ data: { itemIds: favDraft } });
      if (!r.ok) {
        toast.error(r.error || "자주 담는 품목을 저장하지 못했습니다");
        return;
      }
      setFavIds(favDraft);
      setFavEditOpen(false);
      tap("success");
      toast.success("자주 담는 품목을 저장했습니다");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "자주 담는 품목을 저장하지 못했습니다");
    } finally {
      setFavSaving(false);
    }
  };

  const toggleMenuFavorite = async (itemId: string) => {
    const current = favIds ?? frequent.map((item) => item.id);
    const included = current.includes(itemId);
    if (!included && current.length >= FAVORITE_LIMIT) {
      toast.error(`자주 담는 품목은 최대 ${FAVORITE_LIMIT}개까지 등록할 수 있습니다`);
      return;
    }
    const next = included ? current.filter((id) => id !== itemId) : [...current, itemId];
    const result = await saveFavoriteItems({ data: { itemIds: next } });
    if (!result.ok) {
      toast.error(result.error || "자주 담는 품목을 저장하지 못했습니다");
      return;
    }
    setFavIds(next);
    setItemMenu(null);
    toast.success(included ? "자주 담는 품목에서 해제했습니다" : "자주 담는 품목에 등록했습니다");
  };

  return (
    <MobileShell className="jp-estimate-flow jp-tone-5">
      {/* 헤더 */}
      <div className="px-4 pt-2 pb-3 bg-white border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              tap("soft");
              setScreen("step4");
            }}
            aria-label="뒤로"
            className="shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-b from-white to-[#F7F8F5] border border-[#E5E7EB] flex items-center justify-center text-[#25282D] shadow-[0_4px_0_#E5E7EB,0_10px_18px_-10px_rgba(7,81,216,0.5),inset_0_1px_0_#fff] active:translate-y-[2px] active:shadow-[0_1px_0_#E5E7EB]"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-[20px] font-black text-[#25282D] leading-tight">
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

      {/* 평수 선택 — 예전처럼 한 줄을 좌우로 밀어서 봅니다 */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 py-3">
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SIZE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => pickSize(t.key)}
              className={`min-w-[108px] shrink-0 snap-start px-3 py-2.5 rounded-2xl text-[14px] font-black text-center whitespace-nowrap transition-all duration-150 active:translate-y-[2px] ${
                t.key === size
                  ? "text-white bg-gradient-to-b from-[#5B93D6] to-[#3578C8] shadow-[0_4px_0_#285C99,0_8px_16px_rgba(7,81,216,0.32),inset_0_1px_0_rgba(255,255,255,0.5)] active:shadow-[0_1px_0_#285C99]"
                  : "text-[#2A6FD6] bg-gradient-to-b from-white to-[#F7F8F5] shadow-[0_3px_0_#E5E7EB,inset_0_1px_0_#fff] active:shadow-[0_1px_0_#E5E7EB]"
              }`}
            >
              {t.key}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setSizeConfirm({ key: size, stage: pickedCount > 0 ? 1 : 2 })}
            className="flex-1 min-w-0 py-2.5 rounded-2xl text-[13px] font-black text-[#2A6FD6] bg-gradient-to-b from-white to-[#F7F8F5] border border-[#E5E7EB] shadow-[0_3px_0_#E5E7EB] active:translate-y-[2px]"
          >
            기본품목 다시 적용
          </button>
          <button
            onClick={clearAllItems}
            className="flex-1 min-w-0 py-2.5 rounded-2xl text-[13px] font-black text-[#B4232A] bg-white border border-[#FECACA] shadow-[0_3px_0_#FEE2E2] active:translate-y-[2px]"
          >
            전체 선택 해제
          </button>
        </div>
        {needRegister.length > 0 && (
          <div className="mt-2 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-3">
            <div className="text-[13px] font-black text-[#B45309]">
              품목 등록 필요 {needRegister.length}건
            </div>
            <div className="mt-1 text-[12px] font-bold text-[#92400E] leading-relaxed">
              {needRegister.map((m) => `${m.room} · ${m.name} ${m.qty}`).join(" / ")}
            </div>
            <div className="mt-1 text-[11px] font-semibold text-[#B45309]">
              품목 목록에 없어 담지 못했습니다. 공간을 눌러 직접 추가하거나 3D 아이콘을 만들어
              주세요.
            </div>
          </div>
        )}
      </div>

      {/* 디지털 3D 집 구조 */}
      <div
        className="flex-1 overflow-auto p-4 pb-6 bg-gradient-to-b from-[#EEF6FF] to-[#E6EEFA]"
        {...swipe}
      >
        <div className="grid grid-cols-2 gap-3">
          {sizeRooms.map((name) => {
            const r = roomOf(name);
            const s = roomSummary(r?.items || {});
            return (
              <div
                key={name}
                className="relative rounded-3xl p-3 bg-gradient-to-b from-white to-[#F7F8F5] border border-[#E5E7EB] shadow-[0_8px_0_#E5E7EB,0_16px_28px_-14px_rgba(7,81,216,0.4),inset_0_1px_0_#fff]"
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
                      ROOM_TINT[name] || "from-[#5B93D6] to-[#3578C8]"
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
                              className="relative rounded-xl bg-gradient-to-b from-white to-[#F7F8F5] border border-[#E5E7EB] p-0.5 shadow-[0_2px_0_#E5E7EB,inset_0_1px_0_#fff]"
                            >
                              <ItemArt id={id} name={nameOf(id)} size={34} />
                              {qty > 1 && (
                                <span className="absolute -top-1 -right-1 min-w-4 px-1 rounded-full bg-[#3578C8] text-white text-[9px] font-black text-center">
                                  {qty}
                                </span>
                              )}
                            </span>
                          ))}
                          {rest > 0 && (
                            <span className="self-center rounded-xl bg-[#F7F8F5] border border-[#E5E7EB] px-1.5 py-2 text-[12px] font-black text-[#25282D]">
                              +{rest}
                            </span>
                          )}
                        </div>
                        {/* 품목 이름·수량 — 두 줄까지 보여 주고 나머지는 「외 N종」 */}
                        <div className="mt-1 text-center text-[11px] font-bold text-[#5A6478] leading-snug line-clamp-2 break-keep">
                          {shownItems.map(([id, qty]) => `${nameOf(id)} ${qty}`).join(" · ")}
                        </div>
                        {rest > 0 && (
                          <div className="text-center text-[11px] font-bold text-[#8A93A6]">
                            외 {rest}종
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <div className="mt-1 text-center text-[12px] font-extrabold text-[#25282D]">
                    {s.kinds > 0 ? `${s.kinds}종 · ${s.count}개` : "품목 없음"}
                  </div>
                </button>
                {s.kinds > 0 && (
                  <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-gradient-to-b from-[#5B93D6] to-[#3578C8] text-white text-[12px] font-black flex items-center justify-center shadow-[0_3px_0_#285C99,inset_0_1px_0_rgba(255,255,255,0.5)]">
                    {s.kinds}
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
            className="absolute inset-0 bg-[#25282D]/45 backdrop-blur-[2px]"
            onClick={() => setOpenRoom(null)}
          />
          <div
            className={`relative w-full max-w-md flex flex-col rounded-t-3xl bg-gradient-to-b from-white to-[#F7F8F5] shadow-[0_-14px_40px_rgba(7,81,216,0.28)] pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
              // 품목을 고를 때는 시트를 위로 더 끌어올려 넓게 보여 줍니다
              pickerOpen && pickedCollapsed
                ? "h-[98dvh] max-h-[98dvh]"
                : pickerOpen
                  ? "h-[95dvh] max-h-[95dvh]"
                  : "max-h-[86dvh]"
            }`}
          >
            {/* 드래그 손잡이 — 위로 올리면 담은 품목이 접혀 품목 목록이 넓어집니다 */}
            {pickerOpen && (
              <div
                role="button"
                tabIndex={0}
                aria-label={pickedCollapsed ? "담은 품목 펼치기" : "담은 품목 접기"}
                onPointerDown={(e) => {
                  grabberY.current = e.clientY;
                  // 마우스로 위아래로 끌어도 pointerUp이 손잡이에 전달되도록 포인터를 붙잡습니다
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    /* 일부 환경에서는 지원하지 않아도 탭 토글은 동작합니다 */
                  }
                }}
                onPointerUp={(e) => {
                  if (grabberY.current == null) return;
                  const dy = e.clientY - grabberY.current;
                  grabberY.current = null;
                  if (Math.abs(dy) < 24) {
                    tap("soft");
                    setPickedCollapsed((v) => !v);
                  } else if (dy < 0 && !pickedCollapsed) {
                    tap("soft");
                    setPickedCollapsed(true);
                  } else if (dy > 0 && pickedCollapsed) {
                    tap("soft");
                    setPickedCollapsed(false);
                  }
                }}
                className="flex w-full shrink-0 cursor-grab touch-none justify-center pt-2 pb-1 active:cursor-grabbing"
              >
                <span className="h-1.5 w-14 rounded-full bg-[#C9D2E0]" />
              </div>
            )}
            <div className="px-4 pt-2 pb-1.5 flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-xl text-white text-[15px] font-black bg-gradient-to-b ${
                  ROOM_TINT[room.name] || "from-[#5B93D6] to-[#3578C8]"
                } shadow-[0_3px_0_rgba(0,0,0,0.18)]`}
              >
                {room.name}
              </span>
              <span className="text-[13px] font-extrabold text-[#6B7280]">
                {roomSummary(room.items).kinds}종 · {roomSummary(room.items).count}개
              </span>
              <button
                onClick={() => setOpenRoom(null)}
                className="ml-auto w-9 h-9 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center shadow-[0_3px_0_#F7F8F5]"
                aria-label="닫기"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>

            {/* 등록된 품목 뱃지 */}
            <div className="px-4 pt-1">
              {pickerOpen && pickedCollapsed ? (
                <button
                  onClick={() => {
                    tap("soft");
                    setPickedCollapsed(false);
                  }}
                  className="w-full flex items-center gap-2 rounded-2xl bg-white border border-[#E5E7EB] px-3.5 py-2.5 shadow-[0_3px_0_#F7F8F5,inset_0_1px_0_#fff] active:translate-y-[1px] active:shadow-none"
                >
                  <span className="text-[14px] font-black text-[#25282D]">
                    담은 품목 {roomSummary(room.items).kinds}종 · {roomSummary(room.items).count}개
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-[12px] font-black text-[#2A6FD6]">
                    펼치기 <ChevronDown className="w-4 h-4" />
                  </span>
                </button>
              ) : picked.length === 0 ? (
                <p className="text-[13px] font-bold text-[#9AA4B2]">아직 등록된 품목이 없습니다</p>
              ) : (
                <div
                  className={`grid grid-cols-4 gap-1.5 ${
                    pickerOpen ? "max-h-[34dvh] overflow-auto rounded-2xl" : ""
                  }`}
                >
                  {picked.map((p) => (
                    <div
                      key={p.id}
                      className="relative flex min-w-0 flex-col justify-between rounded-2xl bg-gradient-to-b from-white to-[#F7F8F5] border border-[#E5E7EB] px-1.5 pb-1 pt-1 shadow-[0_3px_0_#E5E7EB,inset_0_1px_0_#fff]"
                    >
                      <button
                        onClick={() => setConfirmRemove({ id: p.id, name: p.name, room: room.name })}
                        className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#94A3B8] shadow-sm"
                        aria-label={`${p.name} 삭제`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          tap("soft");
                          setItemMenu(p.id);
                        }}
                        className="absolute left-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[11px] font-black leading-none text-[#64748B]"
                        aria-label={`${p.name} 관리`}
                      >
                        ⋯
                      </button>
                      <div className="flex h-[44px] items-center justify-center">
                        <ItemArt id={p.id} name={p.name} size={44} />
                      </div>
                      <div className="break-keep text-center text-[11.5px] font-extrabold leading-tight text-[#25282D] line-clamp-2">
                        {p.name}
                      </div>
                      <div className="mt-0.5 flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => decQty(p.id, p.name, p.qty)}
                          className="h-7 w-7 shrink-0 rounded-full bg-white border border-[#E5E7EB] text-[14px] font-black text-[#25282D]"
                          aria-label={`${p.name} 수량 줄이기`}
                        >
                          −
                        </button>
                        <span className="min-w-4 text-center text-[12.5px] font-black text-[#25282D] tabular-nums">
                          {p.qty}
                        </span>
                        <button
                          onClick={() => setQty(p.id, p.qty + 1, p.name)}
                          className="h-7 w-7 shrink-0 rounded-full bg-white border border-[#E5E7EB] text-[14px] font-black text-[#25282D]"
                          aria-label={`${p.name} 수량 늘리기`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 직접 품목 선택 (기본 접힘) + 3D 품목 생성 */}
            <div className="flex items-stretch gap-2 px-4 pt-2">
              <button
                onClick={() => {
                  tap("soft");
                  setPickerOpen((v) => !v);
                }}
                className="flex flex-1 min-w-0 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white py-3 text-[16px] font-black text-[#25282D] shadow-[0_5px_0_#F7F8F5,inset_0_1px_0_#fff] active:translate-y-[3px] active:shadow-none"
              >
                <Hand className="w-5 h-5" /> 직접 품목 선택
                <ChevronDown
                  className={`w-5 h-5 transition-transform ${pickerOpen ? "rotate-180" : ""}`}
                />
              </button>
              <button
                onClick={openIconGen}
                aria-label="목록에 없는 품목 추가"
                className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-[#3578C8] bg-gradient-to-b from-white to-[#EEF6FF] px-3 py-2 text-[11px] font-black leading-tight text-[#2A6FD6] shadow-[0_5px_0_#DCE9FF,inset_0_1px_0_#fff] active:translate-y-[3px] active:shadow-none"
              >
                <Sofa className="h-5 w-5" />
                목록에 없는
                <br />
                품목 추가
              </button>
            </div>


            <p className="px-4 pt-1.5 text-[11.5px] font-bold leading-snug text-[#9AA4B2]">
              찾는 품목이 없으면 「목록에 없는 품목 추가」를 눌러 품목 이름과 사진을 등록하세요.
              추가한 품목은 현재 방과 알맞은 품목 그룹에 자동으로 들어갑니다.
            </p>

            {pickerOpen && (
              <div className="flex-1 min-h-[44dvh] overflow-auto px-4 pt-3 space-y-3" {...tabSwipe}>
                {/* 자주 담는 품목 — 검색 없이 눌러서 바로 담습니다 */}
                <div className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 space-y-2 shadow-[inset_0_1px_0_#fff]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13.5px] font-black text-[#25282D]">
                      자주 담는 품목
                      <span className="ml-1.5 text-[11.5px] font-semibold text-[#9AA4B2]">
                        한 번 눌러 바로 담기
                      </span>
                    </div>
                    <button
                      onClick={openFavEdit}
                      className="shrink-0 rounded-xl border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[12px] font-black text-[#25282D] shadow-[0_2px_0_#F7F8F5] active:translate-y-[1px] active:shadow-none"
                    >
                      편집
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {frequent.map((it) => {
                      const qty = room?.items[it.id] || 0;
                      return (
                        <button
                          key={it.id}
                          onClick={() => {
                            setQty(it.id, qty + 1, it.name);
                            tap("success");
                          }}
                          className="relative flex flex-col items-center gap-1 rounded-2xl border px-1 pb-1.5 pt-2 transition-transform active:translate-y-[2px]"
                          style={{
                            borderColor: qty > 0 ? "#3578C8" : "#E5E7EB",
                            background: qty > 0 ? "#F7F8F5" : "#FFFFFF",
                            boxShadow: qty > 0 ? "0 3px 0 #E5E7EB" : "0 2px 0 #F7F8F5",
                          }}
                        >
                          <ItemArt id={it.id} name={it.name} size={36} />
                          <span
                            className="w-full text-center text-[14px] font-black leading-tight line-clamp-2"
                            style={{ color: qty > 0 ? "#3578C8" : "#6B7280" }}
                            title={it.name}
                          >
                            {it.name}
                          </span>
                          {qty > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-[#3578C8] px-1.5 py-0.5 text-[10px] font-black text-white shadow-[0_2px_0_#285C99]">
                              {qty}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto -mx-1 px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {visibleCats.map((c) => (
                    <button
                      key={c}
                      data-category={c}
                      data-selected={!q && c === tab}
                      onClick={() => {
                        tap("soft");
                        setTab(c);
                        setQ("");
                      }}
                      className="jp-category-tab shrink-0 rounded-2xl px-4 py-2.5 text-[14px] font-black whitespace-nowrap transition-all active:translate-y-[2px]"
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

                {/* 소분류로 묶어서 3D 카드로 보여줍니다 */}
                <div className="space-y-4">
                  {[...new Set(items.map((i) => itemFamily(i.name, i.sub || "기타").label))].map((g) => (
                    <div key={g}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-1 rounded-xl text-[12px] font-black text-white bg-gradient-to-b from-[#7FB6FF] to-[#2A6FD6] shadow-[0_2px_0_#1F5AB0]">
                          {g}
                        </span>
                        <span className="flex-1 h-px bg-[#E5E7EB]" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {items
                          .filter((i) => itemFamily(i.name, i.sub || "기타").label === g)
                          .map((it) => {
                            const qty = room.items[it.id] || 0;
                            return (
                              <div
                                key={it.id}
                                className={`relative rounded-2xl p-2 flex flex-col items-center gap-1 border transition-all ${
                                  qty > 0
                                    ? "border-[#3578C8] bg-gradient-to-b from-[#F7F8F5] to-[#DCE9FF] shadow-[0_5px_0_#E5E7EB,inset_0_1px_0_#fff]"
                                    : "border-[#E5E7EB] bg-gradient-to-b from-white to-[#F7FAFF] shadow-[0_4px_0_#F7F8F5,inset_0_1px_0_#fff]"
                                }`}
                              >
                                {/* 고른 품목은 파란 테두리 + 체크 */}
                                {qty > 0 && (
                                  <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-b from-[#5B93D6] to-[#3578C8] shadow-[0_2px_0_#285C99]">
                                    <Check className="h-3.5 w-3.5 text-white" />
                                  </span>
                                )}
                                {/* 모든 품목에 관리 메뉴(⋯) — 목록에서 삭제할 수 있습니다 */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    tap("soft");
                                    setItemMenu(it.id);
                                  }}
                                  className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[11px] font-black leading-none text-[#64748B]"
                                  aria-label={`${it.name} 관리`}
                                >
                                  ⋯
                                </button>
                                <button
                                  onClick={() => {
                                    tap("soft");
                                    setQty(it.id, qty + 1);
                                  }}
                                  className="w-full flex flex-col items-center gap-1 active:translate-y-[2px] transition-transform"
                                >
                                  <ItemArt id={it.id} name={it.name} size={70} />
                                  <span className="text-center text-[15px] font-black leading-tight text-[#25282D] line-clamp-2">
                                    {it.name}
                                  </span>
                                </button>
                                {qty > 0 && (
                                  <div className="w-full flex items-center justify-between gap-1">
                                    <button
                                      onClick={() => decQty(it.id, it.name, qty)}
                                      className="w-7 h-7 rounded-xl bg-white border border-[#E5E7EB] text-[#25282D] font-black shadow-[0_2px_0_#E5E7EB]"
                                      aria-label={`${it.name} 감소`}
                                    >
                                      −
                                    </button>
                                    <span className="text-[14px] font-black text-[#25282D] tabular-nums">
                                      {qty}
                                    </span>
                                    <button
                                      onClick={() => setQty(it.id, qty + 1)}
                                      className="w-7 h-7 rounded-xl bg-gradient-to-b from-[#5B93D6] to-[#3578C8] text-white font-black shadow-[0_2px_0_#285C99]"
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
                  {items.length === 0 && !noResult && (
                    <p className="py-3 text-center text-[13px] font-bold text-[#9AA4B2]">
                      검색 결과가 없습니다
                    </p>
                  )}
                  {/* 검색 결과에 없는 품목 — 깨진 그림·박스 대신 안내와 만들기 버튼을 보여 줍니다 */}
                  {noResult && (
                    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 text-center shadow-[inset_0_1px_0_#fff]">
                      <p className="text-[14px] font-black text-[#25282D]">
                        등록된 품목이 없습니다
                      </p>
                      <p className="mt-1 break-words text-[13px] font-bold text-[#25282D]">
                        「{q.trim()}」
                      </p>
                      {savedIcon?.iconUrl && (
                        <button
                          onClick={() => {
                            const failed = applyGeneratedIcon(savedIcon, room.name);
                            if (failed) toast.error(failed);
                          }}
                          className="mx-auto mt-3 flex items-center gap-2 rounded-2xl border border-[#3578C8] bg-[#F7F8F5] px-3 py-2 text-[13px] font-black text-[#25282D] active:translate-y-[1px]"
                        >
                          <Icon3D
                            src={savedIcon.iconUrl}
                            alt={savedIcon.name || "아이콘"}
                            size={36}
                          />
                          전에 만든 아이콘으로 담기
                        </button>
                      )}
                      <div className="mt-3">
                        <button
                          onClick={openIconGen}
                          className="w-full rounded-2xl bg-gradient-to-b from-[#5B93D6] to-[#3578C8] py-3 text-[14px] font-black text-white shadow-[0_4px_0_#285C99] active:translate-y-[2px] active:shadow-none"
                        >
                          목록에 없는 품목 추가
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 아래 「이 공간 완료」 버튼에 목록이 가리지 않도록 여백을 둡니다 */}
                <div aria-hidden className="h-6" />
              </div>
            )}

            <div className="border-t border-[#E5E7EB] bg-white/95 px-4 pt-3 pb-1 backdrop-blur-sm">
              <PrimaryButton onClick={() => setOpenRoom(null)}>
                <span className="inline-flex items-center gap-2">
                  <Check className="w-5 h-5" /> 이 공간 완료
                </span>
              </PrimaryButton>
            </div>

            {/* 품목 만들기 · 고치기 */}
            {/* 3D 아이콘 만들기 — 확인 후 실제로 그림을 만듭니다 */}
            {iconGen && (
              <div className="absolute inset-0 z-30 flex items-end justify-center">
                <div
                  className="absolute inset-0 bg-[#25282D]/45"
                  onClick={() => !iconBusy && setIconGen(null)}
                />
                <div className="relative max-h-[88%] w-full overflow-auto rounded-t-3xl bg-white p-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <div className="text-[18px] font-black text-[#25282D]">목록에 없는 품목 추가</div>
                  <p className="mt-1 text-[12.5px] font-bold text-[#6B7280]">
                    품목 이름과 사진을 등록하면 지금 열어 둔 공간과 알맞은 품목 그룹에 자동으로
                    들어갑니다
                  </p>

                  <div className="mt-3 space-y-3">
                    <Field label="품목 이름">
                      <TextInput
                        value={iconGen.name}
                        maxLength={24}
                        placeholder="예: 흙침대"
                        onChange={(e) => {
                          const name = e.target.value;
                          setIconGen((f) =>
                            f ? { ...f, name, kind: f.kind === "기타" ? guessKind(name) : f.kind } : f,
                          );
                        }}
                      />
                    </Field>

                    {/* 품목 사진 — 촬영하거나 갤러리에서 고릅니다 */}
                    <div>
                      <div className="mb-1.5 text-[13px] font-black text-[#6B7280]">
                        품목 사진 (없어도 추가할 수 있습니다)
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#3578C8] bg-[#F8FBFF] py-3 text-[13.5px] font-black text-[#2A6FD6] active:translate-y-[1px]">
                          <CamIcon className="h-5 w-5" />
                          {iconGen.photo ? "사진 다시 고르기" : "사진 촬영 · 선택"}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              try {
                                const photo = await shrinkPhoto(file);
                                setIconError(null);
                                setIconGen((f) => (f ? { ...f, photo } : f));
                              } catch {
                                setIconError("사진을 불러오지 못했습니다.");
                              }
                            }}
                          />
                        </label>
                        {iconGen.photo && (
                          <img
                            src={iconGen.photo}
                            alt="고른 품목 사진"
                            className="h-14 w-14 rounded-xl border border-[#E5E7EB] object-cover"
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 text-[13px] font-black text-[#6B7280]">품목 종류</div>
                      <div className="flex flex-wrap gap-2">
                        {ITEM_KINDS.map((k) => (
                          <button
                            key={k.label}
                            onClick={() => setIconGen((f) => (f ? { ...f, kind: k.label } : f))}
                            className={`rounded-2xl px-3 py-2 text-[13px] font-black ${
                              iconGen.kind === k.label
                                ? "bg-gradient-to-b from-[#5B93D6] to-[#3578C8] text-white shadow-[0_3px_0_#285C99]"
                                : "border border-[#E5E7EB] bg-white text-[#6B7280] shadow-[0_3px_0_#F7F8F5]"
                            }`}
                          >
                            {k.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 text-[13px] font-black text-[#6B7280]">추가할 공간</div>
                      <div className="flex flex-wrap gap-2">
                        {[...new Set([...sizeRooms, ...draft.rooms.map((r) => r.name)])].map((rn) => (
                          <button
                            key={rn}
                            onClick={() => setIconGen((f) => (f ? { ...f, room: rn } : f))}
                            className={`rounded-2xl px-3 py-2 text-[13px] font-black ${
                              iconGen.room === rn
                                ? "bg-gradient-to-b from-[#5B93D6] to-[#3578C8] text-white shadow-[0_3px_0_#285C99]"
                                : "border border-[#E5E7EB] bg-white text-[#6B7280] shadow-[0_3px_0_#F7F8F5]"
                            }`}
                          >
                            {rn}
                          </button>
                        ))}
                      </div>
                    </div>

                    {iconSimilar && !iconBusy && (
                      <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-3">
                        <p className="text-[13px] font-black text-[#25282D]">
                          비슷한 품목이 있습니다. 기존 품목을 사용할까요?
                        </p>
                        <p className="mt-1 text-[12.5px] font-bold text-[#6B7280]">
                          「{iconSimilar.name}」
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            onClick={() => useExistingItem(iconSimilar.id, iconSimilar.name)}
                            className="rounded-2xl bg-gradient-to-b from-[#5B93D6] to-[#3578C8] px-3 py-2 text-[13px] font-black text-white"
                          >
                            기존 품목 사용
                          </button>
                          <button
                            onClick={() => void runIconGen({ force: true })}
                            className="rounded-2xl border border-[#3578C8] bg-white px-3 py-2 text-[13px] font-black text-[#2A6FD6]"
                          >
                            새 품목으로 추가
                          </button>
                          <button
                            onClick={() => setIconSimilar(null)}
                            className="rounded-2xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-black text-[#6B7280]"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    )}

                    {iconBusy && (
                      <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F8FBFF] py-5">
                        <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#E5E7EB] border-t-[#3578C8]" />
                        <span className="text-[13.5px] font-black text-[#25282D]">
                          품목을 추가하는 중
                        </span>
                      </div>
                    )}

                    {!iconBusy && iconError && (
                      <div className="rounded-2xl border border-[#FBD5D5] bg-[#FFF5F5] p-3">
                        <p className="text-[13px] font-black text-[#D95C5C]">
                          품목을 추가하지 못했습니다
                        </p>
                        <p className="mt-1 break-words text-[12.5px] font-bold text-[#7A271A]">
                          {iconError}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setIconGen(null)}
                        disabled={iconBusy}
                        className="flex-1 rounded-2xl border border-[#E5E7EB] bg-white py-3.5 text-[15px] font-black text-[#6B7280] disabled:opacity-50"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => void runIconGen()}
                        disabled={iconBusy || cleanItemName(iconGen.name).length < 2}
                        className="flex-1 rounded-2xl bg-gradient-to-b from-[#5B93D6] to-[#3578C8] py-3.5 text-[15px] font-black text-white shadow-[0_4px_0_#285C99] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
                      >
                        {iconBusy ? "추가 중…" : iconError ? "다시 시도" : "추가하기"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {itemForm && (
              <div className="absolute inset-0 z-20 flex items-end justify-center">
                <div
                  className="absolute inset-0 bg-[#25282D]/45"
                  onClick={() => setItemForm(null)}
                />
                <div className="relative max-h-[88%] w-full overflow-auto rounded-t-3xl bg-white p-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <div className="text-[18px] font-black text-[#25282D]">
                    품목명 수정
                  </div>
                  <p className="mt-1 text-[12.5px] font-bold text-[#6B7280]">
                    수정한 이름은 새로고침 후에도 그대로 유지됩니다
                  </p>

                  <div className="mt-3 space-y-3">
                    <Field label="품목명">
                      <TextInput
                        value={itemForm.name}
                        placeholder="예: 모션침대"
                        onChange={(e) => {
                          const name = e.target.value;
                          setItemForm((f) =>
                            f
                              ? {
                                  ...f,
                                  name,
                                  // 이름을 적으면 분류와 아이콘을 자동으로 추천합니다
                                  cat: f.id ? f.cat : name ? guessCategory(name) : f.cat,
                                  icon: name ? icon3dFor(undefined, name) : f.icon,
                                }
                              : f,
                          );
                        }}
                      />
                    </Field>

                    <div>
                      <div className="mb-1.5 text-[13px] font-black text-[#6B7280]">
                        대분류{" "}
                        <span className="font-bold text-[#9AA4B2]">— 자동 추천, 눌러서 변경</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {["가전", "가구", "주방", "생활용품", "특수"].map((c) => (
                          <button
                            key={c}
                            onClick={() => setItemForm((f) => (f ? { ...f, cat: c } : f))}
                            className={`rounded-2xl px-3.5 py-2 text-[13.5px] font-black ${
                              itemForm.cat === c
                                ? "bg-gradient-to-b from-[#5B93D6] to-[#3578C8] text-white shadow-[0_3px_0_#285C99]"
                                : "border border-[#E5E7EB] bg-white text-[#6B7280] shadow-[0_3px_0_#F7F8F5]"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 text-[13px] font-black text-[#6B7280]">
                        아이콘 <span className="font-bold text-[#9AA4B2]">— 눌러서 고르기</span>
                      </div>
                      <div className="grid max-h-[190px] grid-cols-5 gap-2 overflow-auto rounded-2xl border border-[#E5E7EB] bg-[#F8FBFF] p-2">
                        {iconChoices(itemForm.name).map((src) => (
                          <button
                            key={src}
                            onClick={() => setItemForm((f) => (f ? { ...f, icon: src } : f))}
                            className={`flex items-center justify-center rounded-xl border p-1 ${
                              itemForm.icon === src
                                ? "border-[#3578C8] bg-[#DCE9FF] shadow-[0_3px_0_#E5E7EB]"
                                : "border-[#E5E7EB] bg-white"
                            }`}
                          >
                            <Icon3D src={src} alt="아이콘" size={40} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setItemForm(null)}
                      className="flex-1 rounded-2xl border border-[#E5E7EB] bg-white py-3.5 font-black text-[14px] text-[#6B7280] shadow-[0_3px_0_#F7F8F5]"
                    >
                      취소
                    </button>
                    <PrimaryButton onClick={saveItemForm} className="flex-1">
                      저장
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            )}

            {/* 직접 추가한 품목의 작은 메뉴 */}
            {itemMenu && (
              <div className="absolute inset-0 z-20 flex items-end justify-center">
                <div
                  className="absolute inset-0 bg-[#25282D]/45"
                  onClick={() => setItemMenu(null)}
                />
                <div className="relative w-full rounded-t-3xl bg-white p-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <div className="text-[16px] font-black text-[#25282D]">
                    {catalog.find((c) => c.id === itemMenu)?.name ||
                      itemNameById(itemMenu) ||
                      "품목"}
                  </div>
                  <p className="mt-1 text-[12.5px] font-bold text-[#9AA4B2]">
                    {itemMenu.startsWith("ci_") ? "직접 추가한 품목" : "품목 관리"}
                  </p>
                  <div className="mt-3 space-y-2">
                    {room && (itemMenu in room.items) && (
                      <button
                        onClick={() => {
                          const nm =
                            catalog.find((c) => c.id === itemMenu)?.name ||
                            itemNameById(itemMenu) ||
                            "품목";
                          setMoveItem({
                            id: itemMenu,
                            name: nm,
                            qty: room.items[itemMenu] || 1,
                            room: room.name,
                          });
                          setItemMenu(null);
                        }}
                        className="w-full rounded-2xl border border-[#CFE0F7] bg-white py-3.5 font-black text-[14px] text-[#2A6FD6] shadow-[0_3px_0_#EAF2FC]"
                      >
                        자리 이동
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const it = catalog.find((c) => c.id === itemMenu);
                        const c = (draft.customItems || []).find((x) => x.id === itemMenu);
                        const nm = it?.name || itemNameById(itemMenu) || "품목";
                        const group = c?.subgroup || it?.sub || itemSubgroup(nm, c?.cat || "기타");
                        const vol = c?.extra ?? it?.extra ?? 0;
                        toast.success(
                          `${nm} · ${group}${vol ? ` · 기본 부피 ${vol}루베` : ""}${
                            room && itemMenu in room.items ? ` · ${room.name} ${room.items[itemMenu]}개` : ""
                          }`,
                        );
                      }}
                      className="w-full rounded-2xl border border-[#E5E7EB] bg-white py-3.5 font-black text-[14px] text-[#25282D] shadow-[0_3px_0_#F7F8F5]"
                    >
                      품목정보 보기
                    </button>
                    {itemMenu.startsWith("ci_") && (
                      <button
                        onClick={() => {
                          const nm =
                            catalog.find((c) => c.id === itemMenu)?.name ||
                            itemNameById(itemMenu) ||
                            "품목";
                          setGroupMove({ id: itemMenu, name: nm });
                          setItemMenu(null);
                        }}
                        className="w-full rounded-2xl border border-[#CFE0F7] bg-white py-3.5 font-black text-[14px] text-[#2A6FD6] shadow-[0_3px_0_#EAF2FC]"
                      >
                        품목 그룹 이동
                      </button>
                    )}
                    {itemMenu.startsWith("ci_ai_") && (
                      <button
                        onClick={() => {
                          const nm =
                            catalog.find((c) => c.id === itemMenu)?.name ||
                            itemNameById(itemMenu) ||
                            "품목";
                          setIconError(null);
                          setIconSimilar(null);
                          setIconGen({
                            name: nm,
                            kind: guessKind(nm),
                            room: room?.name || "",
                            force: true,
                          });
                          setItemMenu(null);
                        }}
                        className="w-full rounded-2xl border border-[#E5E7EB] bg-white py-3.5 font-black text-[14px] text-[#25282D] shadow-[0_3px_0_#F7F8F5]"
                      >
                        이미지 다시 만들기
                      </button>
                    )}
                    {itemMenu.startsWith("ci_") && (
                      <button
                        onClick={() => openEditItem(itemMenu)}
                        className="w-full rounded-2xl border border-[#E5E7EB] bg-white py-3.5 font-black text-[14px] text-[#25282D] shadow-[0_3px_0_#F7F8F5]"
                      >
                        품목명 수정
                      </button>
                    )}
                    <button
                      onClick={() => void toggleMenuFavorite(itemMenu)}
                      className="w-full rounded-2xl border border-[#E5E7EB] bg-white py-3.5 font-black text-[14px] text-[#25282D] shadow-[0_3px_0_#F7F8F5]"
                    >
                      {(favIds ?? frequent.map((item) => item.id)).includes(itemMenu)
                        ? "자주 담는 품목 해제"
                        : "자주 담는 품목 등록"}
                    </button>
                    <button
                      onClick={() => setConfirmCatalogDel(itemMenu)}
                      className="w-full rounded-2xl border border-[#F3C7C7] bg-white py-3.5 font-black text-[14px] text-[#D95C5C] shadow-[0_3px_0_#FBEAEA]"
                    >
                      이 품목을 목록에서 삭제
                    </button>
                    <button
                      onClick={() => setItemMenu(null)}
                      className="w-full py-3 text-[14px] font-bold text-[#94A3B8]"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 품목 그룹 이동 — 저장해서 새로고침 후에도 유지합니다 */}
            {groupMove && (
              <div className="absolute inset-0 z-30 flex items-end justify-center">
                <div className="absolute inset-0 bg-[#25282D]/45" onClick={() => setGroupMove(null)} />
                <div className="relative max-h-[80%] w-full overflow-auto rounded-t-3xl bg-white p-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <div className="text-[16px] font-black text-[#25282D]">
                    「{groupMove.name}」 품목 그룹 이동
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ITEM_KINDS.map((k) => (
                      <button
                        key={k.label}
                        onClick={async () => {
                          const kind = kindOf(k.label);
                          const saved = await updateItemIcon({
                            data: {
                              itemId: groupMove.id,
                              name: groupMove.name,
                              cat: kind.cat,
                              subgroup: kind.label,
                            },
                          });
                          if (!saved.ok) {
                            toast.error(saved.error || "자리 이동을 저장하지 못했습니다");
                            return;
                          }
                          updateDraft({
                            customItems: (draft.customItems || []).map((c) =>
                              c.id === groupMove.id
                                ? { ...c, cat: kind.cat, subgroup: kind.label }
                                : c,
                            ),
                          });
                          setTab(cat5For(kind.cat, kind.cat));
                          setGroupMove(null);
                          tap("success");
                          toast.success(`「${groupMove.name}」을(를) ${kind.label} 그룹으로 옮겼습니다`);
                        }}
                        className="rounded-2xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-black text-[#25282D] shadow-[0_3px_0_#F7F8F5]"
                      >
                        {k.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setGroupMove(null)}
                    className="mt-3 w-full py-3 text-[14px] font-bold text-[#94A3B8]"
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}

            {/* 전체 목록에서 삭제 확인 */}
            {confirmCatalogDel && (
              <div className="absolute inset-0 z-30 flex items-center justify-center px-6">
                <div
                  className="absolute inset-0 bg-[#25282D]/45"
                  onClick={() => setConfirmCatalogDel(null)}
                />
                <div className="relative w-full max-w-[320px] rounded-3xl bg-white p-5 text-center shadow-[0_16px_40px_rgba(15,23,42,0.3)]">
                  <div className="text-[16px] font-black leading-snug text-[#25282D]">
                    「
                    {catalog.find((c) => c.id === confirmCatalogDel)?.name ||
                      itemNameById(confirmCatalogDel) ||
                      "이 품목"}
                    」을(를)
                    <br />
                    품목 목록에서 삭제하시겠습니까?
                  </div>
                  <p className="mt-2 text-[12.5px] font-bold leading-relaxed text-[#6B7280]">
                    지난 견적서에 적힌 이름과 수량은 그대로 남습니다.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setConfirmCatalogDel(null)}
                      className="flex-1 rounded-2xl border border-[#E5E7EB] bg-white py-3 font-black text-[14px] text-[#6B7280] shadow-[0_3px_0_#F7F8F5]"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => {
                        removeFromCatalog(confirmCatalogDel);
                        setConfirmCatalogDel(null);
                      }}
                      className="flex-1 rounded-2xl bg-gradient-to-b from-[#D95C5C] to-[#D95C5C] py-3 font-black text-[14px] text-white shadow-[0_3px_0_#A81E20]"
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

      {/* 수량을 0으로 줄이거나 뱃지의 X 를 눌렀을 때 (공간 목록·드로어 모두에서 동작) */}
      {confirmRemove && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-6">
          <div
            className="absolute inset-0 bg-[#25282D]/40"
            onClick={() => setConfirmRemove(null)}
          />
          <div className="relative w-full max-w-[300px] rounded-3xl bg-white p-5 text-center shadow-[0_16px_40px_rgba(15,23,42,0.3)]">
            <div className="text-[16px] font-black text-[#25282D]">
              이 품목을 공간에서 삭제할까요?
            </div>
            <p className="mt-1.5 text-[13px] font-bold text-[#6B7280]">
              「{confirmRemove.room ?? room?.name ?? ""}」의 {confirmRemove.name}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmRemove(null)}
                className="flex-1 rounded-2xl border border-[#E5E7EB] bg-white py-3 font-black text-[14px] text-[#6B7280] shadow-[0_3px_0_#F7F8F5]"
              >
                취소
              </button>
              <button
                onClick={() => {
                  tap("soft");
                  const target = confirmRemove.room ?? room?.name;
                  if (target) setQtyInRoom(target, confirmRemove.id, 0);
                  setConfirmRemove(null);
                }}
                className="flex-1 rounded-2xl bg-gradient-to-b from-[#D95C5C] to-[#D95C5C] py-3 font-black text-[14px] text-white shadow-[0_3px_0_#A81E20]"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 평수 변경 확인 — 담은 품목을 지키기 위해 두 번 물어봅니다 */}
      {sizeConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-[#25282D]/45" onClick={() => setSizeConfirm(null)} />
          <div className="relative w-full max-w-[320px] rounded-3xl bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.3)]">
            {sizeConfirm.stage === 1 ? (
              <>
                <div className="text-center text-[17px] font-black text-[#25282D]">
                  {sizeConfirm.key} 기본품목을 담을까요?
                </div>
                <p className="mt-1.5 text-center text-[13px] font-bold text-[#6B7280]">
                  지금 담은 품목 {pickedCount}개가 있습니다
                </p>
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => applyPreset(sizeConfirm.key, "merge")}
                    className="w-full rounded-2xl bg-gradient-to-b from-[#5B93D6] to-[#3578C8] py-3 font-black text-[15px] text-white shadow-[0_3px_0_#285C99]"
                  >
                    현재 품목에 추가
                  </button>
                  <button
                    onClick={() => {
                      if (hasCustomPicked) setSizeConfirm({ key: sizeConfirm.key, stage: 2 });
                      else applyPreset(sizeConfirm.key, "replace");
                    }}
                    className="w-full rounded-2xl border border-[#E5E7EB] bg-white py-3 font-black text-[15px] text-[#B4232A] shadow-[0_3px_0_#F7F8F5]"
                  >
                    새 기본품목으로 변경
                  </button>
                  <button
                    onClick={() => setSizeConfirm(null)}
                    className="w-full rounded-2xl border border-[#E5E7EB] bg-white py-3 font-black text-[14px] text-[#6B7280]"
                  >
                    취소
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center text-[17px] font-black text-[#25282D]">
                  직접 추가한 품목도 함께 지워집니다
                </div>
                <p className="mt-1.5 text-center text-[13px] font-bold text-[#6B7280]">
                  {sizeConfirm.key} 기본품목 구성으로 새로 채울까요?
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setSizeConfirm(null)}
                    className="flex-1 rounded-2xl border border-[#E5E7EB] bg-white py-3 font-black text-[14px] text-[#6B7280] shadow-[0_3px_0_#F7F8F5]"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => applyPreset(sizeConfirm.key, "replace")}
                    className="flex-1 rounded-2xl bg-[#D95C5C] py-3 font-black text-[14px] text-white shadow-[0_3px_0_#A81E20]"
                  >
                    변경
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 품목을 다른 공간으로 옮기기 */}
      {moveItem && (moveItem.room ?? openRoom) && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-[#25282D]/45" onClick={() => setMoveItem(null)} />
          <div className="relative w-full max-w-[320px] rounded-3xl bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.3)]">
            <div className="text-center text-[16px] font-black text-[#25282D]">
              {moveItem.name} {moveItem.qty}개를 어디로 옮길까요?
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {sizeRooms
                .filter((n) => n !== (moveItem.room ?? openRoom))
                .map((n) => (
                  <button
                    key={n}
                    onClick={() =>
                      moveItemTo(
                        moveItem.id,
                        moveItem.qty,
                        (moveItem.room ?? openRoom) as string,
                        n,
                      )
                    }
                    className="rounded-2xl border border-[#E5E7EB] bg-gradient-to-b from-white to-[#F7F8F5] py-3 font-black text-[14px] text-[#2A6FD6] shadow-[0_3px_0_#E5E7EB] active:translate-y-[2px]"
                  >
                    {n}
                  </button>
                ))}
            </div>
            <button
              onClick={() => setMoveItem(null)}
              className="mt-3 w-full rounded-2xl border border-[#E5E7EB] bg-white py-3 font-black text-[14px] text-[#6B7280]"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 자주 담는 품목 편집 */}
      {favEditOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-[#25282D]/45"
            onClick={() => !favSaving && setFavEditOpen(false)}
          />
          <div className="relative flex h-[86dvh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-[0_-14px_40px_rgba(7,81,216,0.28)]">
            <div className="border-b border-[#F7F8F5] px-4 py-3">
              <div className="text-[17px] font-black text-[#25282D]">자주 담는 품목 편집</div>
              <div className="mt-0.5 text-[12px] font-bold text-[#6B7280]">
                등록 {favDraft.length} / {FAVORITE_LIMIT}개 · 눌러서 추가·삭제
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-auto px-4 py-3">
              {/* 등록된 품목 — 순서 변경·삭제 */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8FBFF] p-3">
                <div className="text-[12.5px] font-black text-[#25282D]">등록한 품목</div>
                {favDraft.length === 0 ? (
                  <div className="py-3 text-center text-[12.5px] font-bold text-[#94A3B8]">
                    아래에서 품목을 골라 추가해 주세요
                  </div>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {favDraft.map((id, i) => {
                      const it = catalog.find((c) => c.id === id);
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-2 py-1.5"
                        >
                          <span className="w-5 text-center text-[11px] font-black text-[#94A3B8]">
                            {i + 1}
                          </span>
                          <ItemArt id={id} name={it?.name || id} size={26} />
                          <span className="flex-1 truncate text-[13px] font-extrabold text-[#25282D]">
                            {it?.name || id}
                          </span>
                          <button
                            onClick={() => moveFav(id, -1)}
                            disabled={i === 0}
                            aria-label="위로"
                            className="h-8 w-8 rounded-lg border border-[#E5E7EB] text-[#25282D] disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveFav(id, 1)}
                            disabled={i === favDraft.length - 1}
                            aria-label="아래로"
                            className="h-8 w-8 rounded-lg border border-[#E5E7EB] text-[#25282D] disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => toggleFav(id)}
                            aria-label={`${it?.name || id} 삭제`}
                            className="h-8 w-8 rounded-lg border border-[#FBD5D5] text-[#D95C5C]"
                          >
                            <X className="mx-auto h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 전체 품목 검색 후 추가 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={favQuery}
                  onChange={(e) => setFavQuery(e.target.value)}
                  placeholder="전체 품목 검색 (예: 냉장고)"
                  className="w-full rounded-2xl border border-[#E5E7EB] bg-white py-3 pl-9 pr-3 text-[14px] font-bold outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2 pb-2">
                {catalog
                  .filter((i) => (favQuery ? i.name.includes(favQuery) : true))
                  .slice(0, 120)
                  .map((it) => {
                    const on = favDraft.includes(it.id);
                    return (
                      <button
                        key={it.id}
                        onClick={() => toggleFav(it.id)}
                        className="flex min-h-11 items-center gap-1.5 rounded-2xl border pl-1.5 pr-3 text-[13px] font-black"
                        style={{
                          borderColor: on ? "#3578C8" : "#E5E7EB",
                          background: on ? "#F7F8F5" : "#FFFFFF",
                          color: on ? "#3578C8" : "#6B7280",
                        }}
                      >
                        <ItemArt id={it.id} name={it.name} size={26} />
                        {it.name}
                        {on && <Check className="h-4 w-4" />}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="space-y-2 border-t border-[#F7F8F5] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <PrimaryButton onClick={() => void saveFav()} disabled={favSaving}>
                {favSaving ? "저장 중…" : "저장"}
              </PrimaryButton>
              <button
                onClick={() => setFavEditOpen(false)}
                disabled={favSaving}
                className="w-full rounded-2xl border border-[#E5E7EB] bg-white py-3.5 text-[14px] font-black text-[#6B7280] shadow-[0_3px_0_#F7F8F5] disabled:opacity-50"
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

// ============ AI Recognition ============
export function AIRecognition() {
  const { features, loaded } = useExperimentalFeatures();
  const allowed =
    features.isSuperAdmin &&
    (features.voiceItemInput || features.aiPhotoScan || features.aiVideoScan);
  // 메뉴·라우트 가드와 별도로 컴포넌트 자체도 차단합니다.
  // 권한 확인 전에는 AI 화면을 한 프레임도 렌더링하지 않습니다.
  if (!loaded || !allowed) return <Step6 />;
  return <AIRecognitionLab />;
}

function AIRecognitionLab() {
  const { draft, updateDraft, setScreen, currentRoomId, setCurrentRoom } = useApp();
  const { blocked: entBlocked } = useEntitlement();
  const { features } = useExperimentalFeatures();
  const showVoice = features.isSuperAdmin && features.voiceItemInput;
  const showPhoto = features.isSuperAdmin && features.aiPhotoScan;
  const showVideo = features.isSuperAdmin && features.aiVideoScan;
  const showVision = showPhoto || showVideo;
  const [results, setResults] = useState<DetectedItem[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  /** 분석 진행률 (0~100) */
  const [progress, setProgress] = useState(0);
  /** 사진이 흔들리거나 어두워 다시 찍어야 할 때의 안내 */
  const [retake, setRetake] = useState("");
  /** 다시 분석에 쓸 마지막 사진 묶음 */
  const [lastBatch, setLastBatch] = useState<{
    images: string[];
    source: "photo" | "video";
  } | null>(null);

  const [onlyHigh, setOnlyHigh] = useState(true);
  /** 찰칵 하는 순간 마스코트가 플래시를 터뜨립니다 */
  const [shooting, setShooting] = useState(false);

  /** 담을 공간 — 지금 화면에서 고른 방 */
  const [roomId, setRoomId] = useState<string>(() => currentRoomId || draft.rooms[0]?.id || "");
  const targetRoom = draft.rooms.find((r) => r.id === roomId) || draft.rooms[0];
  /**
   * 촬영을 시작한 순간의 방을 고정합니다.
   * 비동기 AI 분석이 끝난 뒤 화면에서 방을 바꿔도, 이 사진의 품목은 촬영 당시 고른 방에 저장됩니다.
   */
  const [capturedRoomId, setCapturedRoomId] = useState<string>("");
  const capturedRoom = draft.rooms.find((r) => r.id === capturedRoomId) || targetRoom;
  /** AI가 추정한 공간 이름(참고용). 저장 위치를 자동으로 바꾸지 않습니다. */
  const [roomGuessName, setRoomGuessName] = useState<string>("");

  /** 음성으로 바로 담기 */
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  /** 왜 안 되는지 화면에 보여 주는 한 줄 */
  const [voiceHint, setVoiceHint] = useState("");
  /** 음성이 안 될 때 글로 담기 */
  const [typed, setTyped] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  /** 확신이 낮아 확인이 필요한 품목 (바로 담지 않습니다) */
  const [pending, setPending] = useState<ItemMatch[]>([]);
  /** 말한 그대로 — 해석 결과와 나란히 보여 줍니다 */
  const [lastHeard, setLastHeard] = useState("");
  /** 마이크가 실패했을 때만 켜집니다 (실패를 성공처럼 보이지 않게) */
  const [voiceError, setVoiceError] = useState(false);
  const recRef = useRef<RecognitionLike | null>(null);
  const recorderRef = useRef<WavRecorder | null>(null);
  const keepRef = useRef(false);
  /** 마이크를 누른 동안 들은 말을 모아 둡니다 (끝내기를 누를 때 한 번만 담습니다) */
  const voiceTextRef = useRef("");
  /** 마지막으로 말소리가 들어온 시각 — 오래 조용할 때만 마무리합니다 */
  const lastSoundRef = useRef(0);
  /** 조용한 시간을 재는 타이머 */
  const silenceRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  /**
   * 여러 번 나눠 분석하고 결과를 합칩니다.
   * 1) 사진 전체를 봅니다.
   * 2) 사진을 4조각으로 나눠 확대해 다시 봅니다 (작거나 가려진 물건 찾기).
   * 같은 물건은 가장 큰 수량 하나로만 남겨 중복 수량이 생기지 않게 합니다.
   */
  const mergeItems = (base: DetectedItem[], add: DetectedItem[]): DetectedItem[] => {
    const map = new Map(base.map((i) => [i.id, { ...i }]));
    for (const a of add) {
      const cur = map.get(a.id);
      if (!cur) {
        map.set(a.id, { ...a });
        continue;
      }
      cur.qty = Math.max(cur.qty, a.qty);
      cur.confidence = Math.max(cur.confidence, a.confidence);
      cur.note = cur.note || a.note;
    }
    return [...map.values()];
  };

  const analyze = async (images: string[], source: "photo" | "video", keepPrev = false) => {
    if (entBlocked) {
      toast.error(TRIAL_EXPIRED_MESSAGE);
      setScreen("subscription");
      return;
    }
    setBusy(true);
    setProgress(5);
    setRetake("");
    setRoomGuessName("");
    setLastBatch({ images, source });
    if (!keepPrev) setResults([]);

    // 흔들림·어두움을 먼저 살펴봅니다
    if (source === "photo") {
      const q = await photoQuality(images[0]);
      if (!q.ok) {
        setRetake(q.reason ?? "사진을 다시 찍어주세요.");
        setBusy(false);
        setProgress(0);
        toast.error(q.reason ?? "사진을 다시 찍어주세요.");
        return;
      }
    }

    // 분석할 묶음 만들기 — 전체 + 확대 조각
    const passes: string[][] = [images];
    if (source === "photo") {
      try {
        const tiles = await tileDataUrl(images[0], 2);
        passes.push(tiles.slice(0, 4));
      } catch {
        /* 조각을 못 만들면 전체만 봅니다 */
      }
    }

    let merged: DetectedItem[] = keepPrev ? results : [];
    let roomGuess: string | null = null;
    let failed = 0;
    try {
      // 여러 묶음(전체 + 확대 조각)을 순차가 아니라 한꺼번에 분석해 속도를 높입니다.
      setProgress(40);
      const settled = await Promise.all(
        passes.map(async (imgs) => {
          try {
            const res = await recognizeItems({ data: { images: imgs, source } });
            return res.error ? null : res;
          } catch {
            return null;
          }
        }),
      );
      for (const res of settled) {
        if (!res) {
          failed++;
          continue;
        }
        merged = mergeItems(merged, res.items);
        if (!roomGuess && res.roomGuess) roomGuess = res.roomGuess;
      }
      setResults(merged);
      setProgress(100);

      if (merged.length === 0) {
        setRetake(
          failed > 0
            ? "AI 분석이 되지 않았습니다. 다시 분석을 눌러 주세요."
            : "물건을 찾지 못했습니다. 더 밝고 가까이서 다시 찍어주세요.",
        );
        return;
      }

      const high = merged.filter((i) => i.confidence >= THRESHOLD).length;
      if (high === 0) {
        toast.info(`${PCT}% 이상 확실한 품목이 없습니다. 「확인 필요 품목」을 살펴봐 주세요.`);
        setOnlyHigh(false);
      } else {
        toast.success(`AI 인식 완료 — 확실한 품목 ${high}개 · 확인 필요 ${merged.length - high}개`);
        tap("success");
      }
      // AI 추정 공간은 참고용으로만 저장합니다(저장 위치를 자동으로 바꾸지 않음).
      if (roomGuess) setRoomGuessName(roomGuess);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const onPhoto = async (f: File) => {
    flash();
    // 촬영을 시작한 순간의 방을 고정합니다 (분석 중 방을 바꿔도 이 사진은 이 방에 저장).
    setCapturedRoomId(roomId);
    setVideoUrl("");
    setPhotoUrl(URL.createObjectURL(f));
    const dataUrl = await fileToDataUrl(f);
    // 사진을 여러 장 찍으면 앞서 찾은 품목에 이어서 합칩니다
    await analyze([dataUrl], "photo", results.length > 0);
  };

  const onVideo = async (f: File) => {
    flash();
    setCapturedRoomId(roomId);
    setPhotoUrl("");
    setVideoUrl(URL.createObjectURL(f));
    setBusy(true);
    try {
      const frames = await videoToFrames(f, 5);
      await analyze(frames, "video", results.length > 0);
    } catch {
      toast.error("동영상을 분석하지 못했습니다");
      setBusy(false);
    }
  };

  /** 같은 사진으로 다시 분석합니다 */
  const retry = () => {
    if (!lastBatch) return;
    tap("soft");
    void analyze(lastBatch.images, lastBatch.source, false);
  };

  /**
   * 품목을 공간에 더합니다.
   * auto 가 true 면 품목마다 어울리는 공간으로 자동 배정하고,
   * 어울리는 공간을 못 찾은 품목만 고른 공간에 담습니다.
   */
  const addToRoom = (
    add: { id: string; name: string; qty: number }[],
    targetId: string,
    auto = false,
  ): string | null => {
    const base = draft.rooms.find((r) => r.id === targetId) || draft.rooms[0];
    if (!base || add.length === 0) return null;
    const names = draft.rooms.map((r) => r.name);
    const rooms = draft.rooms.map((r) => ({ ...r, items: { ...r.items } }));
    const used: string[] = [];
    for (const a of add) {
      const pick = auto ? suggestRoomName(a.name, names) : undefined;
      const target =
        (pick && rooms.find((r) => r.name === pick)) || rooms.find((r) => r.id === base.id);
      if (!target) continue;
      target.items[a.id] = (target.items[a.id] || 0) + a.qty;
      if (!used.includes(target.name)) used.push(target.name);
    }
    if (used.length === 0) return null;
    updateDraft({ rooms });
    return used.join(", ");
  };

  /**
   * 인식한 품목을 방에 담습니다.
   * 저장 위치는 촬영 당시 고른 방(capturedRoom)입니다. AI 추정 공간으로 자동 이동하지 않습니다.
   * roomIdOverride 가 있으면(사용자가 "…으로 변경"을 직접 누른 경우) 그 방으로 담습니다.
   */
  const apply = (roomIdOverride?: string) => {
    const dest = draft.rooms.find((r) => r.id === (roomIdOverride || capturedRoomId)) || targetRoom;
    if (!dest) return;
    // auto=false → 품목 이름으로 다른 방에 흩어 담지 않고, 고른 방 하나에만 담습니다.
    const name = addToRoom(shown, dest.id, false);
    if (!name) return;
    setCurrentRoom(dest.id);
    toast.success(`「${dest.name}」에 ${shown.length}개 품목을 담았습니다`);
    setScreen("step6");
  };

  /** AI가 추정한 공간(있으면)과 촬영 당시 고른 방이 다른지 — 다르면 확인만 받고 자동 이동하지 않습니다. */
  const guessedRoom = roomGuessName ? draft.rooms.find((r) => r.name === roomGuessName) : undefined;
  const roomMismatch = !!guessedRoom && !!capturedRoom && guessedRoom.id !== capturedRoom.id;

  // ---- 음성으로 바로 담기 (대화 없이, 말하는 즉시 들어갑니다) ----

  const applySpeech = (rawText: string) => {
    const targetId = roomIdRef.current;
    setVoiceBusy(true);
    try {
      const res = parseVoice(
        rawText,
        draft.rooms.map((r) => r.name),
        (draft.customItems ?? [])
          .filter((c) => c.active !== false)
          .map((c) => ({ id: c.id, name: c.name })),
      );
      setLastHeard(res.transcript);

      // 말할 때 공간 이름을 같이 말했으면 그 공간으로 옮겨 담습니다
      const spoken = res.room ? draft.rooms.find((r) => r.name === res.room) : undefined;
      const finalId = spoken?.id || targetId;
      if (spoken && spoken.id !== targetId) setRoomId(spoken.id);

      // 차량·추가작업도 말한 대로 반영합니다
      if (res.truck) {
        const patch: Partial<typeof draft> = {};
        if (res.truck.truck1t) patch.truck1t = res.truck.truck1t;
        if (res.truck.truck5t) patch.truck5t = res.truck.truck5t;
        if (res.truck.ladder && !draft.ladder) patch.ladder = 1;
        if (Object.keys(patch).length) updateDraft(patch);
      }
      if (res.extraWork.length) {
        const have = new Set(draft.options.map((o) => o.name));
        const add = res.extraWork
          .filter((w) => !have.has(w.name))
          .map((w) => ({
            id: `o_${w.name}`,
            name: w.name,
            enabled: true,
            price: OPTION_PRESETS.find((p) => p.name === w.name)?.price ?? 0,
            separate: false,
          }));
        if (add.length) updateDraft({ options: [...draft.options, ...add] });
      }

      // 확신이 낮은 것은 담지 않고 확인부터 받습니다
      if (res.needConfirm.length) setPending(res.needConfirm);

      if (res.items.length) {
        // 항상 지금 고른 공간(또는 사용자가 직접 말한 공간)에만 담습니다.
        // AI 추정 공간으로 흩어 담지 않습니다 — 고른 방과 다른 방에 들어가던 문제 방지.
        const name = addToRoom(res.items, finalId, false);
        if (name) {
          tap("success");
          setVoiceHint(
            `「${name}」 · ${res.items.map((i) => `${i.name} ${i.qty}${i.unit}`).join(", ")}`,
          );
        }
      } else if (!res.needConfirm.length && !res.extraWork.length && !res.truck) {
        setVoiceHint(`“${res.transcript}” 에서 품목을 찾지 못했습니다. 다시 말씀해 주세요.`);
      }
    } finally {
      setVoiceBusy(false);
    }
  };

  /** 확인 화면에서 고른 품목을 담습니다 */
  const confirmPending = (m: ItemMatch, pickId?: string) => {
    const picked = pickId ? m.candidates.find((c) => c.id === pickId) : m.candidates[0];
    if (!picked) return;
    const name = addToRoom([{ id: picked.id, name: picked.name, qty: m.qty }], roomIdRef.current);
    if (name) {
      tap("success");
      setVoiceHint(`「${name}」 · ${picked.name} ${m.qty}${m.unit}`);
    }
    setPending((p) => p.filter((x) => x !== m));
  };

  /**
   * 마이크를 끝내고 한 번만 담습니다.
   * (말하는 중에는 담지 않으므로 인식 소리가 반복되지 않습니다)
   */
  const stopVoice = () => {
    keepRef.current = false;
    if (silenceRef.current) {
      clearInterval(silenceRef.current);
      silenceRef.current = null;
    }
    try {
      recRef.current?.stop();
    } catch {
      /* 이미 멈춘 경우 */
    }
    recRef.current = null;
    setListening(false);
    const all = mergeTranscript(voiceTextRef.current, heard).trim();
    voiceTextRef.current = "";
    setHeard("");
    if (!all) {
      setVoiceHint("들은 말이 없습니다. 마이크를 누르고 품목을 말씀해 주세요.");
      return;
    }
    setVoiceHint(`들은 말: “${all}”`);
    void applySpeech(all);
  };

  const startVoice = () => {
    const fail = (msg: string) => {
      setVoiceError(true);
      setVoiceHint(msg);
      toast.error(msg);
    };
    const SR = recognitionCtor();
    if (!SR) {
      // 안 되는 기기에서 되는 척하지 않습니다
      fail(
        "이 브라우저는 음성 인식을 지원하지 않습니다. 갤럭시는 크롬, 아이폰은 사파리로 열어 주세요.",
      );
      return;
    }
    if (!isSecureForMic()) {
      fail(INSECURE_MIC_MESSAGE);
      return;
    }
    if (!targetRoom) {
      fail("담을 공간을 먼저 골라 주세요");
      return;
    }
    setVoiceError(false);
    setVoiceHint("");
    voiceTextRef.current = "";
    setHeard("");
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
        const best = bestAlternative(r).transcript.trim();
        if (!best) continue;
        // 말한 문장을 모아만 둡니다 — 담기는 「끝내기」를 누를 때 한 번에 합니다
        voiceTextRef.current = mergeTranscript(voiceTextRef.current, best);
      }
      // 말소리가 들어온 시각을 남겨, 잠깐 쉬어도 끊기지 않게 합니다
      lastSoundRef.current = Date.now();
      setHeard(mergeTranscript(voiceTextRef.current, interim));
    };

    rec.onerror = (ev: SpeechErrorLike) => {
      const code = ev?.error ?? "";
      // 잠깐 조용한 것뿐이면 계속 듣습니다
      if (code === "no-speech" || code === "aborted") return;
      keepRef.current = false;
      setListening(false);
      setVoiceError(true);
      // 권한 거부 / 마이크 없음 / 네트워크 / 인식 서비스 오류를 나눠서 알려 줍니다.
      // 지금까지 담은 고객·품목 정보는 그대로 둡니다.
      setVoiceHint(speechErrorMessage(code));
      toast.error(speechErrorMessage(code));
    };

    // 브라우저가 스스로 멈춰도 바로 다시 이어 듣습니다.
    // 길게 말해도 중간에 끊기지 않고, 「끝내기」를 누를 때 한 번에 담습니다.
    rec.onend = () => {
      if (!keepRef.current) {
        setListening(false);
        return;
      }
      try {
        rec.start();
      } catch {
        window.setTimeout(() => {
          if (!keepRef.current) return;
          try {
            rec.start();
          } catch {
            // 더는 이을 수 없으면 지금까지 들은 말로 마무리합니다
            stopVoice();
          }
        }, 350);
      }
    };

    try {
      rec.start();
      keepRef.current = true;
      setListening(true);
      setVoiceError(false);
      lastSoundRef.current = Date.now();
      // 20초 넘게 아무 말이 없으면 스스로 마무리합니다 (그 전에는 계속 듣습니다)
      if (silenceRef.current) clearInterval(silenceRef.current);
      silenceRef.current = window.setInterval(() => {
        if (!keepRef.current) return;
        if (Date.now() - lastSoundRef.current > 20000) stopVoice();
      }, 1000) as unknown as ReturnType<typeof setInterval>;
      setVoiceHint(
        "듣고 있어요 — 천천히 길게 말씀하세요. 잠깐 쉬어도 계속 듣습니다. 다 말한 뒤 「끝내기」",
      );
      // 녹음기(getUserMedia)를 같이 켜면 음성인식이 마이크를 뺏겨
      // 아무 결과도 나오지 않습니다. 인식은 브라우저 음성인식만 씁니다.
      tap("soft");
    } catch {
      setListening(false);
      fail("마이크를 시작하지 못했습니다. 다른 앱이 마이크를 쓰고 있는지 확인해 주세요.");
    }
  };

  // 화면을 벗어나면 마이크를 끕니다
  useEffect(() => {
    return () => {
      keepRef.current = false;
      if (silenceRef.current) {
        clearInterval(silenceRef.current);
        silenceRef.current = null;
      }
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
    <MobileShell className="jp-estimate-flow jp-tone-ai">
      <TopBar title="AI 집 안 스캔" onBack={() => setScreen("step4")} />
      <div className="p-5 space-y-4 flex-1 overflow-auto pb-24">
        {showVision && <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#EDF5FF] to-[#DCEBFF] px-5 pt-4 pb-5 text-center">
          <ScanMascot state={mascotState} size={164} className="mx-auto" />
          <div className="mt-1 text-[17px] font-black text-[#25282D]">
            {busy ? "집 안을 살펴보는 중이에요" : "제가 대신 찍어 드릴게요"}
          </div>
          <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[#5A6478]">
            {busy
              ? "가구·가전을 찾아 수량을 세고 있습니다"
              : "방을 한 바퀴 비추면 AI가 품목을 알아서 담아요"}
          </p>
        </div>}

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
        <div className="rounded-3xl border border-[#E5E7EB] bg-white px-4 py-3.5">
          <div className="text-[14px] font-black text-[#25282D]">
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
                          ROOM_TINT[r.name] || "from-[#5B93D6] to-[#3578C8]"
                        } shadow-[0_3px_0_rgba(0,0,0,0.18)]`
                      : "text-[#6B7280] bg-white border border-[#E5E7EB] shadow-[0_3px_0_#F7F8F5]"
                  }`}
                >
                  {r.name}
                </button>
              );
            })}
          </div>
        </div>

        {showVoice && <>
        {/* 음성으로 바로 담기 — 말하면 그대로 들어갑니다 */}
        <button
          onClick={() => (listening ? stopVoice() : startVoice())}
          disabled={busy}
          className={`flex w-full items-center justify-center gap-2 rounded-3xl py-4 font-black text-[15px] text-white transition-transform active:translate-y-[3px] active:shadow-none disabled:opacity-60 ${
            listening
              ? "bg-gradient-to-b from-[#D95C5C] to-[#D95C5C] shadow-[0_5px_0_#A81E20]"
              : "bg-gradient-to-b from-[#34D399] to-[#059669] shadow-[0_5px_0_#047857,inset_0_1px_0_rgba(255,255,255,0.4)]"
          }`}
        >
          <Mic className="h-5 w-5" />
          {listening ? "듣는 중 — 누르면 끝내기" : "말해서 바로 담기"}
        </button>

        {/* 지금 무슨 상태인지 캐릭터가 알려 줍니다 (누르기 전에도 보입니다) */}
        <Card className="flex items-start gap-3 rounded-[14px]">
          <JimpickCharacter
            state={
              voiceBusy
                ? "processing"
                : listening
                  ? "listening"
                  : voiceError
                    ? "error"
                    : lastHeard
                      ? "done"
                      : "idle"
            }
            size={64}
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div
              className={`text-[16px] font-bold ${voiceError ? "text-[#D95C5C]" : "text-[#25282D]"}`}
            >
              {voiceBusy
                ? "담는 중이에요"
                : heard
                  ? `“${heard}”`
                  : voiceHint || "말씀하세요 — 예) 냉장고 하나, 침대 두 개"}
            </div>
            {lastHeard && !heard && (
              <div className="mt-1 break-words text-[15px] text-[#6B7280]">
                들은 말: “{lastHeard}”
              </div>
            )}
          </div>
        </Card>

        {/* 헷갈리는 말은 담지 않고 먼저 확인합니다 */}
        {pending.length > 0 && (
          <Card className="rounded-[14px]">
            <div className="text-[16px] font-bold text-[#25282D]">
              이렇게 들었어요. 맞는 것을 골라 주세요.
            </div>
            <div className="mt-2 space-y-3">
              {pending.map((m, i) => (
                <div key={`${m.id}_${i}`} className="rounded-[14px] bg-[#F7F8F5] p-3">
                  <div className="text-[15px] text-[#6B7280]">
                    “{m.raw}” · {m.qty}
                    {m.unit}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.candidates.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => confirmPending(m, c.id)}
                        className="rounded-[14px] border border-[#E5E7EB] bg-white px-3 py-2 text-[16px] font-bold text-[#25282D] active:translate-y-[1px]"
                      >
                        {c.name}
                      </button>
                    ))}
                    <button
                      onClick={() => setPending((p) => p.filter((x) => x !== m))}
                      className="rounded-[14px] border border-[#E5E7EB] bg-white px-3 py-2 text-[16px] font-bold text-[#6B7280] active:translate-y-[1px]"
                    >
                      아니에요
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 음성이 안 될 때를 위한 글 입력 — 같은 방식으로 담깁니다 */}
        <div className="flex gap-2">
          <TextInput value={typed} placeholder="" onChange={(e) => setTyped(e.target.value)} />
          <button
            onClick={() => {
              const t = typed.trim();
              if (!t) return;
              setTyped("");
              void applySpeech(t);
            }}
            disabled={voiceBusy || !typed.trim()}
            className="shrink-0 rounded-2xl bg-gradient-to-b from-[#5B93D6] to-[#3578C8] px-4 font-black text-[14px] text-white shadow-[0_4px_0_#285C99] disabled:opacity-50"
          >
            담기
          </button>
        </div>
        </>}

        {showVision && <>
        {/* 지금 어느 방에 저장되는지 촬영 버튼 위에 분명히 보여 줍니다 */}
        <div className="rounded-2xl bg-[#F7F8F5] px-4 py-2.5 text-center text-[14px] font-black text-[#25282D]">
          현재 선택: {targetRoom ? targetRoom.name : "공간을 먼저 선택해 주세요"}
        </div>

        {/* 촬영 — 사진 / 동영상 */}
        <div className={`grid gap-3 ${showPhoto && showVideo ? "grid-cols-2" : "grid-cols-1"}`}>
          {showPhoto && (
          <label
            className={`flex flex-col items-center gap-1.5 rounded-3xl py-4 text-white shadow-[0_5px_0_#285C99,inset_0_1px_0_rgba(255,255,255,0.4)] transition-transform active:translate-y-[3px] active:shadow-none ${
              busy ? "pointer-events-none opacity-60" : "cursor-pointer"
            }`}
            style={{ background: "linear-gradient(180deg, #5B93D6 0%, #3578C8 100%)" }}
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
          )}

          {showVideo && (
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
          )}
        </div>

        <div className={`grid gap-3 ${showPhoto && showVideo ? "grid-cols-2" : "grid-cols-1"}`}>
          {showPhoto && (
          <label className="py-4 rounded-2xl bg-white border border-[#E5E7EB] font-semibold flex items-center justify-center gap-2 cursor-pointer">
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
          )}
          {showVideo && (
          <label className="py-4 rounded-2xl bg-white border border-[#E5E7EB] font-semibold flex items-center justify-center gap-2 cursor-pointer">
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
          )}
        </div>
        </>}

        {busy && (
          <Card className="py-5 text-center">
            <div className="font-bold text-[#25282D]">AI 품목 분석 중… {progress}%</div>
            <div className="mt-1 text-xs text-[#6B7280]">
              사진 전체를 본 뒤, 나눠서 확대해 작은 물건까지 다시 확인합니다
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#F7F8F5]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#5B93D6] to-[#3578C8] transition-[width] duration-300"
                style={{ width: `${Math.max(5, progress)}%` }}
              />
            </div>
          </Card>
        )}

        {/* 분석이 어려운 사진 · 실패했을 때 — 멈추지 않고 다시 할 수 있게 합니다 */}
        {!busy && retake && (
          <Card className="rounded-[14px] border border-[#FDE68A] bg-[#FFFBEB]">
            <div className="text-[14px] font-black text-[#B45309]">{retake}</div>
            {lastBatch && (
              <button
                onClick={retry}
                className="mt-2 w-full rounded-2xl border border-[#FCD34D] bg-white py-3 text-[14px] font-black text-[#B45309]"
              >
                같은 사진으로 다시 분석
              </button>
            )}
          </Card>
        )}

        <div className="text-xs text-[#6B7280] bg-[#F7F8F5] rounded-xl px-3 py-2">
          💡 밝고 선명하게, 물건 전체가 나오도록 촬영할수록 인식률이 높아집니다.
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold">인식 결과</div>
              <button
                onClick={() => setOnlyHigh((v) => !v)}
                className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#F7F8F5] text-[#25282D]"
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
                    <div className="truncate text-[18px] font-black text-[#25282D]">{r.name}</div>
                    <div className="mt-0.5 text-[12px] font-semibold leading-snug text-[#6B7280]">
                      정확도 {Math.round(r.confidence * 100)}%
                      {r.note ? <span className="block">{r.note}</span> : null}
                    </div>
                  </div>
                  <span className="shrink-0">
                    {r.confidence >= THRESHOLD ? (
                      <Check className="h-5 w-5 text-[#3E9B78]" />
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
                    className="flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-[13px] font-bold text-[#D95C5C]"
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
          {results.length > 0 && roomMismatch && (
            <div className="rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] px-3 py-2 text-[13px] font-semibold text-[#9A3412]">
              AI는 이 사진을 「{guessedRoom!.name}」으로 판단했습니다. 선택하신 「
              {capturedRoom!.name}」에 저장할까요?
            </div>
          )}
          {results.length > 0 &&
            (roomMismatch ? (
              <div className="flex gap-2">
                <button
                  onClick={() => apply(guessedRoom!.id)}
                  disabled={shown.length === 0}
                  className="flex-1 py-4 rounded-2xl border border-[#E5E7EB] bg-white font-black text-[13.5px] text-[#6B7280] disabled:opacity-50"
                >
                  「{guessedRoom!.name}」으로 변경
                </button>
                <PrimaryButton
                  onClick={() => apply()}
                  className="flex-1"
                  disabled={shown.length === 0}
                >
                  「{capturedRoom!.name}」에 저장
                </PrimaryButton>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setResults([]);
                    setVideoUrl("");
                    setPhotoUrl("");
                  }}
                  className="flex-1 py-4 rounded-2xl border border-[#E5E7EB] font-bold"
                >
                  다시 촬영
                </button>
                <PrimaryButton
                  onClick={() => apply()}
                  className="flex-1"
                  disabled={shown.length === 0}
                >
                  {capturedRoom ? `「${capturedRoom.name}」에 담기` : "담고 다음으로"}
                </PrimaryButton>
              </div>
            ))}
          {/* 스캔은 선택입니다 — 건너뛰어도 5단계에서 직접 담을 수 있습니다 */}
          <button
            onClick={() => {
              tap("soft");
              setScreen("step6");
            }}
            className="w-full py-4 rounded-2xl border border-[#E5E7EB] bg-white font-black text-[15px] text-[#25282D] shadow-[0_4px_0_#F7F8F5] active:translate-y-[2px] active:shadow-none"
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
  const { draft, updateDraft, setScreen, setResultFrom } = useApp();
  const days = useMemo(
    () => storageDays(draft.storageStart, draft.storageEnd),
    [draft.storageStart, draft.storageEnd],
  );
  const storageOn = usesStorage(draft);

  return (
    <MobileShell className="jp-estimate-flow jp-tone-6">
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
              <label className="flex flex-1 items-center gap-3 text-[17px] font-black text-[#25282D]">
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
                className="p-2 text-[#D95C5C]"
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
                <label className="flex items-center gap-2 text-sm font-semibold text-[#25282D]">
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
          className="w-full py-4 rounded-2xl border-2 border-dashed border-[#3578C8] text-[#25282D] font-bold flex items-center justify-center gap-2"
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
            className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-gradient-to-b from-[#F8FAFD] to-white text-base shadow-[inset_0_2px_4px_rgba(15,23,42,0.06)] focus:outline-none focus:border-[#3578C8] resize-none"
          />
        </Card>

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
              <div className="text-sm font-semibold text-[#D95C5C]">
                보관 종료일이 시작일보다 빠릅니다. 날짜를 다시 확인해 주세요.
              </div>
            ) : (
              <div className="text-sm">
                보관 일수: <b>{days}일</b> · 하루 {won(draft.storageDaily)} · 총 보관료:{" "}
                <b className="text-[#25282D]">{won(Math.max(0, days) * draft.storageDaily)}</b>
              </div>
            )}
          </Card>
        )}
      </div>
      <BottomButtonBar>
        <PrimaryButton
          onClick={() => {
            setResultFrom("options");
            setScreen("result");
          }}
        >
          견적 계산 보기
        </PrimaryButton>
      </BottomButtonBar>
    </MobileShell>
  );
}

// ============ Result ============
export function Result() {
  const { draft, setScreen, saveDraft, updateDraft, estimates, finishToHome, resultFrom } =
    useApp();
  /**
   * 견적 상세 상단 뒤로가기 화살표를 누르면 6단계(옵션)로 돌아갑니다.
   * 이후 각 화면의 뒤로가기가 5→4→3→2→1→홈 순으로 이어집니다.
   */
  const backTo = (resultFrom as Screen) || "history";
  const { blocked: entBlocked, entitlement: sendEnt, refresh: refreshEnt } = useEntitlement();
  /** 서버가 알려 준 실제 값으로만 판단합니다 (남은 무료 문자 · 체험 기간) */
  const smsBlocked = entBlocked || sendEnt?.canSendSms === false;
  const smsBlockMessage = sendEnt?.smsMessage ?? TRIAL_EXPIRED_MESSAGE;
  /** 「견적 완료 · 처음으로」 진행 중 — 두 번 눌려도 한 번만 실행됩니다 */
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  /** 하단 「견적 완료」 버튼 저장 진행 중 — 중복 저장을 막습니다 */
  const [completing, setCompleting] = useState(false);
  const [detail, setDetail] = useState(false);
  const [detailEdit, setDetailEdit] = useState(false);
  const [edit, setEdit] = useState(false);
  // 문자발송은 견적서 상세 화면의 「견적서 문자발송」 버튼에서만 실행합니다.
  /** 종이 견적서 화면 */
  const [sheetOpen, setSheetOpen] = useState(false);
  /** 견적서를 열면 먼저 보이는 고객용 표지 화면 (표는 「견적서 보기」에서만) */
  const [sheetEdit, setSheetEdit] = useState(false);
  const [confirmSheet, setConfirmSheet] = useState(false);
  /** 카카오톡 직원 공유 확인창 */
  const [staffShareOpen, setStaffShareOpen] = useState(false);
  const [staffSharing, setStaffSharing] = useState(false);
  const [staffExpires, setStaffExpires] = useState<string | null>(null);
  const [staffPreparedUrl, setStaffPreparedUrl] = useState<string | null>(null);
  const [staffPrepareError, setStaffPrepareError] = useState<string | null>(null);
  /** 기본 업체 정보 저장 중 */
  const [savingDefaults, setSavingDefaults] = useState(false);
  /** 설정에 저장한 상호명 — 견적서 머리글 업체명으로 씁니다(과거 확정 견적은 건드리지 않음) */
  const [sheetCompanyName, setSheetCompanyName] = useState("");

  /**
   * 저장해 둔 기본 업체 정보(담당자·계좌)를 자동으로 채웁니다.
   * 이미 확정하거나 발송한 견적서, 그리고 이미 값이 있는 칸은 그대로 둡니다.
   */
  const defaultsFilled = useRef(false);
  useEffect(() => {
    if (defaultsFilled.current) return;
    let alive = true;
    getCompanyDefaults()
      .then((r) => {
        if (!alive || !r.ok) return;
        defaultsFilled.current = true;
        const d = r.data;
        // 상호명은 확정 여부와 관계없이 설정의 현재 값을 바로 반영합니다.
        setSheetCompanyName(d.companyName.trim());
        // 확정·발송된 견적의 나머지 스냅샷 값은 변경하지 않습니다.
        if (draft.sheetConfirmedAt || draft.termsSentAt) return;
        const patch: Record<string, string> = {};
        // 담당자·연락처가 비어 있으면 설정의 담당자→대표자명, 담당자연락처→업체 연락처 순으로 채웁니다.
        if (!draft.staffName?.trim() && (d.staffName || d.ownerName))
          patch.staffName = d.staffName || d.ownerName;
        if (!draft.staffPhone?.trim() && (d.staffPhone || d.phone))
          patch.staffPhone = d.staffPhone || d.phone;
        if (!draft.bankName?.trim() && d.bankName) patch.bankName = d.bankName;
        if (!draft.bankAccount?.trim() && d.bankAccount) patch.bankAccount = d.bankAccount;
        if (!draft.bankHolder?.trim() && d.bankHolder) patch.bankHolder = d.bankHolder;
        if (Object.keys(patch).length) updateDraft(patch);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id]);

  /** 수정한 업체 정보를 다음 견적서에도 쓰도록 저장합니다 */
  const persistCompanyDefaults = async () => {
    setSavingDefaults(true);
    try {
      const r = await saveCompanyDefaults({
        data: {
          staffName: draft.staffName ?? "",
          staffPhone: draft.staffPhone ?? "",
          bankName: draft.bankName ?? "",
          bankAccount: draft.bankAccount ?? "",
          bankHolder: draft.bankHolder ?? "",
        },
      });
      if (!r.ok) {
        toast.error("업체 정보를 저장하지 못했습니다", {
          description: r.error ?? "알 수 없는 오류",
        });
        return;
      }
      toast.success("담당자·계좌 정보를 기본값으로 저장했습니다");
    } catch (err) {
      console.error("[companyDefaults]", err);
      toast.error("업체 정보 저장 중 오류가 발생했습니다", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSavingDefaults(false);
    }
  };

  /** 캡처할 견적서 영역 */
  const sheetRef = useRef<HTMLDivElement>(null);
  /** 이 견적의 약관 발송·동의 상태 (읽기 전용 — 업체가 대신 동의할 수 없습니다) */
  const [termsStatus, setTermsStatus] = useState<TermsStatusRow | null>(null);
  const [termsLoading, setTermsLoading] = useState(true);
  const loadTermsStatus = () => {
    setTermsLoading(true);
    getTermsStatuses({ data: { estimateId: draft.id } })
      .then((r) => {
        if (!r.ok) return;
        // 같은 견적을 여러 차수로 보냈으면 가장 최근 것을 봅니다
        setTermsStatus(r.rows[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setTermsLoading(false));
  };
  useEffect(() => {
    let alive = true;
    setTermsLoading(true);
    getTermsStatuses({ data: { estimateId: draft.id } })
      .then((r) => {
        if (alive && r.ok) setTermsStatus(r.rows[0] ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setTermsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [draft.id]);

  /** 약관 미리보기(요약)·전체보기 펼침 */
  const [termsPreviewOpen, setTermsPreviewOpen] = useState(false);
  const [termsFullOpen, setTermsFullOpen] = useState(false);

  /** 문자 발송 상태 */
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<EdgeSmsResult | null>(null);
  /** 발송에 필요한데 아직 비어 있는 항목 */
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  /** 고객 화면 미리보기 열림 */
  const [customerPreview, setCustomerPreview] = useState(false);
  /** 이미 보낸 견적서 — 다시 보낼지 물어봅니다 */
  const [askResend, setAskResend] = useState(false);

  /**
   * 실제 발송 — 같은 버튼을 여러 번 눌러도 한 번만 나갑니다.
   *
   * 1) 보내는 순간의 견적서를 서버에 먼저 올립니다 (고객이 볼 원본).
   * 2) 앱은 「어느 견적서인지」만 알려 줍니다.
   *    받는 번호·금액·문자 내용은 서버가 견적서에서 직접 읽어 만듭니다.
   */
  const doSendSms = async (opts?: { resend?: boolean }) => {
    if (sending) return;
    if (smsBlocked) {
      setSendResult({ ok: false, error: smsBlockMessage });
      return;
    }
    // 필수 데이터 검사 — 하나라도 비어 있으면 발송하지 않습니다
    const check = checkSendable(draft, total);
    setMissingFields(check.missing);
    if (!check.ok) {
      setAskResend(false);
      setSendResult({
        ok: false,
        error: "발송에 필요한 정보가 부족합니다.",
      });
      return;
    }
    setMissingFields([]);
    setAskResend(false);
    setSending(true);
    setSendResult(null);
    // 발송 중에는 앱 업데이트 새로고침을 미룹니다 (작업 내용 보호)
    (window as unknown as { __jimpickBusy?: boolean }).__jimpickBusy = true;
    try {
      // 0) 계정 세션이 있는지 먼저 봅니다.
      //    화면에 로그인으로 보여도 계정 세션이 없으면 서버가 막습니다.
      if (!(await hasSession())) {
        setSendResult({
          ok: false,
          needLogin: true,
          error:
            "계정 로그인이 필요합니다. 로그인 화면에서 사장님 계정으로 로그인한 뒤 다시 보내 주세요.",
        });
        setSending(false);
        return;
      }

      // 1) 견적서를 서버에 올려 둡니다. 이것이 있어야 고객이 링크를 열 수 있습니다.
      try {
        const pub = await publishEstimateTerms({
          data: {
            estimateId: draft.id,
            sheetNo: draft.sheetNo ?? undefined,
            sheetVersion: draft.sheetVersion ?? 1,
            customerName: draft.customerName ?? "",
            moveDate: draft.moveDate ?? undefined,
            total,
            contactPhone: draft.phone ?? undefined,
            companyPhone: draft.staffPhone ?? undefined,
            termsName: TERMS_NAME,
            termsVersion: TERMS_VERSION,
            termsEffectiveAt: TERMS_EFFECTIVE_AT,
            accessToken: shareToken(),
            sheetSnapshot: JSON.stringify({
              draft,
              rooms: sheetRooms,
              parts,
              total,
            }).slice(0, 300_000),
          },
        });
        if (!pub.ok) {
          setSendResult({
            ok: false,
            error: `${pub.error ?? "견적서를 서버에 올리지 못했습니다."} 계정 로그인 상태를 확인해 주세요.`,
          });
          setSending(false);
          return;
        }
      } catch (e) {
        setSendResult({
          ok: false,
          error:
            e instanceof Error && /로그인|auth/i.test(e.message)
              ? "로그인이 필요합니다. 설정 화면에서 계정 로그인을 한 뒤 다시 시도해 주세요."
              : "견적서를 서버에 올리지 못해 발송하지 않았습니다.",
        });
        setSending(false);
        return;
      }

      // 2) 발송 요청 — 알리고 키는 서버에만 있습니다.
      //    같은 견적서·같은 차수·같은 번호는 같은 열쇠라 중복 발송이 막힙니다.
      //    사장님이 「다시 발송」을 직접 확인한 경우에만 새 열쇠로 새 기록을 만듭니다.
      const phoneKey = String(draft.phone ?? "").replace(/[^0-9]/g, "");
      const baseKey = `${draft.id}-v${draft.sheetVersion ?? 1}-${phoneKey}`;
      const r = await sendSmsViaEdge({
        estimate_id: draft.id,
        delivery_method: "link",
        idempotency_key: opts?.resend ? `${baseKey}-r${Date.now()}` : baseKey,
        ...(opts?.resend ? { resend: true } : {}),
      });
      setSendResult(r);
      // 이미 나간 발송이면 새로 보내지 않고, 다시 보낼지 물어봅니다
      if (r.alreadySent) setAskResend(true);
      if (r.ok && !r.alreadySent) {
        tap("success");
        updateDraft({
          termsSentAt: Date.now(),
          termsVersion: TERMS_VERSION,
          sheetHistory: [
            ...(draft.sheetHistory ?? []),
            {
              version: draft.sheetVersion ?? 1,
              at: Date.now(),
              staff: draft.staffName || "담당자",
              beforeTotal: total,
              afterTotal: total,
            },
          ],
        });
        saveDraft();
      }
    } catch (e) {
      setSendResult({
        ok: false,
        error: e instanceof Error ? e.message : "문자 발송에 실패했습니다.",
      });
    } finally {
      setSending(false);
      (window as unknown as { __jimpickBusy?: boolean }).__jimpickBusy = false;
      // 서버에 기록된 실제 사용 건수를 다시 읽어 화면 숫자를 맞춥니다.
      void refreshEnt();
    }
  };

  /**
   * 「견적 완료 · 처음으로」
   * 서버에 실제로 저장된 견적인지 확인한 뒤에만 첫 화면으로 갑니다.
   * 저장된 고객정보·견적서·품목·발송내역은 지우지 않습니다.
   */
  const finishAndGoHome = async () => {
    if (finishing) return;
    setFinishing(true);
    setFinishError(null);
    try {
      saveDraft();
      const r = await getTermsStatuses({ data: { estimateId: draft.id } });
      const saved = r.ok && (r.rows ?? []).some((row) => row.estimateId === draft.id);
      if (!saved) {
        setFinishError(
          r.ok
            ? "이 견적이 서버에 저장된 기록을 찾지 못했습니다. 「견적서 문자발송」으로 견적서를 올린 뒤 다시 눌러 주세요."
            : "서버 저장 상태를 확인하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.",
        );
        return;
      }
      setConfirmSheet(false);
      setSheetOpen(false);
      finishToHome();
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : "서버 저장 상태를 확인하지 못했습니다.");
    } finally {
      setFinishing(false);
    }
  };

  /** 문자발송이 실패했을 때만 쓰는 버튼 — 기기에 저장한 뒤 첫 화면으로 */
  const saveAndGoHome = () => {
    if (finishing) return;
    setFinishing(true);
    saveDraft();
    setConfirmSheet(false);
    setSheetOpen(false);
    finishToHome();
  };

  /** 저장 중에는 버튼을 잠급니다 */
  const [exporting, setExporting] = useState<"pdf" | "png" | null>(null);

  /** A4 인쇄 — 대화상자에서 「PDF로 저장」을 고르면 파일이 됩니다 */
  const exportSheet = async () => {
    const el = sheetRef.current;
    if (!el) {
      toast.error("견적서를 먼저 열어 주세요");
      return;
    }
    if (exporting) return;
    if (entBlocked) {
      toast.error(TRIAL_EXPIRED_MESSAGE);
      return;
    }
    setExporting("pdf");
    try {
      await printSheet(el);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "인쇄를 열지 못했습니다");
    } finally {
      setExporting(null);
    }
  };

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

  /**
   * 하단 「견적 완료」 — 현재 견적을 서버(Supabase estimate_drafts)에 실제로 저장한 뒤
   * 저장이 성공한 경우에만 완료 처리(로컬 저장)하고 견적 목록으로 이동합니다.
   *  · 저장/완료 처리 중에는 버튼을 잠가 중복 저장을 막습니다.
   *  · 저장에 실패하면 완료로 표시하지 않고, 입력 내용을 그대로 둔 채 오류를 한글로 보여 주고
   *    다시 시도할 수 있게 합니다.
   */
  const completeEstimate = async () => {
    if (completing) return;
    setCompleting(true);
    try {
      // 저장 순번(revision)은 자동 임시저장과 같은 방식으로 올려, 최신 값이 반영되게 합니다.
      let rev = 0;
      try {
        rev = Number(localStorage.getItem("jimpick.draft.revision") || 0) || 0;
      } catch {
        /* 저장할 수 없는 브라우저는 시간값을 씁니다 */
      }
      const revision = Math.max(rev + 1, Math.floor(Date.now() / 1000));
      try {
        localStorage.setItem("jimpick.draft.revision", String(revision));
      } catch {
        /* 무시 */
      }

      const r = await saveEstimateDraft({
        data: { estimateId: draft.id, payload: JSON.stringify(draft), revision },
      });
      if (!r?.ok) {
        throw new Error(r?.error || "서버 저장에 실패했습니다.");
      }

      // 서버 저장이 성공한 경우에만 완료 상태로 저장(로컬 목록에 반영)합니다.
      saveDraft();
      tap("success");
      toast.success("견적이 저장되었습니다");
      setScreen("history");
    } catch (e) {
      // 실패 시: 완료로 표시하지 않고, 입력 내용은 그대로 두며, 실제 오류를 한글로 보여 줍니다.
      toast.error(
        e instanceof Error && e.message
          ? `저장에 실패했습니다: ${e.message}`
          : "저장에 실패했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
      );
    } finally {
      setCompleting(false);
    }
  };

  // 종이 견적서를 연 동안에는 휴대폰·브라우저 뒤로가기가 목록으로 바로 나가지 않고
  // 견적 요약 화면으로 먼저 돌아가도록, 기록을 하나 쌓고 뒤로가기를 소비해 시트만 닫습니다.
  useEffect(() => {
    if (!sheetOpen) return;
    try {
      window.history.pushState({ jpScreen: "result", jpSheet: true }, "");
    } catch {
      /* 기록을 못 쌓아도 화면 이동은 그대로 합니다 */
    }
    const onPop = () => {
      setSheetOpen(false);
      setSheetEdit(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [sheetOpen]);

  /** 공간별 품목 — 담긴 방만, 담긴 순서대로 */
  const sheetRooms: SheetRoom[] = draft.rooms
    .map((r) => ({
      name: r.name,
      items: Object.entries(r.items).map(([id, qty]) => ({
        id,
        name:
          ITEM_CATALOG.find((c) => c.id === id)?.name ||
          (draft.customItems || []).find((c) => c.id === id)?.name ||
          itemNameById(id) ||
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
  /** 확인창에 보여 줄 문자 미리보기 (서버가 만드는 내용과 같은 형식입니다) */
  const smsPreview = [
    "[JIMPICK 짐픽]",
    `${draft.customerName || "고객"} 고객님, 요청하신 이사 견적서가 도착했습니다.`,
    "아래 링크에서 견적서와 표준약관을 확인해 주세요.",
    ...(draft.staffPhone?.trim() ? ["", `문의: ${draft.staffPhone.trim()}`] : []),
  ].join("\n");

  /**
   * 고객용 보안 토큰.
   * 견적번호를 그대로 쓰면 다른 사람이 주소를 바꿔 볼 수 있으므로
   * 무작위 값을 한 번 만들어 두고 계속 씁니다.
   * 견적서를 고쳐 차수가 올라가면 새 토큰을 만듭니다.
   */
  const shareToken = () => {
    const v = draft.sheetVersion ?? 1;
    if (draft.shareToken && draft.shareTokenVersion === v) return draft.shareToken;
    const buf = new Uint8Array(16);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(buf);
    const token = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
    updateDraft({ shareToken: token, shareTokenVersion: v });
    return token;
  };
  /** 고객이 열어 볼 견적서·약관 주소 */
  const shareUrl = () =>
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/share/${draft.id}?t=${encodeURIComponent(shareToken())}`;

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
      fromEnvText: sideConditionText(draft, "from"),
      toEnvText: sideConditionText(draft, "to"),
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

  /** 직원용 업무 지시서 내용 (금액·계좌·약관 없음) */
  const staffSnapshot = (): StaffSheetSnapshot => ({
    sheetNo: draft.sheetNo ?? "",
    customerName: draft.customerName ?? "",
    customerPhone: draft.phone ?? "",
    moveDate: draft.moveDate ?? "",
    moveTime: draft.moveTime ?? "",
    moveType: String(draft.moveType ?? ""),
    fromAddress: draft.fromAddress ?? "",
    fromDetail: draft.fromDetail ?? "",
    toAddress: draft.toAddress ?? "",
    toDetail: draft.toDetail ?? "",
    fromFloor: draft.fromFloor ?? 0,
    toFloor: draft.toFloor ?? 0,
    workEnv: String(draft.workEnv ?? ""),
    fromEnv: sideConditionText(draft, "from"),
    toEnv: sideConditionText(draft, "to"),
    options: draft.options.filter((o) => o.enabled).map((o) => o.name),
    specialTerms: draft.specialTerms ?? "",
    truckText: [
      draft.truck5t > 0 ? `5톤 트럭 ${draft.truck5t}대` : "",
      draft.truck1t > 0 ? `1톤 트럭 ${draft.truck1t}대` : "",
      draft.ladder > 0 ? `사다리차 ${draft.ladder}대` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    distanceKm: draft.distanceKm ?? 0,
    durationMin: draft.durationMin ?? 0,
    extraWork: [
      ...draft.options.filter((o) => o.enabled).map((o) => o.name),
      draft.ladderFrom ? "사다리차 출발지" : "",
      draft.ladderTo ? "사다리차 도착지" : "",
    ].filter(Boolean),
    note: [draft.memo, draft.sheetNote].filter(Boolean).join("\n"),
    staffName: draft.staffName ?? "",
    staffPhone: draft.staffPhone ?? "",
    rooms: sheetRooms.map((r) => ({
      name: r.name,
      items: r.items.map((i) => ({ name: i.name, qty: i.qty })),
    })),
  });

  /** 공유 버튼을 누른 시점의 실제 견적정보로 만든 카카오톡 본문 (금액·계좌·약관 제외) */
  const staffKakaoLines = (url?: string): string[] =>
    buildStaffKakaoLines({
      customerName: draft.customerName ?? "",
      customerPhone: draft.phone ?? "",
      moveDateText: formatMoveDateTime(draft.moveDate, draft.moveTime),
      moveType: String(draft.moveType ?? ""),
      fromAddress: `${draft.fromAddress ?? ""} ${draft.fromDetail ?? ""}`.trim(),
      fromEnv: sideConditionText(draft, "from"),
      toAddress: `${draft.toAddress ?? ""} ${draft.toDetail ?? ""}`.trim(),
      toEnv: sideConditionText(draft, "to"),
      distanceKm: draft.distanceKm ?? 0,
      durationMin: draft.durationMin ?? 0,
      truckText: [
        draft.truck5t > 0 ? `5톤 트럭 ${draft.truck5t}대` : "",
        draft.truck1t > 0 ? `1톤 트럭 ${draft.truck1t}대` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      ladderText:
        draft.ladder > 0 || draft.ladderFrom || draft.ladderTo
          ? `${Math.max(1, draft.ladder || 0)}대${
              draft.ladderFrom || draft.ladderTo
                ? `(${[draft.ladderFrom && "출발지", draft.ladderTo && "도착지"]
                    .filter(Boolean)
                    .join("·")})`
                : ""
            }`
          : "",
      workers: draft.workers ?? 0,
      kitchenStaff: draft.kitchenStaff ?? 0,
      extraItems: draft.options
        .filter((o) => o.enabled)
        .map((o) => `${o.name} · ${o.separate ? "별도" : won(o.price)}`),
      memo: draft.memo ?? "",
      url,
    });

  /** 확인창을 보는 동안 보안 링크와 카카오 SDK를 준비합니다. */
  const prepareStaffShare = async () => {
    setStaffSharing(true);
    setStaffPreparedUrl(null);
    setStaffPrepareError(null);
    try {
      const [made] = await Promise.all([
        createStaffShare({
          data: {
            estimateId: draft.id,
            staffName: draft.staffName || undefined,
            moveDate: draft.moveDate || undefined,
            shareMethod: "kakao",
            snapshot: JSON.stringify(staffSnapshot()),
          },
        }),
        loadKakaoShareSdk(),
      ]);
      if (!made.ok || !made.token) {
        const message = made.error ?? "직원용 링크를 만들지 못했습니다";
        setStaffPrepareError(message);
        toast.error(message);
        return;
      }
      setStaffExpires(made.expiresAt ?? null);
      setStaffPreparedUrl(`${window.location.origin}/staff/estimate/${made.token}`);
    } catch (err) {
      console.error("[staffSharePrepare]", err);
      setStaffPrepareError("카카오톡 공유를 준비하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setStaffSharing(false);
    }
  };

  /** 준비된 링크로 사용자 클릭 순간 카카오톡 공유창을 엽니다. */
  const doStaffShare = async () => {
    if (!staffPreparedUrl || staffSharing) return;
    setStaffSharing(true);
    try {
      const r = await shareToKakao({
        sheetNo: draft.sheetNo ?? "",
        moveDate: draft.moveDate ?? "",
        maskedCustomer: maskName(draft.customerName ?? ""),
        fromArea: areaOf(draft.fromAddress ?? ""),
        toArea: areaOf(draft.toAddress ?? ""),
        truckText: staffSnapshot().truckText,
        moveType: String(draft.moveType ?? ""),
        staffName: draft.staffName ?? "",
        url: staffPreparedUrl,
        lines: staffKakaoLines(staffPreparedUrl),
      });
      if (!r.ok) {
        toast.error(r.error ?? "공유하지 못했습니다");
        return;
      }
      await markStaffShareShared({ data: { estimateId: draft.id, shareMethod: r.method } });
      setStaffShareOpen(false);
      toast.success(
        r.method === "kakao"
          ? "카카오톡 공유창을 열었습니다"
          : r.method === "web_share"
            ? "공유창을 열었습니다"
            : "직원용 링크를 복사했습니다",
        { description: "전달 여부는 카카오톡에서 확인해 주세요 (금액 미공개)" },
      );
    } catch (err) {
      console.error("[staffShare]", err);
      toast.error("직원 공유 중 오류가 발생했습니다");
    } finally {
      setStaffSharing(false);
    }
  };

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

  return (
    <MobileShell className="jp-estimate-flow">
      <TopBar
        title={backTo === "options" ? "견적 결과" : "견적 상세"}
        onBack={() => {
          // 견적 상세에서 뒤로가기는 6단계(옵션)로 돌아갑니다.
          // 이후 옵션→5단계(공간별 품목)→4단계(차량)→3단계→2단계→1단계→홈
          // 순으로 각 화면의 뒤로가기가 이어집니다.
          setScreen("options");
        }}
      />
      <div className="p-5 space-y-4 flex-1 overflow-auto pb-24">
        <div
          className="rounded-2xl p-6 text-white text-center"
          style={{ background: "linear-gradient(135deg, #0A2A6C 0%, #3578C8 100%)" }}
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
                className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#F7F8F5] text-[#25282D] flex items-center gap-1"
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
                <div className="border-t border-[#E5E7EB] pt-3 space-y-3">
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
                          className="shrink-0 w-10 h-10 rounded-xl border border-[#F3C7C7] text-[#D95C5C] flex items-center justify-center"
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
                    className="w-full py-3 rounded-xl border-2 border-dashed border-[#BFD4FF] text-[#25282D] font-bold text-sm"
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
            <div className="border-t border-[#E5E7EB] pt-2 mt-2 flex justify-between font-bold">
              <span>합계</span>
              <span className="text-[#25282D]">{won(total)}</span>
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
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#F7F8F5] text-[#25282D] flex items-center gap-1"
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
                  onBlur={(e) => syncContractName(draft.id, e.target.value)}
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
                {draft.durationMin ? ` · 약 ${draft.durationMin}분` : ""} ·{" "}
                {workConditionSummary(draft)}
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
        <button
          onClick={openSheet}
          className="w-full py-4 rounded-2xl font-black text-[16px] text-white flex items-center justify-center gap-2 shadow-[0_5px_0_#285C99,0_12px_24px_-10px_rgba(7,81,216,0.5)] active:translate-y-[3px] active:shadow-[0_2px_0_#285C99]"
          style={{ background: "linear-gradient(180deg,#5B93D6 0%,#3578C8 100%)" }}
        >
          <FileText className="w-5 h-5" /> 견적서 확인
        </button>
        <button
          onClick={() => {
            tap("soft");
            saveDraft();
            setStaffExpires(null);
            setStaffPreparedUrl(null);
            setStaffPrepareError(null);
            setStaffShareOpen(true);
            void prepareStaffShare();
          }}
          className="w-full min-h-[56px] py-4 rounded-2xl bg-[#FEE500] text-[#191600] font-black flex items-center justify-center gap-2 shadow-[0_4px_0_#E3CE00] active:translate-y-[2px] active:shadow-[0_2px_0_#E3CE00]"
        >
          <MessageSquare className="w-5 h-5" /> 카카오톡으로 직원 공유
        </button>

        {staffShareOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <div
              className="absolute inset-0 bg-[#25282D]/45"
              onClick={() => !staffSharing && setStaffShareOpen(false)}
            />
            <div className="relative w-full max-w-[330px] rounded-3xl bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.3)]">
              <div className="text-center text-[17px] font-black text-[#25282D]">
                직원에게 이사정보를 보낼까요?
              </div>
              <p className="mt-1.5 text-center text-[12.5px] font-bold text-[#6B7280]">
                금액·계좌·약관은 직원 화면에 표시되지 않습니다.
              </p>
              <div className="mt-3 max-h-[240px] space-y-1 overflow-auto rounded-2xl bg-[#F5F8FE] px-3.5 py-3 text-[13px] font-bold text-[#6B7280]">
                <div className="text-[12px] font-black text-[#25282D]">보낼 내용 미리보기</div>
                {staffKakaoLines().map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-words">
                    {line}
                  </div>
                ))}
                <div className="text-[#6B7280]">상세보기 링크는 공유할 때 새로 만들어집니다</div>
                <div className="text-[#6B7280]">
                  링크 만료{" "}
                  {staffExpires
                    ? new Date(staffExpires).toLocaleString("ko-KR")
                    : "이사 다음 날까지"}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => void doStaffShare()}
                  disabled={staffSharing || !staffPreparedUrl}
                  className="w-full min-h-[56px] rounded-2xl bg-[#FEE500] text-[15px] font-black text-[#191600] shadow-[0_4px_0_#E3CE00] disabled:opacity-50"
                >
                  {staffSharing || !staffPreparedUrl ? "준비 중…" : "카카오톡 열기"}
                </button>
                {staffPrepareError && (
                  <button
                    onClick={() => void prepareStaffShare()}
                    disabled={staffSharing}
                    className="w-full rounded-2xl border border-[#E5E7EB] bg-white py-3 text-[13px] font-black text-[#25282D]"
                  >
                    다시 준비하기
                  </button>
                )}
                <button
                  onClick={() => setStaffShareOpen(false)}
                  disabled={staffSharing}
                  className="w-full rounded-2xl border border-[#E5E7EB] bg-white py-3.5 text-[14px] font-black text-[#6B7280] shadow-[0_3px_0_#F7F8F5] disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {backTo !== "options" && (
          <button
            onClick={() => {
              tap("soft");
              setScreen(backTo);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-gradient-to-b from-white to-[#F7F8F5] px-4 py-3 text-base font-bold text-[#25282D] shadow-[0_3px_0_#E5E7EB,inset_0_1px_0_#fff] transition-transform active:translate-y-[2px] active:shadow-none"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
            {backTo === "customers" ? "고객 목록으로" : "견적 내역으로"}
          </button>
        )}
      </div>

      <BottomButtonBar>
        <PrimaryButton onClick={() => void completeEstimate()} disabled={completing}>
          {completing ? "저장 중…" : "견적 완료"}
        </PrimaryButton>
      </BottomButtonBar>

      {/* 고객용 첫 화면 (견적서 표지 · 표준약관) */}

      {/* 종이 견적서 */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#E9EFF8]">
          <div className="flex items-center gap-2 border-b border-[#E5E7EB] bg-white px-4 py-3">
            <button
              onClick={() => {
                setSheetOpen(false);
                setSheetEdit(false);
                // 시트를 열 때 쌓아 둔 뒤로가기 기록을 정리합니다 (스택이 어긋나지 않게)
                try {
                  window.history.back();
                } catch {
                  /* 기록 정리에 실패해도 화면은 이미 닫혔습니다 */
                }
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white shadow-[0_3px_0_#F7F8F5]"
              aria-label="닫기"
            >
              <ChevronLeft className="h-5 w-5 text-[#6B7280]" />
            </button>
            <div className="text-[16px] font-black text-[#25282D]">
              {sheetEdit ? "견적서 수정" : "이사 견적서"}
            </div>
            {draft.sheetConfirmedAt && (
              <span className="rounded-full bg-[#E7F3EE] px-2 py-0.5 text-[11px] font-black text-[#3E9B78]">
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
                    onBlur={(e) => syncContractName(draft.id, e.target.value)}
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
                {/* 예약금(계약금)을 넣으면 남은 잔금을 바로 보여 줍니다 */}
                <div className="flex items-center justify-between rounded-2xl bg-[#F7F8F5] px-4 py-3">
                  <span className="text-sm font-bold text-[#6B7280]">잔금 (총액 − 예약금)</span>
                  <span className="text-[17px] font-black text-[#25282D]">
                    {won(Math.max(0, total - (draft.deposit ?? 0)))}
                  </span>
                </div>
                <Field label="담당자 이름">
                  <TextInput
                    value={draft.staffName ?? ""}
                    placeholder="예: 김용달"
                    onChange={(e) => updateDraft({ staffName: e.target.value })}
                  />
                </Field>
                <Field label="담당자 연락처">
                  <TextInput
                    value={draft.staffPhone ?? ""}
                    placeholder="예: 010-7566-2542"
                    onChange={(e) => updateDraft({ staffPhone: e.target.value })}
                  />
                </Field>
                <Field label="입금 은행">
                  <TextInput
                    value={draft.bankName ?? ""}
                    placeholder="예: 국민은행"
                    onChange={(e) => updateDraft({ bankName: e.target.value })}
                  />
                </Field>
                <Field label="계좌번호">
                  <TextInput
                    value={draft.bankAccount ?? ""}
                    placeholder="예: 123456-01-234567"
                    onChange={(e) => updateDraft({ bankAccount: e.target.value })}
                  />
                </Field>
                <Field label="예금주">
                  <TextInput
                    value={draft.bankHolder ?? ""}
                    placeholder="예: 짐픽이사"
                    onChange={(e) => updateDraft({ bankHolder: e.target.value })}
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
                  품목과 수량은 5단계 「공간별 품목」에서, 차량·옵션은 앞 단계에서 고치면 견적서에
                  바로 반영됩니다. 고객이 처음 넣은 신청 정보는 그대로 남습니다.
                </p>
              </div>
            ) : (
              <EstimateSheet
                ref={sheetRef}
                draft={draft}
                rooms={sheetRooms}
                parts={parts}
                total={total}
                companyName={sheetCompanyName}
                companyPhone={draft.staffPhone ?? ""}
                acceptedAt={termsStatus?.acceptedAt ?? null}
                acceptedSheetVersion={termsStatus?.acceptedSheetVersion ?? null}
                acceptedTermsVersion={termsStatus?.acceptedTermsVersion ?? null}
              />
            )}
          </div>

          <div className="border-t border-[#E5E7EB] bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
                    void persistCompanyDefaults();
                  }
                  setSheetEdit((v) => !v);
                }}
                disabled={savingDefaults}
                className="rounded-2xl border border-[#E5E7EB] bg-white py-3 text-[13.5px] font-black text-[#25282D] shadow-[0_3px_0_#F7F8F5] disabled:opacity-60"
              >
                {sheetEdit ? (savingDefaults ? "저장 중…" : "수정 완료") : "견적서 수정"}
              </button>
              <button
                onClick={() => void exportSheet()}
                disabled={!!exporting || sheetEdit}
                className="col-span-2 rounded-2xl border border-[#E5E7EB] bg-white py-3 text-[13.5px] font-black text-[#25282D] shadow-[0_3px_0_#F7F8F5] disabled:opacity-50"
              >
                {exporting ? "여는 중…" : "A4 인쇄 · PDF 저장"}
              </button>
            </div>
            {smsBlocked ? (
              <div className="mt-2 rounded-2xl border border-[#FCA5A5] bg-[#FBEAEA] p-4">
                <div className="text-[13px] font-black text-[#D95C5C] break-keep">
                  {smsBlockMessage}
                </div>
                <button
                  onClick={() => setScreen("subscription")}
                  className="mt-3 w-full rounded-xl bg-[#3578C8] py-3 text-[14px] font-black text-white"
                >
                  구독하기
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    tap("soft");
                    setConfirmSheet(true);
                  }}
                  disabled={!!exporting}
                  className="mt-2 w-full rounded-2xl bg-gradient-to-b from-[#5B93D6] to-[#3578C8] py-4 text-[15px] font-black text-white shadow-[0_4px_0_#285C99] disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" /> 견적서 문자발송
                  </span>
                </button>
                {sendEnt?.freeSmsLimited && (
                  <div className="mt-2 text-center text-[12px] font-bold text-[#6B7280] break-keep">
                    무료 문자 {sendEnt.freeSmsUsed}/{sendEnt.freeSmsLimit}건 사용 ·{" "}
                    {sendEnt.freeSmsRemaining}건 남음
                  </div>
                )}
              </>
            )}
          </div>

          {/* 발송 전 확인 */}
          {confirmSheet && (
            <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
              <div
                className="absolute inset-0 bg-[#25282D]/45"
                onClick={() => setConfirmSheet(false)}
              />
              <div className="relative max-h-[86vh] w-full max-w-[340px] overflow-y-auto rounded-3xl bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.3)]">
                <div className="text-center text-[17px] font-black text-[#25282D]">
                  실제 유료 문자가 발송됩니다. 내용을 확인하셨습니까?
                </div>
                {/* 무엇이 나가는지 그대로 보여 줍니다 */}
                <div className="mt-3 space-y-1.5 rounded-2xl bg-[#F7F8F5] p-3 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-[13px] text-[#6B7280]">받는 고객</span>
                    <span className="min-w-0 break-words text-right text-[13px] font-bold text-[#25282D]">
                      {draft.customerName || "고객"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-[13px] text-[#6B7280]">받는 번호</span>
                    <span className="min-w-0 break-words text-right text-[13px] font-bold text-[#25282D]">
                      {draft.phone || "번호 없음"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-[13px] text-[#6B7280]">문자 방식</span>
                    <span className="min-w-0 text-right text-[13px] font-bold text-[#25282D]">
                      링크 문자 (LMS)
                    </span>
                  </div>
                  <div>
                    <div className="text-[13px] text-[#6B7280]">문자 내용</div>
                    <div className="mt-1 whitespace-pre-wrap break-words rounded-xl bg-white p-2.5 text-[12.5px] font-medium leading-relaxed text-[#25282D]">
                      {smsPreview}
                    </div>
                  </div>
                  <div>
                    <div className="text-[13px] text-[#6B7280]">보안 링크</div>
                    <div className="mt-1 break-all rounded-xl bg-white p-2.5 text-[12px] font-medium text-[#25282D]">
                      {shareUrl()}
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-[13px] text-[#6B7280]">견적 금액</span>
                    <span className="min-w-0 text-right text-[13px] font-bold text-[#25282D]">
                      {won(total)}
                    </span>
                  </div>
                </div>

                <p className="mt-2.5 rounded-xl bg-[#FFF7ED] p-2.5 text-center text-[12.5px] font-bold text-[#B45309]">
                  실제 문자 요금이 발생합니다. 알리고 충전금에서 차감됩니다.
                </p>

                {/* 고객이 실제로 받게 될 화면을 지금 견적서 그대로 보여 줍니다 */}
                <button
                  onClick={() => setCustomerPreview(true)}
                  className="mt-2.5 w-full rounded-2xl border border-[#E5E7EB] bg-white py-3 text-[13.5px] font-black text-[#25282D] shadow-[0_3px_0_#F7F8F5]"
                >
                  고객 화면 미리보기
                </button>

                {/* 빠진 필수 항목 — 있으면 발송하지 않습니다 */}
                {missingFields.length > 0 && (
                  <div className="mt-3 rounded-2xl bg-[#FBEAEA] px-3 py-2.5 text-left text-[12.5px] font-bold leading-relaxed text-[#D95C5C]">
                    발송에 필요한 정보가 부족합니다.
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                      {missingFields.map((m) => (
                        <li key={m.label}>{m.label}</li>
                      ))}
                    </ul>
                    <div className="mt-2 space-y-1.5">
                      {Array.from(new Map(missingFields.map((m) => [m.screen, m])).values()).map(
                        (m) => (
                          <button
                            key={m.screen}
                            onClick={() => {
                              setConfirmSheet(false);
                              setSheetOpen(false);
                              if (m.screen !== "result") setScreen(m.screen);
                            }}
                            className="block w-full rounded-xl bg-[#3578C8] py-2.5 text-[13px] font-black text-white"
                          >
                            {m.screenLabel} 화면으로 이동
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {/* 이미 보낸 견적서 — 사장님이 직접 확인해야 다시 나갑니다 */}
                {askResend && (
                  <div className="mt-3 rounded-2xl bg-[#FFF7ED] px-3 py-2.5 text-left text-[12.5px] font-bold leading-relaxed text-[#B45309]">
                    이미 발송한 견적서입니다. 다시 발송하시겠습니까?
                    <button
                      onClick={() => void doSendSms({ resend: true })}
                      disabled={sending}
                      className="mt-2 block w-full rounded-xl bg-[#B45309] py-2.5 text-[13px] font-black text-white disabled:opacity-60"
                    >
                      {sending ? "보내는 중…" : "네, 다시 발송합니다"}
                    </button>
                  </div>
                )}

                {/* 발송 결과 */}
                {sendResult && (
                  <div
                    className={`mt-3 rounded-2xl px-3 py-2.5 text-left text-[12.5px] font-bold leading-relaxed ${
                      sendResult.ok ? "bg-[#E7F3EE] text-[#3E9B78]" : "bg-[#FBEAEA] text-[#D95C5C]"
                    }`}
                  >
                    {sendResult.ok ? (
                      <>
                        견적서가 {draft.customerName || "고객"} 고객님께 발송되었습니다.
                        <br />
                        발송번호 {sendResult.msgId || "-"} · {sendResult.msgType || "SMS"}
                        <br />
                        {new Date(sendResult.sentAt ?? Date.now()).toLocaleString("ko-KR")} ·{" "}
                        {`****${digitsTail(draft.phone)}`}
                      </>
                    ) : (
                      <>
                        발송 실패 — {sendResult.error}
                        {sendResult.needLogin && (
                          <button
                            onClick={() => {
                              setConfirmSheet(false);
                              setScreen("login");
                            }}
                            className="mt-2 block w-full rounded-xl bg-[#3578C8] py-2.5 text-[13px] font-black text-white"
                          >
                            로그인 화면으로 가기
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* 저장 확인에 실패했을 때 실제 이유를 보여 줍니다 */}
                {finishError && (
                  <div className="mt-3 rounded-2xl bg-[#FBEAEA] px-3 py-2.5 text-left text-[12.5px] font-bold leading-relaxed text-[#D95C5C]">
                    {finishError}
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  {/* 발송이 성공한 뒤에만 첫 화면으로 가는 큰 버튼을 보여 줍니다 */}
                  {sendResult?.ok && (
                    <button
                      onClick={() => void finishAndGoHome()}
                      disabled={finishing}
                      className="w-full rounded-2xl bg-[#3578C8] py-4 text-[16px] font-black text-white shadow-[0_4px_0_#064AA6] disabled:opacity-60"
                    >
                      {finishing ? "확인 중…" : "견적 완료 · 처음으로"}
                    </button>
                  )}
                  {/* 발송 실패 — 임시 데이터를 지우거나 자동으로 이동하지 않습니다 */}
                  {sendResult && !sendResult.ok && (
                    <button
                      onClick={saveAndGoHome}
                      disabled={sending || finishing}
                      className="w-full rounded-2xl border border-[#E5E7EB] bg-white py-3.5 text-[14px] font-black text-[#6B7280] shadow-[0_3px_0_#F7F8F5] disabled:opacity-50"
                    >
                      저장 후 처음으로
                    </button>
                  )}
                  <PrimaryButton
                    onClick={() => {
                      // 확정: 지금 금액·품목을 그대로 얼려 둡니다
                      if (!draft.sheetConfirmedAt) {
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
                      }
                      void doSendSms();
                    }}
                    disabled={sending}
                  >
                    {sending
                      ? "보내는 중…"
                      : sendResult && !sendResult.ok
                        ? "다시 발송"
                        : "실제 문자발송"}
                  </PrimaryButton>
                  <button
                    onClick={() => {
                      setConfirmSheet(false);
                      setSendResult(null);
                    }}
                    disabled={sending}
                    className="w-full rounded-2xl border border-[#E5E7EB] bg-white py-3.5 font-black text-[14px] text-[#6B7280] shadow-[0_3px_0_#F7F8F5] disabled:opacity-50"
                  >
                    {sendResult?.ok ? "닫기" : "취소"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 고객 화면 미리보기 — 지금 발송할 견적서 그대로 (관리자 안내는 감춥니다) */}
          {customerPreview && (
            <div className="absolute inset-0 z-20 flex flex-col bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-[#E5EAF2] px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-black text-[#25282D]">고객 화면 미리보기</div>
                  <div className="text-[12px] text-[#6B7280]">
                    {draft.sheetNo || draft.id} · {draft.sheetVersion ?? 1}차 · 약관 {TERMS_VERSION}
                  </div>
                </div>
                <button
                  onClick={() => setCustomerPreview(false)}
                  className="shrink-0 rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px] font-black text-[#6B7280]"
                >
                  닫기
                </button>
              </div>
              <div className="flex-1 overflow-y-auto bg-white px-3 py-3">
                <EstimateSheet
                  draft={draft}
                  rooms={sheetRooms}
                  parts={parts}
                  total={total}
                  companyName={sheetCompanyName}
                  companyPhone={draft.staffPhone ?? ""}
                  acceptedAt={termsStatus?.acceptedAt ?? null}
                  acceptedSheetVersion={termsStatus?.acceptedSheetVersion ?? null}
                  acceptedTermsVersion={termsStatus?.acceptedTermsVersion ?? null}
                  forCustomer
                  showTerms
                />
              </div>
            </div>
          )}
        </div>
      )}
    </MobileShell>
  );
}

// ============ History ============
export function History() {
  const { estimates, setScreen, loadEstimate, deleteEstimate } = useApp();
  const [q, setQ] = useState("");
  const [termsRows, setTermsRows] = useState<TermsStatusRow[]>([]);
  /** 사장님 예약확정 알림 문자 발송 기록 */
  const [noticeRows, setNoticeRows] = useState<ManagerNoticeRow[]>([]);
  const [resending, setResending] = useState<string | null>(null);
  /** 업체 계약완료 저장 중인 견적 id */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  /** 카드별 '기록 보기' 펼침 상태 (기본은 접힘 → 목록이 짧게 보입니다) */
  const [openLog, setOpenLog] = useState<Record<string, boolean>>({});
  const toggleLog = (id: string) => setOpenLog((p) => ({ ...p, [id]: !p[id] }));
  /** 카드 전체 펼침 상태 (기본 접힘 → 금액까지만 보임, 누르면 펼쳐짐) */
  const [openCard, setOpenCard] = useState<Record<string, boolean>>({});
  const toggleCard = (id: string) => setOpenCard((p) => ({ ...p, [id]: !p[id] }));
  const loadNotices = () => {
    getManagerNotices()
      .then((r) => {
        if (r.ok) setNoticeRows(r.rows);
      })
      .catch(() => {});
  };
  const loadTerms = () => {
    getTermsStatuses({ data: {} })
      .then((r) => {
        if (r.ok) setTermsRows(r.rows);
      })
      .catch(() => {});
  };

  useEffect(() => {
    let alive = true;
    getTermsStatuses({ data: {} })
      .then((r) => {
        if (alive && r.ok) setTermsRows(r.rows);
      })
      .catch(() => {});
    getManagerNotices()
      .then((r) => {
        if (alive && r.ok) setNoticeRows(r.rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  /** 이 견적의 사장님 알림 기록 (가장 최근) */
  const noticeOf = (id: string) => noticeRows.find((n) => n.estimateId === id) ?? null;
  /** 사장님이 직접 계약완료 처리 — 서버 저장이 성공한 뒤에만 계약완료로 보여 줍니다 */
  const doOwnerConfirm = async (e: Estimate) => {
    if (confirmingId) return;
    const date = (e.moveDate ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error("이사 날짜를 먼저 입력해 주세요.");
      return;
    }
    if (!window.confirm(`${e.customerName || "고객"} · ${date} 계약완료로 저장할까요?`)) return;
    setConfirmingId(e.id);
    try {
      const r = await ownerConfirmContract({
        data: {
          estimateId: e.id,
          moveDate: date,
          customerName: e.customerName ?? "",
          total: Math.max(0, Math.round(Number(e.total ?? 0))),
          sheetNo: e.sheetNo ?? null,
          sheetVersion: Number(e.sheetVersion ?? 1) || 1,
          estimateSnapshot: JSON.stringify({ draft: e }).slice(0, 300_000),
          contactPhone: e.phone ?? null,
        },
      });
      if (r.ok) {
        toast.success(r.duplicate ? "이미 계약완료된 건입니다" : "계약완료로 저장했습니다");
        loadTerms();
      } else {
        toast.error(r.error ?? "계약완료를 저장하지 못했습니다.");
      }
    } catch {
      toast.error("계약완료를 저장하지 못했습니다. 통신 상태를 확인해 주세요.");
    } finally {
      setConfirmingId(null);
    }
  };
  const doResend = async (id: string) => {
    if (resending) return;
    setResending(id);
    try {
      const r = await resendManagerNotice(id);
      if (r.ok) toast.success("사장님 알림 문자를 발송했습니다");
      else toast.error("사장님 알림 발송 실패", { description: r.error ?? "알 수 없는 오류" });
    } finally {
      setResending(null);
      loadNotices();
    }
  };
  const list = estimates.filter(
    (e) => !q || e.customerName.includes(q) || e.phone.includes(q) || e.moveDate.includes(q),
  );
  /** 약관 진행 상태 — 발송 성공과 고객 열람·동의는 서로 다른 상태로 표시합니다 */
  const termsState = (id: string) => {
    const r = termsRows.find((t) => t.estimateId === id);
    if (!r)
      return {
        text: "약관 미발송",
        tone: "bg-[#F3F4F6] text-[#6B7280]",
        row: null as TermsStatusRow | null,
      };
    if (r.acceptedAt)
      return { text: "고객 동의 완료 · 예약 확정", tone: "bg-[#E7F3EE] text-[#3E9B78]", row: r };
    if (r.termsViewedAt)
      return { text: "고객 약관 확인", tone: "bg-[#FEF3C7] text-[#B45309]", row: r };
    if (r.firstViewedAt || r.viewedAt)
      return { text: "고객 열람", tone: "bg-[#FEF3C7] text-[#B45309]", row: r };
    return { text: "약관 발송 완료", tone: "bg-[#F7F8F5] text-[#25282D]", row: r };
  };

  return (
    <MobileShell>
      <TopBar title="견적 내역" onBack={() => setScreen("home")} />
      <div className="p-4 space-y-3 flex-1 overflow-auto pb-24">
        <TextInput
          placeholder="고객명·연락처·날짜 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {list.length === 0 && (
          <div className="text-center text-[#6B7280] py-16">저장된 견적이 없습니다.</div>
        )}
        {list.map((e) => {
          const ts = termsState(e.id);
          return (
            <Card key={e.id}>
              {(() => {
                const open = !!openCard[e.id];
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleCard(e.id)}
                      className="w-full text-left"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold">{e.customerName || "이름 없음"}</div>
                          <div className="text-xs text-[#6B7280]">{e.phone}</div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-[#F7F8F5] text-[#25282D] font-semibold">
                          {e.status}
                        </span>
                      </div>
                      <div className="text-sm text-[#6B7280] mt-2">
                        {e.moveDate || "-"} · {e.fromAddress || "?"} → {e.toAddress || "?"}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-lg font-black text-[#25282D]">{won(e.total)}</span>
                        <span className="text-[13px] font-bold text-[#94A3B8]">
                          {open ? "닫기 ▲" : "자세히 ▾"}
                        </span>
                      </div>
                    </button>
                    {open && (
                      <>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[13px] px-2 py-1 rounded-full font-semibold ${ts.tone}`}
                          >
                            {ts.text}
                          </span>
                          {ts.row && (
                            <span className="text-xs text-[#6B7280]">
                              약관 {ts.row.termsVersion}
                              {ts.row.acceptedAt
                                ? ` · 동의 ${new Date(ts.row.acceptedAt).toLocaleString("ko-KR")}`
                                : ""}
                            </span>
                          )}
                        </div>
                        {/* 업체(사장님) 직접 계약완료 — 고객 웹 동의가 없어도 달력에 계약으로 표시됩니다 */}
                        {!ts.row?.acceptedAt && (
                          <button
                            type="button"
                            disabled={confirmingId === e.id}
                            onClick={() => doOwnerConfirm(e)}
                            className="mt-2 w-full rounded-xl bg-[#3578C8] py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
                          >
                            {confirmingId === e.id ? "저장 중…" : "계약완료로 표시 (업체 확정)"}
                          </button>
                        )}
                        {ts.row?.acceptedAt && (
                          <div className="mt-2 rounded-xl bg-[#EAF2FC] px-3 py-2 text-[12.5px] font-bold text-[#1D4ED8]">
                            계약완료 · 달력에 표시됩니다
                          </div>
                        )}
                        {ts.row &&
                          (() => {
                            const n = noticeOf(e.id);
                            const sent = n?.status === "sent" || n?.status === "success";
                            const open = !!openLog[e.id];
                            const summary = [
                              ts.row.viewCount
                                ? `열람 ${ts.row.viewCount}회`
                                : ts.row.firstViewedAt
                                  ? "열람함"
                                  : "미열람",
                              ts.row.acceptedAt ? "예약 확정" : null,
                              ts.row.acceptedAt
                                ? sent
                                  ? "알림 발송"
                                  : n
                                    ? "알림 실패"
                                    : null
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ");
                            return (
                              <div className="mt-2">
                                <button
                                  onClick={() => toggleLog(e.id)}
                                  className="flex w-full items-center justify-between rounded-xl bg-[#F7F8F5] px-3 py-2 text-[12.5px] font-bold text-[#6B7280]"
                                >
                                  <span className="truncate">{summary}</span>
                                  <span className="ml-2 shrink-0 text-[#6B7280]">
                                    {open ? "닫기" : "기록 보기"}
                                  </span>
                                </button>
                                {open && (
                                  <div className="mt-2 space-y-2">
                                    {ts.row.acceptedAt && (
                                      <div className="rounded-xl bg-[#F7F8F5] p-2.5">
                                        <div className="text-[12.5px] font-bold text-[#6B7280]">
                                          사장님 알림 문자{" "}
                                          {sent ? (
                                            <span className="text-[#3E9B78]">
                                              발송 완료 {n?.toMasked ? `(${n.toMasked})` : ""}
                                              {n?.sentAt
                                                ? ` · ${new Date(n.sentAt).toLocaleString("ko-KR")}`
                                                : ""}
                                            </span>
                                          ) : n ? (
                                            <span className="text-[#D95C5C]">발송 실패</span>
                                          ) : (
                                            <span className="text-[#6B7280]">기록 없음</span>
                                          )}
                                        </div>
                                        {!sent && n?.errorMessage && (
                                          <div className="mt-1 text-[12px] font-semibold text-[#D95C5C]">
                                            {n.errorMessage}
                                          </div>
                                        )}
                                        {!sent && (
                                          <button
                                            onClick={() => doResend(e.id)}
                                            disabled={resending === e.id}
                                            className="mt-2 w-full rounded-xl bg-[#F7F8F5] py-2 text-[13px] font-bold text-[#25282D] disabled:opacity-50"
                                          >
                                            {resending === e.id
                                              ? "발송 중…"
                                              : "사장님 알림 다시 보내기"}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                    <div className="rounded-xl bg-[#F7F8F5] p-2.5 text-[12.5px] text-[#6B7280]">
                                      <div className="font-bold">고객 열람 기록</div>
                                      <div className="mt-0.5 text-[#6B7280]">
                                        {ts.row.firstViewedAt
                                          ? `최초 열람 ${new Date(ts.row.firstViewedAt).toLocaleString("ko-KR")}`
                                          : "아직 열지 않았습니다"}
                                      </div>
                                      {ts.row.lastViewedAt && (
                                        <div className="text-[#6B7280]">
                                          최근 열람{" "}
                                          {new Date(ts.row.lastViewedAt).toLocaleString("ko-KR")} ·
                                          열람 {ts.row.viewCount}회
                                        </div>
                                      )}
                                      {ts.row.termsViewedAt && (
                                        <div className="text-[#6B7280]">
                                          약관 확인{" "}
                                          {new Date(ts.row.termsViewedAt).toLocaleString("ko-KR")}
                                        </div>
                                      )}
                                      {ts.row.acceptedAt && (
                                        <div className="font-semibold text-[#3E9B78]">
                                          예약 확정{" "}
                                          {new Date(ts.row.acceptedAt).toLocaleString("ko-KR")}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        {ts.row && (
                          <DepositPanel
                            estimateId={e.id}
                            customerName={e.customerName}
                            total={e.total}
                          />
                        )}
                        {ts.row && (
                          <PaymentPanel
                            estimateId={e.id}
                            total={e.total}
                            row={ts.row}
                            onSaved={loadTerms}
                          />
                        )}
                        {ts.row && <ReminderPanel estimateId={e.id} />}

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => loadEstimate(e.id)}
                            className="flex-1 py-2 rounded-xl bg-[#F7F8F5] text-[#25282D] text-sm font-semibold"
                          >
                            상세 보기
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("삭제하시겠습니까?")) deleteEstimate(e.id);
                            }}
                            className="px-3 py-2 rounded-xl bg-[#FBEAEA] text-[#D95C5C]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCard(e.id)}
                          className="mt-2 w-full py-2 text-[13px] font-bold text-[#94A3B8]"
                        >
                          닫기 ▲
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
            </Card>
          );
        })}
      </div>
      <BottomNav />
    </MobileShell>
  );
}

// ============ Customers ============
export function Customers() {
  const { estimates, setScreen, loadEstimate } = useApp();
  const [q, setQ] = useState("");
  const map = new Map<
    string,
    { id: string; name: string; phone: string; last: number; count: number; lastAmount: number }
  >();
  for (const e of estimates) {
    if (!e.phone) continue;
    const k = e.phone;
    const cur = map.get(k);
    if (!cur || e.createdAt > cur.last) {
      map.set(k, {
        id: e.id,
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
      <TopBar title="고객 관리" onBack={() => setScreen("home")} />
      <div className="p-4 space-y-3 flex-1 overflow-auto pb-24">
        <TextInput placeholder="고객 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        {list.length === 0 && (
          <div className="text-center text-[#6B7280] py-16">고객 정보가 없습니다.</div>
        )}
        {list.map((c) => (
          // 카드를 누르면 이 고객의 최근 견적서를 바로 엽니다
          <Card
            key={c.phone}
            onClick={() => {
              tap("soft");
              loadEstimate(c.id);
            }}
            className="cursor-pointer active:scale-[0.99]"
          >
            <div className="flex justify-between">
              <div>
                <div className="font-bold">{c.name}</div>
                <div className="text-xs text-[#6B7280]">{c.phone}</div>
                <div className="text-xs text-[#6B7280] mt-1">
                  최근: {new Date(c.last).toLocaleDateString("ko-KR")} · {c.count}회
                </div>
                <div className="text-[11px] font-bold text-[#25282D] mt-1">눌러서 견적서 보기</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-[#25282D]">{won(c.lastAmount)}</div>
                <div className="flex gap-1 mt-2">
                  {/* 전화·문자는 카드 열기와 겹치지 않게 클릭 전파를 막습니다 */}
                  <a
                    href={`tel:${c.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 bg-[#F7F8F5] rounded-lg"
                  >
                    <Phone className="w-4 h-4 text-[#25282D]" />
                  </a>
                  <a
                    href={`sms:${c.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 bg-[#F7F8F5] rounded-lg"
                  >
                    <MessageSquare className="w-4 h-4 text-[#25282D]" />
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
/**
 * 사업자 정보 수정·저장 카드.
 * 로그인한 사장님의 Supabase 프로필(profiles)에 저장하며,
 * 사업자등록증은 비공개 Storage 버킷에 올립니다.
 */
function BusinessInfoCard({ onNeedLogin }: { onNeedLogin: () => void }) {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [bizNo, setBizNo] = useState(""); // 숫자만 보관
  const [certPath, setCertPath] = useState("");

  // 새로 고른 파일(저장 시 업로드) — 취소 시 버려집니다.
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    try {
      const r = await getCompanyDefaults();
      if (r.ok) {
        setCompanyName(r.data.companyName);
        setOwnerName(r.data.ownerName);
        setPhone(r.data.phone);
        setBizNo((r.data.businessNumber || "").replace(/[^0-9]/g, ""));
        setCertPath(r.data.certPath);
      }
    } catch {
      /* 세션 준비 전 — 편집 시작할 때 다시 시도됩니다 */
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const startEdit = () => {
    setFileError("");
    setPickedFile(null);
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setPickedFile(null);
    setFileError("");
    if (fileRef.current) fileRef.current.value = "";
    void load(); // 저장하지 않은 입력은 되돌립니다
  };

  const pickFile = (e: ReactChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFileError("");
    if (!f) {
      setPickedFile(null);
      return;
    }
    const invalid = validateCertFile(f);
    if (invalid) {
      setFileError(invalid);
      setPickedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setPickedFile(f);
  };

  const viewCert = async () => {
    const url = await certSignedUrl(certPath);
    if (!url) {
      toast.error("사업자등록증을 여는 데 실패했습니다. 다시 로그인했는지 확인해 주세요.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const save = async () => {
    if (saving) return; // 중복 저장 방지
    if (bizNo && !isValidBusinessNumber(bizNo)) {
      toast.error("사업자등록번호는 숫자 10자리로 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      // 1) 새 파일이 있으면 먼저 비공개 버킷에 업로드하고 경로를 받습니다.
      let nextCertPath = certPath;
      if (pickedFile) {
        const up = await uploadCert(pickedFile, certPath || null);
        if (!up.ok || !up.path) {
          if (/로그인/.test(up.error ?? "")) onNeedLogin();
          toast.error("사업자등록증 업로드에 실패했습니다", {
            description: up.error ?? "알 수 없는 오류",
          });
          return; // 실패 시 성공으로 표시하지 않습니다
        }
        nextCertPath = up.path;
      }

      // 2) 프로필(profiles)에 저장 — 넘긴 항목만 갱신됩니다.
      const r = await saveCompanyDefaults({
        data: {
          companyName,
          ownerName,
          phone,
          businessNumber: bizNo,
          certPath: nextCertPath,
        },
      });
      if (!r.ok) {
        toast.error("사업자 정보를 저장하지 못했습니다", {
          description: r.error ?? "알 수 없는 오류",
        });
        return;
      }

      setCertPath(nextCertPath);
      setPickedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setEditing(false);
      toast.success("사업자 정보를 저장했습니다");
    } catch (err) {
      toast.error("저장 중 오류가 발생했습니다", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-bold">사업자 정보</div>
        {!editing && (
          <button
            onClick={startEdit}
            disabled={loading}
            className="text-sm font-bold text-[#25282D] disabled:opacity-50"
          >
            사업자 정보 수정
          </button>
        )}
      </div>

      <Field label="상호명">
        <TextInput
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          disabled={!editing}
          placeholder="예: 짐픽 이사"
        />
      </Field>
      <Field label="대표자명">
        <TextInput
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          disabled={!editing}
          placeholder="예: 홍길동"
        />
      </Field>
      <Field label="연락처">
        <TextInput
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={!editing}
          placeholder="010-0000-0000"
        />
      </Field>
      <Field label="사업자등록번호">
        {editing ? (
          <TextInput
            value={bizNo}
            inputMode="numeric"
            onChange={(e) => setBizNo(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
            placeholder="숫자 10자리 (예: 1234567890)"
          />
        ) : (
          <TextInput
            value={bizNo ? formatBusinessNumber(bizNo) : ""}
            disabled
            placeholder="미입력"
          />
        )}
      </Field>

      <div className="space-y-1.5">
        <div className="text-sm font-semibold text-[#6B7280]">사업자등록증</div>
        {certPath ? (
          <button onClick={viewCert} className="text-sm font-bold text-[#25282D] underline">
            등록된 사업자등록증 보기
          </button>
        ) : (
          <div className="text-sm text-[#9AA3AF]">등록된 파일 없음</div>
        )}
        {editing && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={pickFile}
              className="block w-full text-sm text-[#6B7280] file:mr-3 file:rounded-lg file:border-0 file:bg-[#F7F8F5] file:px-3 file:py-2 file:text-[#25282D] file:font-bold"
            />
            <div className="text-xs text-[#9AA3AF]">JPG · PNG · PDF, 10MB 이하 · 비공개 저장</div>
            {pickedFile && <div className="text-xs text-[#3E9B78]">선택됨: {pickedFile.name}</div>}
            {fileError && <div className="text-xs font-bold text-[#D95C5C]">{fileError}</div>}
          </>
        )}
      </div>

      {editing && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={cancelEdit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-white border border-[#E5E7EB] font-bold disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#3578C8] text-white font-bold disabled:opacity-60"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      )}
    </Card>
  );
}

export function SettingsScreen() {
  const { logout, setScreen, draft } = useApp();
  const { entitlement: settingsEnt } = useEntitlement();
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);
  useEffect(() => setPricing(getPricing()), []);
  const setP = (patch: Partial<Pricing>) => {
    const next = { ...pricing, ...patch };
    setPricing(next);
    savePricing(next);
  };
  return (
    <MobileShell>
      <TopBar title="설정" onBack={() => setScreen("home")} />
      <div className="p-4 space-y-3 flex-1 overflow-auto pb-24">
        {/* 서비스 최고관리자 전용 메뉴 — 서버에서 확인한 권한만 사용합니다 */}
        {settingsEnt?.isSuperAdmin && (
          <button
            onClick={() => {
              tap();
              setScreen("adminAccounts");
            }}
            className="w-full rounded-2xl border border-[#BFE3D3] bg-[#E7F3EE] p-4 text-left"
          >
            <div className="text-base font-bold text-[#3E9B78]">업체 계정 관리</div>
            <div className="mt-1 text-xs font-medium text-[#3E9B78]">
              업체별 가입일 · 무료체험 · 구독 · 결제 · 문자 사용량 확인
            </div>
          </button>
        )}
        <ExperimentalFeatureSettings />
        <button
          onClick={() => {
            tap();
            setScreen("subscription");
          }}
          className="w-full text-left rounded-2xl p-4 text-white font-bold shadow-[0_6px_0_#285C99]"
          style={{ background: "linear-gradient(135deg, #3578C8 0%, #3578C8 100%)" }}
        >
          <div className="text-base">구독 · 결제 관리</div>
          <div className="text-xs font-medium opacity-90 mt-1">요금제 변경, 결제 내역 확인</div>
        </button>
        {/* 오류 관리 — 서비스 관리자 전용 (서버에서도 관리자만 읽을 수 있습니다) */}
        {settingsEnt?.isSuperAdmin && (
          <button
            onClick={() => {
              tap();
              setScreen("errorLogs");
            }}
            className="w-full rounded-2xl border border-[#FECACA] bg-white p-4 text-left"
          >
            <div className="text-base font-bold text-[#D95C5C]">오류 관리</div>
            <div className="mt-1 text-xs font-medium text-[#6B7280]">
              오류가 난 업체 · 화면 · 발생시각 · 오류 내용 · 복구 결과 확인
            </div>
          </button>
        )}
        {/* 업체 화면에는 문자 사용 가능 여부와 내 업체 발송 현황만 보여 줍니다 */}
        {!settingsEnt?.isSuperAdmin && <SmsNoticeCard />}
        <BusinessInfoCard onNeedLogin={() => setScreen("login")} />
        {/* 문자발송 설정·시험 발송은 서비스 관리자 전용입니다 */}
        {settingsEnt?.isSuperAdmin && (
          <SmsConnectionCard
            ownerPhone={draft.staffPhone ?? ""}
            onNeedLogin={() => setScreen("login")}
          />
        )}

        <Card className="space-y-3">
          <div className="font-bold">문자 기본 문구</div>
          <textarea
            defaultValue="안녕하세요, JIMPICK입니다. 요청하신 이사 견적을 안내드립니다."
            className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-white text-sm min-h-24"
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
                inputClassName="h-14 py-0 leading-[3.5rem] text-[18px] font-bold text-[#25282D]"
              />
            </Field>
            <Field label="5톤 차량">
              <MoneyInput
                value={pricing.truck5t}
                step={10000}
                onChange={(n) => setP({ truck5t: n })}
                inputClassName="h-14 py-0 leading-[3.5rem] text-[18px] font-bold text-[#25282D]"
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
          <div>· 무료 체험 한 달</div>
          <div>· 이후 월 33,000원 (부가세 포함)</div>
          <div>· 약정 없이 언제든 해지 가능</div>
          <div>· 재구독 시 기존 데이터 복원</div>
        </Card>
        <button
          onClick={() => {
            // 계정 세션도 함께 끊습니다
            void signOut();
            logout();
          }}
          className="w-full py-4 rounded-2xl bg-white border border-[#D95C5C] text-[#D95C5C] font-bold flex items-center justify-center gap-2"
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
              <div className="text-lg font-black text-[#25282D] mt-1">{c.value}</div>
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
              <div className="h-2 rounded-full bg-[#F7F8F5] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(count / maxType) * 100}%`,
                    background: "linear-gradient(90deg, #5B93D6 0%, #3578C8 100%)",
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
