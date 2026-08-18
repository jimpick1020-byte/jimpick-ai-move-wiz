import { useEffect, useMemo, useState } from "react";
import { useParams, useSearch } from "@tanstack/react-router";
import {
  Phone,
  Calendar,
  MapPin,
  Truck,
  Package,
  ShieldCheck,
  FileText,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Headphones,
  Landmark,
  User,
  Handshake,
  FileSignature,
  PackageOpen,
  CircleDollarSign,
  Lock,
} from "lucide-react";
import {
  ITEM_CATALOG,
  calcEstimate,
  loadEstimateFromStorage,
  won,
  type Estimate,
} from "@/lib/jimpick";
import {
  TERMS_EFFECTIVE_AT,
  TERMS_FULL,
  TERMS_NAME,
  TERMS_NOTICE,
  TERMS_SOURCE,
  TERMS_SUMMARY,
  TERMS_VERSION,
  termsSnapshot,
} from "@/lib/terms";
import { Card } from "./ui";
import { acceptTerms, getTermsLink, type TermsLinkInfo } from "@/lib/terms.functions";

/** 이 기기에 남기는 동의 기록 (새로고침해도 상태가 유지됩니다) */
interface LocalAcceptance {
  estimateId: string;
  termsName: string;
  termsVersion: string;
  termsEffectiveAt: string;
  termsSnapshot: string;
  sheetVersion: number;
  accepted: boolean;
  acceptedAt: number;
  method: string;
  token: string;
}

const ACCEPT_KEY = "jimpick.terms.acceptances";

function readAcceptance(id: string): LocalAcceptance | null {
  if (typeof window === "undefined") return null;
  try {
    const all = JSON.parse(localStorage.getItem(ACCEPT_KEY) || "{}") as Record<
      string,
      LocalAcceptance
    >;
    return all[id] ?? null;
  } catch {
    return null;
  }
}

function writeAcceptance(rec: LocalAcceptance) {
  try {
    const all = JSON.parse(localStorage.getItem(ACCEPT_KEY) || "{}") as Record<
      string,
      LocalAcceptance
    >;
    all[rec.estimateId] = rec;
    localStorage.setItem(ACCEPT_KEY, JSON.stringify(all));
  } catch {
    /* 저장할 수 없는 브라우저는 그냥 넘어갑니다 */
  }
}

function ymd(date?: string | null): string {
  const [y, m, d] = String(date || "").split("-");
  if (!y || !m || !d) return "";
  return `${y}. ${m}. ${d}`;
}

/** 약관 요약 5개 항목에 맞는 파란색 선 아이콘 */
const SUMMARY_ICONS = [Handshake, FileSignature, PackageOpen, CircleDollarSign, Lock];

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2.5 py-3.5">{children}</div>;
}

