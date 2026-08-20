/**
 * 짐픽 이사 견적서 (사장님 화면 · 고객 화면 공용).
 *
 * 사장님이 보는 견적서와 고객이 문자로 받아 보는 견적서가
 * 같은 부품을 써서 똑같이 보이도록 만들었습니다.
 *
 * 앞 단계에서 넣은 값을 그대로 채우고, 비어 있는 줄은 감춥니다.
 * 확정한 뒤에는 sheetSnapshot 을 우선 써서, 단가가 나중에 바뀌어도
 * 이미 보낸 견적서 금액이 흔들리지 않습니다.
 */
import { forwardRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Package,
  Phone,
  Route,
  ShieldCheck,
  Timer,
  Truck,
  User,
  CheckCircle2,
} from "lucide-react";
import type { Estimate } from "@/lib/jimpick";
import { won } from "@/lib/jimpick";
import { ItemArt } from "@/lib/jimpick-art";
import {
  TERMS_EFFECTIVE_AT,
  TERMS_FULL,
  TERMS_NAME,
  TERMS_NOTICE,
  TERMS_SOURCE,
  TERMS_SUMMARY,
  TERMS_VERSION,
} from "@/lib/terms";

/** 2026-08-20 → 2026. 08. 20 */
function ymd(v: string | number | Date): string {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}. ${two(d.getMonth() + 1)}. ${two(d.getDate())}`;
}

export interface SheetRoom {
  name: string;
  items: { id: string; name: string; qty: number }[];
}

/** 아이콘 + 제목 + 값 한 칸 */
function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-3">
      <span className="shrink-0 text-[#0864DC]">{icon}</span>
      <span className="min-w-0">
        <span className="block break-keep text-[15px] leading-tight text-[#6B7280]">{label}</span>
        <span className="mt-0.5 block break-keep text-[16px] font-bold leading-tight text-[#111827]">
          {value}
        </span>
      </span>
    </div>
  );
}

/** 층수와 엘리베이터 — 입력한 것만 적습니다 */
function floorText(floor: number | undefined, env: string | undefined): string {
  const parts: string[] = [];
  if (floor) parts.push(`${floor}층`);
  const e = String(env || "").trim();
  if (e) parts.push(e);
  return parts.join(" · ");
}

/** 주소 한 줄 — 값이 없으면 그리지 않습니다 */
function AddressRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  if (!value.trim()) return null;
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-3">
      <MapPin className="mt-0.5 h-[19px] w-[19px] shrink-0 text-[#0864DC]" strokeWidth={2} />
      <span className="w-[52px] shrink-0 text-[16px] font-bold text-[#0864DC]">{label}</span>
      <span className="min-w-0">
        <span className="block break-words text-[16px] font-medium text-[#111827]">{value}</span>
        {sub?.trim() && (
          <span className="mt-0.5 block text-[15px] text-[#6B7280]">{sub}</span>
        )}
      </span>
    </div>
  );
}

/** 금액 한 줄 */
function MoneyRow({
  label,
  amount,
  tone = "normal",
}: {
  label: string;
  amount: number;
  tone?: "normal" | "minus";
}) {
  if (!amount) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span
        className={`shrink-0 text-[16px] ${tone === "minus" ? "text-[#0864DC]" : "text-[#374151]"}`}
      >
        {label}
      </span>
      <span
        className={`min-w-0 text-right text-[16px] font-bold tabular-nums ${
          tone === "minus" ? "text-[#0864DC]" : "text-[#111827]"
        }`}
      >
        {tone === "minus" ? "-" : ""}
        {won(amount)}
      </span>
    </div>
  );
}

/** 누를 수 있는 안내 줄 (약관 · 동의 상태) */
function LinkRow({
  icon,
  title,
  desc,
  badge,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  badge?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold text-[#0864DC]">{title}</span>
        <span className="mt-0.5 block break-words text-[15px] text-[#6B7280]">{desc}</span>
      </span>
      {badge}
      <ChevronRight className="mt-0.5 h-[20px] w-[20px] shrink-0 text-[#9CA3AF]" />
    </>
  );
  const cls =
    "flex w-full items-start gap-2.5 rounded-[14px] border border-[#DCE8FA] bg-white px-3.5 py-3.5 text-left";
  return onClick ? (
    <button onClick={onClick} className={`${cls} active:translate-y-[1px]`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export interface EstimateSheetProps {
  draft: Estimate;
  rooms: SheetRoom[];
  parts: { label: string; amount: number }[];
  total: number;
  companyName?: string;
  companyPhone?: string;
  /** 고객이 동의했으면 그 일시 */
  acceptedAt?: string | null;
  /** 고객이 실제로 동의한 견적서 차수·약관 버전 (동의 전에는 비워 둡니다) */
  acceptedSheetVersion?: number | null;
  acceptedTermsVersion?: string | null;
  /** 고객 화면에서는 사장님용 안내를 감춥니다 */
  forCustomer?: boolean;
  /** 견적서 아래에 약관·동의 영역을 함께 그릴지 */
  showTerms?: boolean;
}

export const EstimateSheet = forwardRef<HTMLDivElement, EstimateSheetProps>(function EstimateSheet(
  {
    draft,
    rooms,
    parts,
    total,
    companyName = "짐픽 이사",
    companyPhone,
    acceptedAt = null,
    acceptedSheetVersion = null,
    acceptedTermsVersion = null,
    forCustomer = false,
    showTerms = true,
  },
  ref,
) {
  const transport = parts
    .filter((p) => !["옵션 비용", "보관료"].includes(p.label))
    .reduce((s, p) => s + p.amount, 0);
  const extraWork = parts
    .filter((p) => ["옵션 비용", "보관료"].includes(p.label))
    .reduce((s, p) => s + p.amount, 0);
  const discount = Math.max(0, draft.discount ?? 0);
  const deposit = Math.max(0, draft.deposit ?? 0);
  const balance = Math.max(0, total - deposit);
  const version = draft.sheetVersion ?? 1;
  /** 사장님이 실제로 켠 추가 작업만 */
  const addedWork = (draft.options ?? []).filter((o) => o.enabled);
  /** 입금 계좌 — 입력한 것이 하나도 없으면 통째로 감춥니다 */
  const bank = {
    name: draft.bankName?.trim() ?? "",
    account: draft.bankAccount?.trim() ?? "",
    holder: draft.bankHolder?.trim() ?? "",
  };
  const hasBank = !!(bank.name || bank.account || bank.holder);
  const [termsOpen, setTermsOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const confirmed = !!draft.sheetConfirmedAt;

  const truckText =
    [
      draft.truck5t > 0 ? `5톤 트럭${draft.truck5t > 1 ? ` ${draft.truck5t}대` : ""}` : "",
      draft.truck1t > 0 ? `1톤 트럭${draft.truck1t > 1 ? ` ${draft.truck1t}대` : ""}` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "미정";

  return (
    <div ref={ref} className="bg-[#F2F5FA] pb-4">
      {/* 파란 머리띠 */}
      <div className="flex items-center gap-1.5 bg-[#0864DC] px-4 py-3.5">
        <span className="text-[22px] font-black tracking-tight text-white">JIMPICK</span>
        <span className="text-[17px] font-bold text-white/90">짐픽</span>
      </div>

      <div className="space-y-3 px-3 pt-3">
        {/* 제목 · 견적번호 · 확정 */}
        <div className="rounded-[14px] bg-white px-4 py-4 shadow-[0_2px_10px_rgba(17,24,39,0.06)]">
          {/* 견적번호는 줄여 쓰지 않고 아래에 한 줄로 적습니다 */}
          {draft.sheetNo && (
            <div className="mb-1 text-right text-[15px] font-bold text-[#6B7280]">
              {draft.sheetNo}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <h1 className="shrink-0 whitespace-nowrap text-[24px] font-black leading-tight text-[#111827]">
              짐픽 이사 견적서
            </h1>
            <div className="shrink-0 text-right">
              <div
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[15px] font-bold ${
                  confirmed
                    ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]"
                    : "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]"
                }`}
              >
                {confirmed && <CheckCircle2 className="h-[16px] w-[16px]" strokeWidth={2.4} />}
                {confirmed ? "확정" : "작성 중"}
              </div>
            </div>
          </div>
          {version > 1 && (
            <div className="mt-1.5 text-[15px] font-bold text-[#B45309]">{version}차 수정 견적서</div>
          )}

          {/* 고객 · 이사일 */}
          <div className="mt-3 space-y-2 border-t border-[#EDF0F5] pt-3">
            <div className="flex min-w-0 items-center gap-2">
              <User className="h-[19px] w-[19px] shrink-0 text-[#0864DC]" strokeWidth={2} />
              <span className="min-w-0 truncate text-[17px] font-bold text-[#111827]">
                {draft.customerName || "고객"}
                <span className="ml-1 font-medium text-[#6B7280]">고객님</span>
              </span>
            </div>
            {draft.phone?.trim() && (
              <div className="flex min-w-0 items-center gap-2">
                <Phone className="h-[19px] w-[19px] shrink-0 text-[#0864DC]" strokeWidth={2} />
                <span className="min-w-0 truncate text-[16px] text-[#6B7280]">
                  연락처 <span className="font-bold text-[#111827]">{draft.phone.trim()}</span>
                </span>
              </div>
            )}
            <div className="flex min-w-0 items-center gap-2">
              <CalendarDays className="h-[19px] w-[19px] shrink-0 text-[#0864DC]" strokeWidth={2} />
              <span className="min-w-0 truncate text-[16px] text-[#6B7280]">
                이사일{" "}
                <span className="font-bold text-[#111827]">
                  {draft.moveDate ? ymd(draft.moveDate) : "미정"}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* 시작 시간 · 이동 거리 · 예상 이동시간 */}
        <div className="flex divide-x divide-[#EDF0F5] rounded-[14px] bg-white shadow-[0_2px_10px_rgba(17,24,39,0.06)]">
          <Stat
            icon={<Clock className="h-[19px] w-[19px]" strokeWidth={2} />}
            label="시작 시간"
            value={draft.moveTime || "미정"}
          />
          <Stat
            icon={<Route className="h-[19px] w-[19px]" strokeWidth={2} />}
            label="이동 거리"
            value={draft.distanceKm ? `${draft.distanceKm}km` : "미정"}
          />
          <Stat
            icon={<Timer className="h-[19px] w-[19px]" strokeWidth={2} />}
            label="예상 이동시간"
            value={draft.durationMin ? `${draft.durationMin}분` : "미정"}
          />
        </div>

        {/* 출발지 · 도착지 */}
        <div className="divide-y divide-[#EDF0F5] rounded-[14px] bg-white shadow-[0_2px_10px_rgba(17,24,39,0.06)]">
          <AddressRow
            label="출발지"
            value={`${draft.fromAddress} ${draft.fromDetail || ""}`.trim()}
            sub={floorText(draft.fromFloor, draft.workEnv)}
          />
          <AddressRow
            label="도착지"
            value={`${draft.toAddress} ${draft.toDetail || ""}`.trim()}
            sub={floorText(draft.toFloor, draft.workEnv)}
          />
        </div>

        {/* 차량 · 이사 유형 */}
        <div className="flex divide-x divide-[#EDF0F5] rounded-[14px] bg-white shadow-[0_2px_10px_rgba(17,24,39,0.06)]">
          <Stat
            icon={<Truck className="h-[19px] w-[19px]" strokeWidth={2} />}
            label="차량"
            value={truckText}
          />
          <Stat
            icon={<Package className="h-[19px] w-[19px]" strokeWidth={2} />}
            label="이사 유형"
            value={draft.moveType || "미정"}
          />
        </div>

        {/* 공간별 품목 */}
        {rooms.length > 0 && (
          <div>
            <div className="mb-2 px-1 text-[17px] font-black text-[#0864DC]">공간별 품목</div>
            <div className="space-y-2">
              {rooms.map((r) => (
                <div
                  key={r.name}
                  className="jp-avoid-break flex items-stretch gap-2 rounded-[14px] bg-white p-2.5 shadow-[0_2px_10px_rgba(17,24,39,0.06)]"
                >
                  <div className="flex w-[64px] shrink-0 items-center justify-center">
                    <span className="text-[17px] font-black text-[#111827]">{r.name}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-2 border-l border-[#EDF0F5] pl-2.5">
                    {r.items.map((it) => (
                      <div key={it.id} className="flex min-w-0 items-center gap-1.5">
                        <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#EDF0F5] bg-[#F7F9FC]">
                          <ItemArt id={it.id} name={it.name} size={40} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[16px] font-medium text-[#111827]">
                            {it.name}
                          </span>
                          <span className="block text-[16px] font-bold text-[#111827]">
                            {it.qty}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 추가 작업 — 고른 것만 적습니다 */}
        {addedWork.length > 0 && (
          <div className="rounded-[14px] bg-white px-4 py-4 shadow-[0_2px_10px_rgba(17,24,39,0.06)]">
            <div className="mb-1.5 text-[17px] font-black text-[#0864DC]">추가 작업</div>
            {addedWork.map((o) => (
              <div key={o.id} className="flex items-start justify-between gap-3 py-1.5">
                <span className="min-w-0 break-words text-[16px] text-[#111827]">{o.name}</span>
                <span className="shrink-0 text-right text-[16px] font-bold tabular-nums text-[#111827]">
                  {o.separate ? "별도" : won(o.price)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 비용 상세 */}
        <div className="rounded-[14px] bg-white px-4 py-4 shadow-[0_2px_10px_rgba(17,24,39,0.06)]">
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#0864DC] text-[13px] font-black text-white">
              ₩
            </span>
            <span className="text-[17px] font-black text-[#0864DC]">비용 상세</span>
          </div>
          <MoneyRow label="기본 운송비" amount={transport} />
          <MoneyRow label="추가 작업비" amount={extraWork} />
          <MoneyRow label="할인금액" amount={discount} tone="minus" />
          {(deposit > 0 || discount > 0) && (
            <div className="my-1.5 border-t border-dashed border-[#DCE8FA]" />
          )}
          <MoneyRow label="예약금" amount={deposit} />
          <MoneyRow label="잔금" amount={deposit ? balance : 0} />

          <div className="mt-3 flex items-center justify-between gap-3 rounded-[12px] border border-[#DCE8FA] bg-[#F5F9FF] px-3.5 py-3">
            <span className="shrink-0 text-[18px] font-black text-[#111827]">총 견적금액</span>
            <span className="min-w-0 text-right text-[26px] font-black leading-none tabular-nums text-[#0864DC]">
              {won(total)}
            </span>
          </div>
        </div>

        {/* 입금 계좌 — 입력한 것만 적습니다 */}
        {hasBank && (
          <div className="rounded-[14px] bg-white px-4 py-4 shadow-[0_2px_10px_rgba(17,24,39,0.06)]">
            <div className="mb-1.5 text-[17px] font-black text-[#0864DC]">입금 계좌</div>
            {bank.name && (
              <div className="flex items-start justify-between gap-3 py-1">
                <span className="shrink-0 text-[16px] text-[#6B7280]">은행</span>
                <span className="min-w-0 break-words text-right text-[16px] font-bold text-[#111827]">
                  {bank.name}
                </span>
              </div>
            )}
            {bank.account && (
              <div className="flex items-start justify-between gap-3 py-1">
                <span className="shrink-0 text-[16px] text-[#6B7280]">계좌번호</span>
                <span className="min-w-0 break-words text-right text-[16px] font-bold tabular-nums text-[#111827]">
                  {bank.account}
                </span>
              </div>
            )}
            {bank.holder && (
              <div className="flex items-start justify-between gap-3 py-1">
                <span className="shrink-0 text-[16px] text-[#6B7280]">예금주</span>
                <span className="min-w-0 break-words text-right text-[16px] font-bold text-[#111827]">
                  {bank.holder}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 담당자 · 연락처 */}
        <div className="flex divide-x divide-[#EDF0F5] rounded-[14px] bg-white shadow-[0_2px_10px_rgba(17,24,39,0.06)]">
          <Stat
            icon={<User className="h-[19px] w-[19px]" strokeWidth={2} />}
            label="담당자"
            value={draft.staffName?.trim() || "담당자"}
          />
          <Stat
            icon={<Phone className="h-[19px] w-[19px]" strokeWidth={2} />}
            label="연락처"
            value={draft.staffPhone?.trim() || companyPhone || "미입력"}
          />
        </div>

        {/* 이사화물 표준약관 · 고객 동의 — 별도 화면 없이 여기서 모두 봅니다 */}
        {showTerms && (
          <div className="space-y-2">
            <div className="rounded-[14px] border border-[#DCE8FA] bg-white px-3.5 py-3.5">
              <div className="flex items-start gap-2.5">
                <FileText className="mt-0.5 h-[20px] w-[20px] shrink-0 text-[#0864DC]" strokeWidth={2} />
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-bold text-[#0864DC]">{TERMS_NAME}</div>
                  <div className="mt-0.5 break-words text-[15px] text-[#6B7280]">{TERMS_SOURCE}</div>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-full border border-[#DCE8FA] px-2 py-0.5 text-[15px] font-bold text-[#0864DC]">
                  {TERMS_VERSION}
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTermsOpen((v) => !v)}
                  className="rounded-[12px] border border-[#0864DC] bg-white py-2.5 text-[16px] font-bold text-[#0864DC] active:translate-y-[1px]"
                >
                  {termsOpen ? "약관 접기" : "약관 보기"}
                </button>
                <button
                  onClick={() => setFullOpen((v) => !v)}
                  className="rounded-[12px] border border-[#0864DC] bg-white py-2.5 text-[16px] font-bold text-[#0864DC] active:translate-y-[1px]"
                >
                  {fullOpen ? "전체 접기" : "약관 전체보기"}
                </button>
              </div>

              {termsOpen && (
                <div className="mt-2.5 rounded-[12px] bg-[#F7F9FC] p-3">
                  {TERMS_SUMMARY.map((t, i) => (
                    <div key={t.title} className={i > 0 ? "mt-2.5" : ""}>
                      <div className="text-[16px] font-bold text-[#111827]">{t.title}</div>
                      <div className="mt-0.5 break-words text-[15px] leading-relaxed text-[#4B5563]">
                        {t.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {fullOpen && (
                <div className="mt-2.5 space-y-3 rounded-[12px] bg-[#F7F9FC] p-3">
                  {TERMS_FULL.map((t) => (
                    <div key={t.article} className="break-inside-avoid">
                      <div className="text-[16px] font-black text-[#111827]">
                        {t.article} ({t.title})
                      </div>
                      <div className="mt-0.5 whitespace-pre-line break-words text-[15px] leading-relaxed text-[#4B5563]">
                        {t.body}
                      </div>
                    </div>
                  ))}
                  <div className="text-[15px] text-[#6B7280]">
                    {TERMS_NOTICE} · 적용일 {TERMS_EFFECTIVE_AT}
                  </div>
                </div>
              )}
            </div>

            {/* 고객 동의 상태 — 고객이 직접 동의해야만 바뀝니다 */}
            <div className="rounded-[14px] border border-[#DCE8FA] bg-white px-3.5 py-3.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-[20px] w-[20px] shrink-0 text-[#0864DC]" strokeWidth={2} />
                <span className="text-[16px] font-bold text-[#0864DC]">고객 동의 상태</span>
                <span
                  className={`ml-auto shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[15px] font-bold ${
                    acceptedAt ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEF3C7] text-[#B45309]"
                  }`}
                >
                  {acceptedAt ? "동의 완료" : "동의 대기"}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <span className="shrink-0 text-[15px] text-[#6B7280]">동의 일시</span>
                  <span className="min-w-0 break-words text-right text-[15px] font-bold text-[#111827]">
                    {acceptedAt
                      ? new Date(acceptedAt).toLocaleString("ko-KR")
                      : "아직 동의하지 않음"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="shrink-0 text-[15px] text-[#6B7280]">동의한 견적서 버전</span>
                  <span className="min-w-0 break-words text-right text-[15px] font-bold text-[#111827]">
                    {acceptedSheetVersion ? `${acceptedSheetVersion}차 견적서` : `${version}차 (발송본)`}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="shrink-0 text-[15px] text-[#6B7280]">동의한 약관 버전</span>
                  <span className="min-w-0 break-words text-right text-[15px] font-bold text-[#111827]">
                    {acceptedTermsVersion ?? `${TERMS_VERSION} (발송본)`}
                  </span>
                </div>
              </div>
              <div className="mt-1.5 text-[15px] text-[#6B7280]">
                {forCustomer
                  ? "아래에서 직접 확인란을 선택하시면 동의가 기록됩니다."
                  : "고객이 직접 동의한 후 표시됩니다. 업체는 대신 동의할 수 없습니다."}
              </div>
            </div>
          </div>
        )}

        {draft.sheetNote?.trim() && (
          <p className="px-1 text-[16px] font-medium text-[#374151]">{draft.sheetNote.trim()}</p>
        )}

        {(companyName || companyPhone) && (
          <p className="px-1 pb-1 text-center text-[15px] text-[#6B7280]">
            {companyName}
            {companyPhone ? ` · ${companyPhone}` : ""}
          </p>
        )}
      </div>
    </div>
  );
});
