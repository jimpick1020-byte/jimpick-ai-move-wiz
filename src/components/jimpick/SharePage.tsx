import { useEffect, useState } from "react";
import { Link, useParams, useSearch } from "@tanstack/react-router";
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
  Printer,
  Headphones,
  Landmark,
  User,
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
import { MobileShell, TopBar, Card } from "./ui";
import { acceptTerms, getTermsLink } from "@/lib/terms.functions";


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

function ymd(date: string): string {
  const [y, m, d] = (date || "").split("-");
  if (!y || !m || !d) return date || "";
  return `${y}. ${m}. ${d}`;
}

export function SharePage() {
  const { id } = useParams({ from: "/share/$id" });
  const search = useSearch({ from: "/share/$id" }) as { staff?: string; t?: string };
  const staffMode = String(search?.staff ?? "") === "1";
  const token = String(search?.t ?? id).slice(0, 40);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSheet, setOpenSheet] = useState(false);
  const [openFull, setOpenFull] = useState(false);
  const [checked, setChecked] = useState(false);
  const [accepted, setAccepted] = useState<LocalAcceptance | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const e = loadEstimateFromStorage(id);
    setEstimate(e);
    setAccepted(readAcceptance(id));
    setLoading(false);
    // 서버에 이미 남은 동의 기록이 있으면 그것을 우선합니다 (기기가 달라도 유지)
    void getTermsLink({ data: { token } })
      .then((info) => {
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
      .catch(() => {
        /* 서버 기록을 못 읽어도 화면은 그대로 보여 줍니다 */
      });
  }, [id, token]);


  if (loading) {
    return (
      <MobileShell bg="bg-white">
        <TopBar title="견적 공유" />
        <div className="flex-1 flex items-center justify-center text-[#6B7280]">불러오는 중...</div>
      </MobileShell>
    );
  }

  if (!estimate) {
    return (
      <MobileShell bg="bg-white">
        <TopBar title="견적 공유" />
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <div className="text-6xl">📭</div>
          <div className="text-xl font-bold text-[#111827]">견적을 찾을 수 없습니다</div>
          <div className="text-[16px] text-[#6B7280]">
            링크가 만료되었거나, 이 기기에 저장된 견적이 아닙니다.
          </div>
          <Link to="/" className="text-[#0751D8] font-semibold underline">
            JIMPICK 홈으로 가기
          </Link>
        </div>
      </MobileShell>
    );
  }

  const calc = calcEstimate(estimate);
  const total = calc.total;
  const contactPhone = (estimate.staffPhone || "").trim();

  const selectedItems = estimate.rooms.flatMap((room) =>
    Object.entries(room.items)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const catalog = ITEM_CATALOG.find((i) => i.id === itemId);
        return { room: room.name, name: catalog?.name || itemId, qty };
      }),
  );

  const enabledOptions = estimate.options.filter((o) => o.enabled);

  const confirmReservation = () => {
    if (!checked) return;
    const rec: LocalAcceptance = {
      estimateId: estimate.id,
      termsName: TERMS_NAME,
      termsVersion: TERMS_VERSION,
      termsEffectiveAt: TERMS_EFFECTIVE_AT,
      termsSnapshot: termsSnapshot(),
      sheetVersion: estimate.sheetVersion ?? 1,
      accepted: true,
      acceptedAt: Date.now(),
      method: "웹 링크 · 확인란 선택",
      token,
    };
    writeAcceptance(rec);
    setAccepted(rec);
  };

  return (
    <MobileShell bg="bg-[#F5F7FB]">
      <TopBar title={staffMode ? "직원용 작업 지시서" : "이사 견적서 · 표준약관"} />
      <div className="p-4 space-y-4 flex-1 overflow-auto pb-10">
        {/* 로고 */}
        <div className="-mx-4 -mt-4 bg-[#0751D8] py-4 text-center">
          <span className="text-[26px] font-black tracking-tight text-white">JIMPICK</span>
          <span className="ml-2 text-[16px] font-bold text-white/90">짐픽</span>
        </div>

        {!staffMode && (
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[14px] font-bold text-[#111827] shadow-[0_2px_0_#E7EBF2]">
              <ShieldCheck className="h-4 w-4 text-[#12A150]" /> 보안이 적용된 안전한 링크입니다
            </span>
          </div>
        )}

        <h1 className="text-center text-[24px] font-black text-[#111827]">
          {staffMode ? "작업 지시서" : "이사 견적서 · 표준약관"}
        </h1>

        {/* 고객 · 이사일 · 총액 */}
        <Card className="space-y-0 p-0">
          <div className="flex items-center gap-2 border-b border-[#EDF2FA] px-4 py-3.5">
            <User className="h-5 w-5 text-[#0751D8]" />
            <span className="text-[18px] font-black text-[#111827]">
              {estimate.customerName || "고객"} 고객님
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-[#EDF2FA] px-4 py-3.5">
            <span className="inline-flex items-center gap-2 text-[17px] font-bold text-[#111827]">
              <Calendar className="h-5 w-5 text-[#0751D8]" /> 이사일
            </span>
            <span className="text-[17px] font-black text-[#0751D8]">
              {ymd(estimate.moveDate)} {estimate.moveTime}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-[17px] font-bold text-[#111827]">총 견적금액</span>
            <span className="text-[22px] font-black text-[#0751D8]">
              {staffMode ? "금액 미공개" : won(total)}
            </span>
          </div>
          <div className="px-3 pb-3">
            <button
              onClick={() => setOpenSheet((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl bg-[#0751D8] px-4 py-3.5 text-[17px] font-black text-white"
            >
              <span className="inline-flex items-center gap-2">
                <FileText className="h-5 w-5" /> 견적서 보기
              </span>
              {openSheet ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
          </div>
        </Card>

        {/* 견적서 상세 */}
        {openSheet && (
          <>
            <Card className="space-y-2 text-[16px]">
              <div className="text-[17px] font-black">이사 정보</div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#0751D8]" />
                <span>
                  {estimate.customerName} · {estimate.phone}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-[#0751D8]" />
                <span>{estimate.moveType}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-[#0751D8]" />
                <div className="flex-1">
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
              <div className="text-[#6B7280]">
                1톤 {estimate.truck1t}대 · 5톤 {estimate.truck5t}대 · 사다리차 {estimate.ladder}대
              </div>
              {estimate.memo && (
                <div className="mt-2 rounded-xl bg-[#F5F7FB] p-3 text-[#111827]">
                  <span className="font-semibold">고객 메모:</span> {estimate.memo}
                </div>
              )}
            </Card>

            <Card className="space-y-2">
              <div className="flex items-center gap-2 text-[17px] font-black">
                <Package className="h-4 w-4 text-[#0751D8]" />
                <span>선택한 품목</span>
              </div>
              {selectedItems.length === 0 ? (
                <div className="text-[16px] text-[#6B7280]">선택된 품목이 없습니다.</div>
              ) : (
                <div className="max-h-60 space-y-1 overflow-auto">
                  {selectedItems.map((item, idx) => (
                    <div
                      key={`${item.room}-${item.name}-${idx}`}
                      className="flex justify-between text-[16px]"
                    >
                      <span className="text-[#6B7280]">{item.room}</span>
                      <span className="font-medium">
                        {item.name} × {item.qty}
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
                    <span className="font-medium">
                      {staffMode ? "포함" : o.separate ? "별도" : won(o.price)}
                    </span>
                  </div>
                ))}
              </Card>
            )}

            {estimate.specialTerms && (
              <Card className="space-y-2">
                <div className="text-[17px] font-black">특약사항</div>
                <div className="whitespace-pre-line text-[16px] text-[#111827]">
                  {estimate.specialTerms}
                </div>
              </Card>
            )}

            {!staffMode && (
              <Card className="space-y-2">
                <div className="text-[17px] font-black">견적 내역</div>
                {calc.parts.map((p) => (
                  <div key={p.label} className="flex justify-between text-[16px]">
                    <span className="text-[#6B7280]">{p.label}</span>
                    <span className="font-semibold">{won(p.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-[#E7EBF2] pt-2 text-[17px] font-black">
                  <span>합계</span>
                  <span className="text-[#0751D8]">{won(total)}</span>
                </div>
              </Card>
            )}
          </>
        )}

        {/* 계약 진행 정보 — 담당자 연락처와 입금 계좌 */}
        {!staffMode && (
          <Card className="space-y-2.5">
            <div className="text-[17px] font-black">계약 진행 안내</div>
            <div className="flex items-center justify-between text-[16px]">
              <span className="inline-flex items-center gap-2 text-[#6B7280]">
                <User className="h-4 w-4 text-[#0751D8]" /> 담당자
              </span>
              <span className="font-bold">{estimate.staffName?.trim() || "담당자"}</span>
            </div>
            <div className="flex items-center justify-between text-[16px]">
              <span className="inline-flex items-center gap-2 text-[#6B7280]">
                <Phone className="h-4 w-4 text-[#0751D8]" /> 연락처
              </span>
              {contactPhone ? (
                <a href={`tel:${contactPhone.replace(/-/g, "")}`} className="font-black text-[#0751D8] underline">
                  {contactPhone}
                </a>
              ) : (
                <span className="font-bold text-[#6B7280]">업체 연락처 미입력</span>
              )}
            </div>
            <div className="flex items-start justify-between gap-3 text-[16px]">
              <span className="inline-flex items-center gap-2 whitespace-nowrap text-[#6B7280]">
                <Landmark className="h-4 w-4 text-[#0751D8]" /> 입금 계좌
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
            {(estimate.deposit ?? 0) > 0 && (
              <div className="rounded-xl bg-[#F5F7FB] p-3 text-[15px] font-semibold text-[#111827]">
                계약금 {won(estimate.deposit ?? 0)} · 잔금 {won(Math.max(0, total - (estimate.deposit ?? 0)))}
                <div className="text-[#6B7280]">약관 동의는 예약금 결제와 별개입니다.</div>
              </div>
            )}
          </Card>
        )}

        {/* 약관 핵심 요약 */}
        {!staffMode && (
          <Card className="space-y-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-6 w-6 text-[#0751D8]" />
              <div>
                <div className="text-[18px] font-black text-[#111827]">{TERMS_NAME}</div>
                <div className="text-[14px] font-semibold text-[#6B7280]">
                  {TERMS_SOURCE} · 버전 {TERMS_VERSION} · 적용일 {TERMS_EFFECTIVE_AT}
                </div>
              </div>
            </div>
            <div className="space-y-2.5">
              {TERMS_SUMMARY.map((s) => (
                <div key={s.title} className="rounded-xl bg-[#F5F7FB] p-3">
                  <div className="text-[17px] font-black text-[#0751D8]">{s.title}</div>
                  <div className="mt-1 text-[16px] leading-relaxed text-[#111827]">{s.body}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setOpenFull((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border-2 border-[#0751D8] px-4 py-3 text-[17px] font-black text-[#0751D8]"
            >
              약관 전체보기
              {openFull ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
            {openFull && (
              <div className="max-h-[420px] space-y-3 overflow-auto rounded-xl border border-[#E7EBF2] p-3">
                {TERMS_FULL.map((t) => (
                  <div key={t.article}>
                    <div className="text-[16px] font-black text-[#111827]">
                      {t.article} ({t.title})
                    </div>
                    <div className="mt-1 text-[16px] leading-relaxed text-[#334155]">{t.body}</div>
                  </div>
                ))}
                <div className="border-t border-[#E7EBF2] pt-2 text-[14px] font-semibold text-[#6B7280]">
                  {TERMS_NOTICE}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCE8FA] bg-white py-3 text-[16px] font-black text-[#0751D8]"
              >
                <Printer className="h-5 w-5" /> PDF 저장
              </button>
              <a
                href={contactPhone ? `tel:${contactPhone.replace(/-/g, "")}` : undefined}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCE8FA] bg-white py-3 text-[16px] font-black text-[#0751D8]"
              >
                <Headphones className="h-5 w-5" /> 문의하기
              </a>
            </div>
          </Card>
        )}

        {/* 동의 · 예약 확정 */}
        {!staffMode && (
          <div className="space-y-3">
            {accepted ? (
              <Card className="space-y-1 border-2 border-[#12A150]">
                <div className="inline-flex items-center gap-2 text-[18px] font-black text-[#12A150]">
                  <CheckCircle2 className="h-6 w-6" /> 예약이 확정되었습니다
                </div>
                <div className="text-[16px] text-[#111827]">
                  동의 일시: {new Date(accepted.acceptedAt).toLocaleString("ko-KR")}
                </div>
                <div className="text-[16px] text-[#6B7280]">
                  적용 약관: {accepted.termsName} {accepted.termsVersion} · 동의 방식{" "}
                  {accepted.method}
                </div>
              </Card>
            ) : (
              <>
                <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-[16px] font-bold text-[#111827]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                    className="mt-0.5 h-6 w-6 shrink-0 accent-[#0751D8]"
                  />
                  견적서와 이사화물 표준약관을 모두 확인했습니다.
                </label>
                <button
                  onClick={confirmReservation}
                  disabled={!checked}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0751D8] py-4 text-[18px] font-black text-white disabled:bg-[#C7D6EE] disabled:text-white"
                >
                  <CheckCircle2 className="h-6 w-6" /> 동의하고 예약 확정
                </button>
              </>
            )}
          </div>
        )}

        <div className="pt-2 text-center text-[13px] text-[#6B7280]">
          © JIMPICK · 본 견적은 예상 금액이며 실제 이사 비용과 다를 수 있습니다.
        </div>
      </div>
    </MobileShell>
  );
}