export function SharePage() {
  const { id } = useParams({ from: "/share/$id" });
  const search = useSearch({ from: "/share/$id" }) as { staff?: string; t?: string };
  const staffMode = String(search?.staff ?? "") === "1";
  const token = String(search?.t ?? id).slice(0, 40);

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [link, setLink] = useState<TermsLinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSheet, setOpenSheet] = useState(false);
  const [openFull, setOpenFull] = useState(false);
  const [openSummary, setOpenSummary] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [accepted, setAccepted] = useState<LocalAcceptance | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setEstimate(loadEstimateFromStorage(id));
    setAccepted(readAcceptance(id));
    // 보안 토큰으로 이 견적 한 건만 조회합니다 (다른 견적번호로는 열리지 않습니다)
    void getTermsLink({ data: { token } })
      .then((info) => {
        setLink(info);
        if (info.ok && info.acceptedAt) {
          setAccepted({
            estimateId: id,
            termsName: info.termsName ?? TERMS_NAME,
            termsVersion: info.termsVersion ?? TERMS_VERSION,
            termsEffectiveAt: info.termsEffectiveAt ?? TERMS_EFFECTIVE_AT,
            termsSnapshot: "",
            sheetVersion: info.sheetVersion ?? 1,
            accepted: true,
            acceptedAt: new Date(info.acceptedAt).getTime(),
            method: info.acceptMethod ?? "웹 링크 · 확인란 선택",
            token,
          });
        }
      })
      .catch(() => setLink(null))
      .finally(() => setLoading(false));
  }, [id, token]);

  const localCalc = useMemo(() => (estimate ? calcEstimate(estimate) : null), [estimate]);

  // 실제 데이터: 서버(토큰 조회) 우선, 없으면 이 기기에 저장된 견적
  const customerName = (link?.ok ? link.customerName : "") || estimate?.customerName || "";
  const moveDate = ymd(link?.ok ? link.moveDate : estimate?.moveDate);
  const total = link?.ok && typeof link.total === "number" && link.total > 0
    ? link.total
    : (localCalc?.total ?? 0);
  const contactPhone = ((link?.ok ? link.contactPhone : "") || estimate?.staffPhone || "").trim();
  /** 견적서 번호와 차수 — 서버(토큰) 값을 먼저 씁니다 */
  const sheetNo = ((link?.ok ? link.sheetNo : "") || estimate?.sheetNo || "").trim();
  const sheetVersion = (link?.ok ? link.sheetVersion : null) ?? estimate?.sheetVersion ?? 1;
  const hasData = Boolean(customerName && moveDate && total > 0);

  const selectedItems = (estimate?.rooms ?? []).flatMap((room) =>
    Object.entries(room.items)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const catalog = ITEM_CATALOG.find((i) => i.id === itemId);
        return { room: room.name, name: catalog?.name || itemId, qty };
      }),
  );
  const enabledOptions = (estimate?.options ?? []).filter((o) => o.enabled);

  const confirmReservation = async () => {
    if (!checked || saving || !hasData) return;
    setSaving(true);
    setSaveError(null);
    const snapshot = termsSnapshot();
    const rec: LocalAcceptance = {
      estimateId: estimate?.id ?? id,
      termsName: TERMS_NAME,
      termsVersion: TERMS_VERSION,
      termsEffectiveAt: TERMS_EFFECTIVE_AT,
      termsSnapshot: snapshot,
      sheetVersion: link?.sheetVersion ?? estimate?.sheetVersion ?? 1,
      accepted: true,
      acceptedAt: Date.now(),
      method: "웹 링크 · 확인란 선택",
      token,
    };
    try {
      const r = await acceptTerms({
        data: { token, termsSnapshot: snapshot, acceptMethod: "웹 링크 · 확인란 선택" },
      });
      if (!r.ok) {
        setSaveError(r.error ?? "동의 기록을 저장하지 못했습니다. 다시 시도해 주세요.");
        setSaving(false);
        return;
      }
      if (r.acceptedAt) rec.acceptedAt = new Date(r.acceptedAt).getTime();
    } catch {
      setSaveError("네트워크 문제로 동의 기록을 저장하지 못했습니다. 다시 시도해 주세요.");
      setSaving(false);
      return;
    }
    writeAcceptance(rec);
    setAccepted(rec);
    setSaving(false);
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-white">
      {/* 상단 파란색 헤더 */}
      <header className="flex h-[88px] w-full items-center justify-center bg-[#0864DC]">
        <span className="text-[30px] font-black tracking-tight text-white">JIMPICK</span>
        <span className="ml-2 text-[16px] font-bold text-white/95">짐픽</span>
      </header>
      <div className="mx-auto w-full max-w-[430px] px-4 pb-12">{children}</div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="py-24 text-center text-[16px] font-semibold text-[#6B7280]">
        불러오는 중...
      </div>,
    );
  }

  /* ───────── 직원용(금액 미공개) ───────── */
  if (staffMode) {
    return shell(
      <div className="space-y-4 pt-5">
        <h1 className="text-center text-[26px] font-black text-[#111827]">작업 지시서</h1>
        {!estimate ? (
          <Card>
            <div className="text-[16px] font-semibold text-[#6B7280]">
              정보를 불러올 수 없습니다.
            </div>
          </Card>
        ) : (
          <>
            <Card className="space-y-2 text-[16px]">
              <div className="text-[17px] font-black">이사 정보</div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-[#0864DC]" />
                <span>{estimate.customerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#0864DC]" />
                <span>
                  {ymd(estimate.moveDate)} {estimate.moveTime}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-[#0864DC]" />
                <span>{estimate.moveType}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-[#0864DC]" />
                <div className="min-w-0 flex-1">
                  <div>
                    출발: {estimate.fromAddress} {estimate.fromDetail}
                  </div>
                  <div>
                    도착: {estimate.toAddress} {estimate.toDetail}
                  </div>
                </div>
              </div>
              <div className="text-[#6B7280]">
                1톤 {estimate.truck1t}대 · 5톤 {estimate.truck5t}대 · 사다리차 {estimate.ladder}대
              </div>
              <div className="rounded-xl bg-[#F5F7FB] p-3 font-bold text-[#111827]">금액 미공개</div>
            </Card>
            <Card className="space-y-2">
              <div className="flex items-center gap-2 text-[17px] font-black">
                <Package className="h-4 w-4 text-[#0864DC]" /> 선택한 품목
              </div>
              {selectedItems.length === 0 ? (
                <div className="text-[16px] text-[#6B7280]">선택된 품목이 없습니다.</div>
              ) : (
                selectedItems.map((it, i) => (
                  <div key={`${it.room}-${it.name}-${i}`} className="flex justify-between text-[16px]">
                    <span className="text-[#6B7280]">{it.room}</span>
                    <span className="font-medium">
                      {it.name} × {it.qty}
                    </span>
                  </div>
                ))
              )}
            </Card>
            {enabledOptions.length > 0 && (
              <Card className="space-y-2">
                <div className="text-[17px] font-black">추가 옵션</div>
                {enabledOptions.map((o) => (
                  <div key={o.id} className="flex justify-between text-[16px]">
                    <span>{o.name}</span>
                    <span className="font-medium">포함</span>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}
      </div>,
    );
  }

  /* ───────── 고객용 ───────── */
  return shell(
    <div className="pt-3">
      {/* 보안 안내 */}
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[14px] font-bold text-[#111827] shadow-[0_2px_10px_rgba(17,24,39,0.10)]">
          <ShieldCheck className="h-[18px] w-[18px] text-[#12A150]" /> 보안이 적용된 안전한 링크입니다
        </span>
      </div>

      {/* 제목 */}
      <h1 className="mt-4 text-center text-[26px] font-black leading-tight text-[#111827] sm:text-[30px]">
        이사 견적서 · 표준약관
      </h1>

      {/* 견적 요약 */}
      <div className="mt-4 rounded-[14px] bg-white shadow-[0_2px_12px_rgba(17,24,39,0.10)]">
        <div className="px-[22px] pt-1">
          {!hasData ? (
            <div className="py-6 text-center text-[16px] font-bold text-[#6B7280]">
              정보를 불러올 수 없습니다
            </div>
          ) : (
            <>
              <div className="border-b border-[#EDF0F5]">
                <Row>
                  <User className="h-[26px] w-[26px] shrink-0 text-[#0864DC]" />
                  <span className="truncate text-[22px] font-black text-[#111827]">
                    {customerName} 고객님
                  </span>
                </Row>
              </div>
              <div className="border-b border-[#EDF0F5]">
                <div className="flex items-center justify-between gap-3 py-3.5">
                  <span className="inline-flex min-w-0 items-center gap-2.5">
                    <Calendar className="h-[24px] w-[24px] shrink-0 text-[#0864DC]" />
                    <span className="text-[19px] font-bold text-[#111827]">이사일</span>
                  </span>
                  <span className="whitespace-nowrap text-[19px] font-black text-[#0864DC]">
                    {moveDate}
                  </span>
                </div>
              </div>
              <div className="border-b border-[#EDF0F5]">
                <div className="flex items-center justify-between gap-3 py-3.5">
                  <span className="inline-flex min-w-0 items-center gap-2.5">
                    <CircleDollarSign className="h-[24px] w-[24px] shrink-0 text-[#0864DC]" />
                    <span className="text-[19px] font-bold text-[#111827]">총 견적금액</span>
                  </span>
                  <span className="whitespace-nowrap text-[24px] font-black text-[#0864DC]">
                    {won(total)}
                  </span>
                </div>
              </div>
              {/* 견적서 번호와 차수 — 어떤 견적서인지 고객이 확인할 수 있게 적습니다 */}
              <div className="flex items-center justify-between gap-3 py-3.5">
                <span className="inline-flex min-w-0 items-center gap-2.5">
                  <FileText className="h-[24px] w-[24px] shrink-0 text-[#0864DC]" />
                  <span className="text-[19px] font-bold text-[#111827]">견적서</span>
                </span>
                <span className="min-w-0 truncate text-right text-[16px] font-bold text-[#4B5563]">
                  {sheetNo ? `${sheetNo} · ` : ""}
                  {sheetVersion}차
                </span>
              </div>
            </>
          )}
        </div>
        <div className="px-3.5 pb-3.5">
          <button
            onClick={() => setOpenSheet((v) => !v)}
            // 고객 휴대폰에는 이 기기에 저장된 견적이 없으므로,
            // 토큰으로 받아 온 요약만 있어도 열 수 있게 합니다
            disabled={!estimate && !hasData}
            className="flex w-full items-center justify-between rounded-xl bg-gradient-to-b from-[#1B76EF] to-[#0757C4] px-4 py-4 text-[20px] font-black text-white shadow-[0_4px_12px_rgba(8,100,220,0.35)] disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2.5">
              <FileText className="h-[22px] w-[22px]" /> 견적서 보기
            </span>
            {openSheet ? (
              <ChevronDown className="h-[22px] w-[22px]" />
            ) : (
              <ChevronRight className="h-[22px] w-[22px]" />
            )}
          </button>
        </div>
      </div>

      {/* 견적서 상세 */}
      {/* 이 기기에 견적 원본이 없을 때 — 링크로 받아 온 값만으로 보여 줍니다 */}
      {openSheet && !(estimate && localCalc) && hasData && (
        <div className="mt-4">
          <Card className="space-y-2 text-[16px]">
            <div className="text-[17px] font-black">견적서 요약</div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#4B5563]">고객</span>
              <span className="min-w-0 truncate font-bold">{customerName} 고객님</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#4B5563]">이사일</span>
              <span className="font-bold">{moveDate}</span>
            </div>
            {sheetNo && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#4B5563]">견적번호</span>
                <span className="min-w-0 truncate font-bold">{sheetNo}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#4B5563]">견적서 차수</span>
              <span className="font-bold">{sheetVersion}차</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-[#EDF0F5] pt-2">
              <span className="text-[17px] font-black">총 견적금액</span>
              <span className="text-[20px] font-black text-[#0864DC]">{won(total)}</span>
            </div>
            <p className="pt-1 text-[14px] leading-relaxed text-[#6B7280]">
              품목·차량·옵션이 담긴 자세한 내역은 담당자에게 문의해 주세요.
            </p>
          </Card>
        </div>
      )}

      {openSheet && estimate && localCalc && (
        <div className="mt-4 space-y-4">
          <Card className="space-y-2 text-[16px]">
            <div className="text-[17px] font-black">이사 정보</div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-[#0864DC]" />
              <span className="min-w-0 truncate">
                {estimate.customerName} · {estimate.phone}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-[#0864DC]" />
              <span>{estimate.moveType}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0864DC]" />
              <div className="min-w-0 flex-1">
                <div>
                  출발: {estimate.fromAddress} {estimate.fromDetail}
                </div>
                <div>
                  도착: {estimate.toAddress} {estimate.toDetail}
                </div>
              </div>
            </div>
            <div className="text-[#6B7280]">
              거리 {estimate.distanceKm}km · {estimate.workEnv} · {estimate.fromFloor}층 →{" "}
              {estimate.toFloor}층
            </div>
            {estimate.memo && (
              <div className="rounded-xl bg-[#F5F7FB] p-3">
                <span className="font-semibold">고객 메모:</span> {estimate.memo}
              </div>
            )}
          </Card>

          <Card className="space-y-2">
            <div className="flex items-center gap-2 text-[17px] font-black">
              <Package className="h-4 w-4 text-[#0864DC]" /> 선택한 품목
            </div>
            {selectedItems.length === 0 ? (
              <div className="text-[16px] text-[#6B7280]">선택된 품목이 없습니다.</div>
            ) : (
              <div className="max-h-60 space-y-1 overflow-auto">
                {selectedItems.map((it, i) => (
                  <div key={`${it.room}-${it.name}-${i}`} className="flex justify-between text-[16px]">
                    <span className="text-[#6B7280]">{it.room}</span>
                    <span className="font-medium">
                      {it.name} × {it.qty}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {enabledOptions.length > 0 && (
            <Card className="space-y-2">
              <div className="text-[17px] font-black">추가 옵션</div>
              {enabledOptions.map((o) => (
                <div key={o.id} className="flex justify-between text-[16px]">
                  <span>{o.name}</span>
                  <span className="font-medium">{o.separate ? "별도" : won(o.price)}</span>
                </div>
              ))}
            </Card>
          )}

          <Card className="space-y-2">
            <div className="text-[17px] font-black">견적 내역</div>
            {localCalc.parts.map((p) => (
              <div key={p.label} className="flex justify-between text-[16px]">
                <span className="text-[#6B7280]">{p.label}</span>
                <span className="font-semibold">{won(p.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-[#E7EBF2] pt-2 text-[17px] font-black">
              <span>합계</span>
              <span className="text-[#0864DC]">{won(total)}</span>
            </div>
          </Card>

          <Card className="space-y-2.5">
            <div className="text-[17px] font-black">계약 진행 안내</div>
            <div className="flex items-center justify-between text-[16px]">
              <span className="inline-flex items-center gap-2 text-[#6B7280]">
                <User className="h-4 w-4 text-[#0864DC]" /> 담당자
              </span>
              <span className="font-bold">{estimate.staffName?.trim() || "담당자"}</span>
            </div>
            <div className="flex items-center justify-between text-[16px]">
              <span className="inline-flex items-center gap-2 text-[#6B7280]">
                <Phone className="h-4 w-4 text-[#0864DC]" /> 연락처
              </span>
              {contactPhone ? (
                <a
                  href={`tel:${contactPhone.replace(/-/g, "")}`}
                  className="font-black text-[#0864DC] underline"
                >
                  {contactPhone}
                </a>
              ) : (
                <span className="font-bold text-[#6B7280]">업체 연락처 미입력</span>
              )}
            </div>
            <div className="flex items-start justify-between gap-3 text-[16px]">
              <span className="inline-flex items-center gap-2 whitespace-nowrap text-[#6B7280]">
                <Landmark className="h-4 w-4 text-[#0864DC]" /> 입금 계좌
              </span>
              <span className="text-right font-bold">
                {estimate.bankAccount?.trim() ? (
                  <>
                    {estimate.bankName?.trim()} {estimate.bankAccount.trim()}
                    {estimate.bankHolder?.trim() && (
                      <div className="text-[15px] font-semibold text-[#6B7280]">
                        예금주 {estimate.bankHolder.trim()}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-[#6B7280]">계좌번호 미입력</span>
                )}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* 표준약관 카드 */}
      <div className="mt-4 rounded-[14px] bg-white px-[22px] py-4 shadow-[0_2px_12px_rgba(17,24,39,0.10)]">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-[30px] w-[30px] shrink-0 text-[#0864DC]" />
          <div className="min-w-0">
            <div className="text-[21px] font-black text-[#111827]">{TERMS_NAME}</div>
            <div className="text-[14px] font-semibold text-[#8A93A2]">{TERMS_SOURCE}</div>
          </div>
        </div>

        <div className="mt-2">
          {TERMS_SUMMARY.slice(0, 5).map((s, i) => {
            const Icon = SUMMARY_ICONS[i] ?? FileText;
            const open = openSummary === i;
            return (
              <div key={s.title} className="border-b border-[#EDF0F5] last:border-b-0">
                <button
                  onClick={() => setOpenSummary(open ? null : i)}
                  className="flex w-full items-center gap-2.5 py-3.5 text-left"
                >
                  <Icon className="h-[24px] w-[24px] shrink-0 text-[#0864DC]" strokeWidth={1.8} />
                  <span className="min-w-0 flex-1 text-[17px] font-bold text-[#111827]">
                    {s.title}
                  </span>
                  {open ? (
                    <ChevronDown className="h-5 w-5 shrink-0 text-[#9AA3B2]" />
                  ) : (
                    <ChevronRight className="h-5 w-5 shrink-0 text-[#9AA3B2]" />
                  )}
                </button>
                {open && (
                  <div className="pb-3.5 text-[16px] leading-relaxed text-[#4B5563]">{s.body}</div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setOpenFull((v) => !v)}
          className="mt-3 flex w-full items-center justify-between rounded-xl border-2 border-[#0864DC] bg-white px-4 py-3 text-[18px] font-black text-[#0864DC]"
        >
          <span className="flex-1 text-center">약관 전체보기</span>
          {openFull ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </button>
        {openFull && (
          <div className="mt-3 max-h-[420px] space-y-3 overflow-auto rounded-xl border border-[#E7EBF2] p-3">
            {TERMS_FULL.map((t) => (
              <div key={t.article}>
                <div className="text-[16px] font-black text-[#111827]">
                  {t.article} ({t.title})
                </div>
                <div className="mt-1 text-[16px] leading-relaxed text-[#334155]">{t.body}</div>
              </div>
            ))}
            <div className="border-t border-[#E7EBF2] pt-2 text-[14px] font-semibold text-[#6B7280]">
              {TERMS_NOTICE} · 버전 {TERMS_VERSION} · 적용일 {TERMS_EFFECTIVE_AT}
            </div>
          </div>
        )}
      </div>

      {/* 동의 · 예약 확정 */}
      {accepted ? (
        <div className="mt-4 rounded-[14px] border-2 border-[#12A150] bg-white p-4">
          <div className="inline-flex items-center gap-2 text-[19px] font-black text-[#12A150]">
            <CheckCircle2 className="h-6 w-6" /> 예약이 확정되었습니다
          </div>
          <div className="mt-1 text-[16px] text-[#111827]">
            동의 일시: {new Date(accepted.acceptedAt).toLocaleString("ko-KR")}
          </div>
          <div className="text-[16px] text-[#6B7280]">
            적용 약관: {accepted.termsName} {accepted.termsVersion} · {accepted.method}
          </div>
        </div>
      ) : (
        <>
          <label className="mt-4 flex items-center gap-3 py-1 text-[17px] font-bold text-[#111827]">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="h-[28px] w-[28px] shrink-0 rounded-md accent-[#0864DC]"
            />
            견적서와 약관을 확인했습니다
          </label>
          {saveError && (
            <div className="mt-3 rounded-xl bg-[#FFF1F2] p-3 text-[15px] font-semibold text-[#B42318]">
              {saveError}
            </div>
          )}
          <button
            onClick={() => void confirmReservation()}
            disabled={!checked || saving || !hasData}
            className="mt-3 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#1B76EF] to-[#0757C4] py-4 text-[22px] font-black text-white shadow-[0_4px_12px_rgba(8,100,220,0.35)] disabled:from-[#C7D6EE] disabled:to-[#C7D6EE] disabled:shadow-none"
          >
            <CheckCircle2 className="h-[26px] w-[26px]" strokeWidth={2.2} />
            {saving ? "확정 중..." : "동의하고 예약 확정"}
          </button>
        </>
      )}

      {/* 문의하기 */}
      <a
        href={contactPhone ? `tel:${contactPhone.replace(/-/g, "")}` : undefined}
        className="mt-3 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-[#0864DC] bg-white py-3.5 text-[20px] font-black text-[#0864DC]"
      >
        <Headphones className="h-[24px] w-[24px]" strokeWidth={1.9} /> 문의하기
      </a>
    </div>,
  );
}
