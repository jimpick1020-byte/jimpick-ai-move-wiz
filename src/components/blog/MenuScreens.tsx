/*
 * 홈 / 목록(작성중·완료·내 블로그 글) / 설정 / 구독 화면
 */
import {
  Camera,
  Sparkles,
  Eye,
  CheckCircle2,
  ArrowRight,
  Plus,
  Copy,
  Trash2,
  FileText,
  Clock,
  Check,
  Settings as SettingsIcon,
} from "lucide-react";
import { useBlog } from "./context";
import { Card, PrimaryButton, FeatureCheck, GhostButton } from "./ui";
import { coverOf, PLANS, type PropertyRecord } from "./data";
import { selectedTitle } from "./export";

/* ── 홈 ── */
export function HomeScreen() {
  const { startNew, records, openRecord, go } = useBlog();
  const recent = records.slice(0, 3);

  const flow = [
    { icon: Camera, label: "사진 촬영" },
    { icon: Sparkles, label: "AI 분석·작성" },
    { icon: Eye, label: "미리보기" },
    { icon: Check, label: "승인" },
    { icon: CheckCircle2, label: "블로그 업로드" },
  ];

  return (
    <div className="space-y-5 pb-6">
      {/* 히어로 */}
      <div className="rounded-3xl bg-gradient-to-br from-violet-600 via-violet-600 to-purple-700 p-6 text-white shadow-xl shadow-violet-300/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-extrabold leading-tight">AI 부동산 블로그 자동 작성</h1>
            <p className="mt-1 text-sm text-violet-100">사진 한 장으로 끝내는 스마트 홍보 시스템</p>
          </div>
        </div>
        <ul className="mt-4 grid grid-cols-1 gap-1.5">
          <FeatureCheck>매매 / 전세 / 월세 / 단기 / 임대 지원</FeatureCheck>
          <FeatureCheck>사진 분석 + AI 자동 글 작성</FeatureCheck>
          <FeatureCheck>평수 / 입주가능일 / 특징 자동 정리</FeatureCheck>
          <FeatureCheck>블로그 업로드 지원</FeatureCheck>
        </ul>
      </div>

      {/* 진행 흐름 */}
      <Card>
        <p className="mb-3 text-center text-[13px] font-semibold text-slate-500">이렇게 진행돼요</p>
        <div className="flex items-center justify-between">
          {flow.map((f, i) => (
            <div key={f.label} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                  <f.icon size={20} />
                </div>
                <span className="w-14 text-center text-[10px] font-medium leading-tight text-slate-500">
                  {f.label}
                </span>
              </div>
              {i < flow.length - 1 && <ArrowRight size={14} className="mx-0.5 shrink-0 text-violet-300" />}
            </div>
          ))}
        </div>
      </Card>

      {/* 메인 문구 + CTA */}
      <div className="rounded-3xl border border-violet-100 bg-white p-6 text-center shadow-sm">
        <h2 className="text-[20px] font-extrabold leading-snug text-slate-800">
          사진 찍고 정보만 입력하세요.
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
          매물 분석부터 블로그 홍보글 작성까지 AI가 대신합니다.
        </p>
        <div className="mt-4">
          <PrimaryButton onClick={startNew}>
            <Plus size={20} />새 매물 등록하기
          </PrimaryButton>
        </div>
      </div>

      {/* 최근 매물 */}
      {recent.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-sm font-bold text-slate-700">최근 작업</p>
            <button onClick={() => go("blogs")} className="text-[13px] font-medium text-violet-600">
              전체보기
            </button>
          </div>
          <div className="space-y-2">
            {recent.map((r) => (
              <RecordRow key={r.id} rec={r} onOpen={() => openRecord(r.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 매물 한 줄 카드 ── */
function RecordRow({
  rec,
  onOpen,
  onCopy,
  onDelete,
}: {
  rec: PropertyRecord;
  onOpen: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
}) {
  const cover = coverOf(rec);
  const title = rec.blog ? selectedTitle(rec) : rec.info.아파트명 || "새 매물";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white p-2.5 shadow-sm">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {cover ? (
          <img src={cover} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-300">
            <FileText size={22} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-slate-800">{title}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                rec.status === "done" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {rec.status === "done" ? "완료" : "작성중"}
            </span>
            <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">
              {rec.transactionType}
            </span>
            <span className="truncate text-[11px] text-slate-400">
              {rec.info.주소 || rec.info.아파트명 || ""}
            </span>
          </div>
        </div>
      </button>
      <div className="flex shrink-0 flex-col gap-1">
        {onCopy && (
          <button onClick={onCopy} className="rounded-lg p-1.5 text-violet-500 hover:bg-violet-50" title="복사해서 새 매물">
            <Copy size={16} />
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50" title="삭제">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── 목록 (작성중 / 완료 / 내 블로그 글) ── */
export function ListScreen({ filter }: { filter: "draft" | "done" | "all" }) {
  const { records, openRecord, copyRecord, deleteRecord, startNew } = useBlog();
  const items = records.filter((r) => (filter === "all" ? true : r.status === filter));

  const titleMap = { draft: "작성중", done: "완료", all: "내 블로그 글" } as const;
  const iconMap = { draft: Clock, done: CheckCircle2, all: FileText } as const;
  const Icon = iconMap[filter];

  return (
    <div className="space-y-3 pb-6">
      <div className="flex items-center gap-2 px-1">
        <Icon size={20} className="text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">{titleMap[filter]}</h1>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[12px] font-bold text-violet-600">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-violet-200 bg-white py-14 text-center">
          <FileText size={36} className="mx-auto text-violet-200" />
          <p className="mt-3 text-sm text-slate-400">아직 없어요.</p>
          <div className="mx-auto mt-4 w-48">
            <PrimaryButton onClick={startNew}>
              <Plus size={18} />새 매물 작성
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <RecordRow
              key={r.id}
              rec={r}
              onOpen={() => openRecord(r.id)}
              onCopy={() => copyRecord(r.id)}
              onDelete={() => {
                if (confirm("이 매물을 삭제할까요?")) deleteRecord(r.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 설정 ── */
export function SettingsScreen() {
  const { go, records } = useBlog();
  const done = records.filter((r) => r.status === "done").length;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-2 px-1">
        <SettingsIcon size={20} className="text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">설정</h1>
      </div>

      <Card>
        <p className="text-sm font-bold text-slate-700">사용 현황</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-violet-50 p-3 text-center">
            <p className="text-2xl font-extrabold text-violet-600">{records.length}</p>
            <p className="text-[12px] text-slate-500">전체 매물</p>
          </div>
          <div className="rounded-xl bg-green-50 p-3 text-center">
            <p className="text-2xl font-extrabold text-green-600">{done}</p>
            <p className="text-[12px] text-slate-500">완료된 글</p>
          </div>
        </div>
      </Card>

      <Card>
        <p className="text-sm font-bold text-slate-700">구독 요금제</p>
        <p className="mt-1 text-[13px] text-slate-500">
          더 많은 매물을 작성하려면 요금제를 확인하세요. (현재는 체험 이용 중)
        </p>
        <div className="mt-3">
          <GhostButton onClick={() => go("subscription")}>요금제 보기</GhostButton>
        </div>
      </Card>

      <Card>
        <p className="text-sm font-bold text-slate-700">AI 연결</p>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          AI API 키는 서버 환경변수(LOVABLE_API_KEY)로 안전하게 관리되며 화면에 노출되지 않습니다.
          모든 AI 호출은 백엔드 서버를 통해 이루어집니다.
        </p>
      </Card>

      <Card>
        <p className="text-sm font-bold text-slate-700">데이터 보관</p>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          작성한 매물은 이 기기에 저장됩니다. 기기를 바꾸면 별도 계정 연동이 필요합니다(추후 지원).
        </p>
      </Card>
    </div>
  );
}

/* ── 구독 ── */
export function SubscriptionScreen() {
  return (
    <div className="space-y-4 pb-6">
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-800">구독 요금제</h1>
        <p className="mt-0.5 text-[13px] text-slate-500">
          지금은 결제 없이 체험할 수 있어요. 요금과 사용량은 추후 관리자 설정에서 변경됩니다.
        </p>
      </div>

      {PLANS.map((p) => (
        <div
          key={p.id}
          className={`rounded-2xl border-2 bg-white p-5 shadow-sm ${
            p.highlight ? "border-violet-500" : "border-violet-100"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-800">{p.name}</h2>
              {p.highlight && (
                <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-bold text-white">
                  인기
                </span>
              )}
            </div>
            <div className="text-right">
              <p className="text-xl font-extrabold text-violet-600">
                {p.price.toLocaleString()}
                <span className="text-[13px] font-medium text-slate-400">원/월</span>
              </p>
            </div>
          </div>
          <p className="mt-1 text-[13px] font-semibold text-slate-600">{p.quota}</p>
          <ul className="mt-3 space-y-1.5">
            {p.features.map((f) => (
              <li key={f} className="flex items-start gap-1.5 text-[14px] text-slate-600">
                <Check size={16} className="mt-0.5 shrink-0 text-green-500" />
                {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled
            className="mt-4 w-full rounded-xl border border-violet-200 bg-violet-50 py-3 text-sm font-bold text-violet-400"
          >
            준비 중 (결제 비활성화)
          </button>
        </div>
      ))}
    </div>
  );
}
