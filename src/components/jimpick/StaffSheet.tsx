/**
 * 직원 업무용 화면 — 카카오톡으로 받은 보안 링크로 열립니다.
 * 금액·계좌·약관은 없습니다. 현장에서 필요한 정보만 담습니다.
 */
import { useEffect, useState } from "react";
import { formatTel } from "@/lib/format-input";
import { useParams } from "@tanstack/react-router";
import { openStaffShare } from "@/lib/staff-share.functions";
import type { StaffSheetSnapshot } from "@/lib/staff-share";
import { Icon3D } from "@/lib/jimpick-icon3d";
import { TmapAddress } from "./TmapAddress";
import { repairStaffSheet } from "@/lib/staff-sheet-display";
import {
  Phone,
  MapPin,
  Calendar,
  Clock,
  Truck,
  Building2,
  ClipboardList,
  ShieldAlert,
  Navigation,
  Package,
  Users,
} from "lucide-react";

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 border-b border-[#EEF3FB] py-3 last:border-0">
      <span className="mt-0.5 shrink-0 text-[#25282D]">{icon}</span>
      <span className="w-[86px] shrink-0 text-[14px] font-bold text-[#6B7280]">{label}</span>
      <span className="min-w-0 flex-1 break-keep text-[15px] font-bold text-[#25282D]">
        {value}
      </span>
    </div>
  );
}

function AddrRow({ label, address, detail, x, y }: { label: string; address: string; detail?: string; x?: number | null; y?: number | null }) {
  const value = `${address} ${detail || ""}`.trim();
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 border-b border-[#EEF3FB] py-3 last:border-0">
      <span className="mt-0.5 shrink-0 text-[#25282D]"><MapPin className="h-5 w-5" /></span>
      <span className="w-[86px] shrink-0 text-[14px] font-bold text-[#6B7280]">{label}</span>
      <TmapAddress label={label} address={address} x={x} y={y} className="min-w-0 flex-1 break-keep text-[15px] font-bold text-[#25282D]">{value}</TmapAddress>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] border border-[#E5E7EB] bg-white px-3.5 py-2">
      {title && (
        <div className="border-b border-[#EEF3FB] py-2.5 text-[15px] font-black text-[#25282D]">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

export function StaffSheet() {
  const { token } = useParams({ from: "/staff/estimate/$token" });
  const [state, setState] = useState<{
    loading: boolean;
    error?: string;
    snap?: StaffSheetSnapshot;
    expiresAt?: string;
  }>({ loading: true });

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await openStaffShare({ data: { token } });
        if (!alive) return;
        if (!r.ok || !r.snapshot) {
          setState({ loading: false, error: r.error ?? "열 수 없는 링크입니다." });
          return;
        }
        setState({ loading: false, snap: r.snapshot, expiresAt: r.expiresAt });
      } catch {
        if (alive) setState({ loading: false, error: "네트워크 오류가 발생했습니다." });
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  return <StaffSheetView state={state} />;
}

export function StaffSheetView({ state }: { state: { loading: boolean; error?: string; snap?: StaffSheetSnapshot; expiresAt?: string } }) {
  state = { ...state, snap: state.snap ? repairStaffSheet(state.snap) : undefined };

  return (
    <div className="min-h-[100dvh] bg-[#E9EFF8] pb-10">
      <div className="flex h-[72px] items-center gap-2 bg-[#3578C8] px-4">
        <span className="text-[19px] font-black text-white">견적잇 직원용</span>
      </div>

      <div className="mx-auto w-full max-w-[430px] space-y-3 px-3.5 py-4">
        {state.loading && (
          <Card>
            <div className="py-8 text-center text-[15px] font-bold text-[#6B7280]">
              이사정보를 불러오는 중…
            </div>
          </Card>
        )}

        {!state.loading && state.error && (
          <Card>
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <ShieldAlert className="h-8 w-8 text-[#D95C5C]" />
              <div className="text-[16px] font-black text-[#25282D]">{state.error}</div>
              <div className="text-[14px] text-[#6B7280]">
                고객정보는 표시되지 않습니다. 담당자에게 새 링크를 요청해 주세요.
              </div>
            </div>
          </Card>
        )}

        {state.snap && (
          <>
            <div className="rounded-[16px] bg-white px-3.5 py-3">
              <div className="text-[13px] font-bold text-[#6B7280]">
                작업 지시서 {state.snap.sheetNo ? `· ${state.snap.sheetNo}` : ""}
              </div>
              <div className="mt-1 text-[20px] font-black text-[#25282D]">
                {state.snap.moveDate || "이사일 미정"} {state.snap.moveTime || ""}
              </div>
              {state.expiresAt && (
                <div className="mt-1 text-[12.5px] text-[#9CA3AF]">
                  링크 만료 {new Date(state.expiresAt).toLocaleString("ko-KR")}
                </div>
              )}
            </div>

            <Card title="고객">
              <Row
                icon={<ClipboardList className="h-5 w-5" />}
                label="이름"
                value={state.snap.customerName}
              />
              <Row
                icon={<Phone className="h-5 w-5" />}
                label="연락처"
                value={formatTel(state.snap.customerPhone)}
              />
              <Row
                icon={<Calendar className="h-5 w-5" />}
                label="이사 날짜"
                value={state.snap.moveDate}
              />
              <Row
                icon={<Clock className="h-5 w-5" />}
                label="시작 시간"
                value={state.snap.moveTime}
              />
              <Row
                icon={<Truck className="h-5 w-5" />}
                label="이사 유형"
                value={state.snap.moveType}
              />
              <Row
                icon={<Package className="h-5 w-5" />}
                label="평수"
                value={state.snap.sizeTab || "평수 미입력"}
              />
            </Card>

            {state.snap.customerPhone && (
              <a
                href={`tel:${state.snap.customerPhone.replace(/[^0-9+]/g, "")}`}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#3578C8] text-[16px] font-black text-white"
              >
                <Phone className="h-5 w-5" /> 고객 전화 연결
              </a>
            )}

            <Card title="주소">
              <AddrRow label="출발지" address={state.snap.fromAddress} detail={state.snap.fromDetail} x={state.snap.fromX} y={state.snap.fromY} />
              <Row
                icon={<Building2 className="h-5 w-5" />}
                label="출발 조건"
                value={
                  state.snap.fromEnv ?? (state.snap.fromFloor ? `${state.snap.fromFloor}층` : "")
                }
              />
              <AddrRow label="도착지" address={state.snap.toAddress} detail={state.snap.toDetail} x={state.snap.toX} y={state.snap.toY} />
              <Row
                icon={<Building2 className="h-5 w-5" />}
                label="도착 조건"
                value={state.snap.toEnv ?? (state.snap.toFloor ? `${state.snap.toFloor}층` : "")}
              />
              <Row
                icon={<Navigation className="h-5 w-5" />}
                label="이동"
                value={
                  state.snap.distanceKm
                    ? `${state.snap.distanceKm}km · 약 ${state.snap.durationMin}분`
                    : ""
                }
              />
            </Card>

            <Card title="차량">
              <Row icon={<Truck className="h-5 w-5" />} label="차량" value={state.snap.truckText} />
                <Row icon={<Users className="h-5 w-5" />} label="작업 인원" value={[
                  (state.snap.workers ?? 0) > 0 ? `남자 작업자 ${state.snap.workers}명` : "",
                  (state.snap.kitchenStaff ?? 0) > 0 ? `주방 작업자 ${state.snap.kitchenStaff}명` : "",
                ].filter(Boolean).join(" · ")} />
            </Card>

            {state.snap.rooms.length > 0 && (
              <section aria-labelledby="staff-room-items-title">
                <h2
                  id="staff-room-items-title"
                  className="mb-2 px-1 text-[17px] font-black text-[#25282D]"
                >
                  공간별 품목
                </h2>
                <div className="space-y-2">
                  {state.snap.rooms.map((room) => (
                    <div
                      key={room.name}
                      className="flex items-stretch gap-2 rounded-[14px] border border-[#E5E7EB] bg-white p-2.5"
                    >
                      <div className="flex w-[64px] shrink-0 items-center justify-center">
                        <span className="break-keep text-center text-[17px] font-black text-[#25282D]">
                          {room.name}
                        </span>
                      </div>
                      <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-2 gap-y-2 border-l border-[#E5E7EB] pl-2.5">
                        {room.items.map((item, index) => {
                          // 새 공유는 고유 품목 ID의 저장값을 사용합니다. 기존 공유는 보존된 문구로 호환합니다.
                          const isDisposal = !!item.disposal || /\(폐기\)\s*$/.test(item.name);
                          return (
                            <div
                              key={`${item.id ?? item.name}-${index}`}
                              className="flex min-w-0 items-center gap-1.5"
                            >
                              <span className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-[#F7F8F5]">
                                <Icon3D
                                  src={item.icon ?? "none:no-image"}
                                  alt={item.name}
                                  size={40}
                                />
                                {isDisposal && (
                                  <span aria-hidden="true" className="pointer-events-none absolute inset-[3px]">
                                    <span className="absolute left-1/2 top-1/2 h-[5px] w-[50px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-[#DC2626] shadow-[0_1px_2px_rgba(255,255,255,0.9)]" />
                                    <span className="absolute left-1/2 top-1/2 h-[5px] w-[50px] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-[#DC2626] shadow-[0_1px_2px_rgba(255,255,255,0.9)]" />
                                  </span>
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="block break-words text-[15px] font-medium leading-tight text-[#25282D]">
                                {item.name.replace(/\s*\(폐기\)\s*$/, "")}
                                </span>
                                <span className="mt-0.5 block text-[15px] font-bold text-[#25282D]">
                                  {item.qty}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {state.snap.extraWork.length > 0 && (
              <Card title="추가 작업">
                <div className="py-2 text-[15px] text-foreground">
                  {(state.snap.extraWorkItems ? [
                    ...state.snap.extraWorkItems,
                    ...state.snap.extraWork.filter(name => name.startsWith("사다리차 ")).map((name, index) => ({ id: `ladder-${index}`, name: name.replace(/ · 별도$/, ""), separate: name.endsWith(" · 별도") })),
                  ] : state.snap.extraWork.map((name, index) => ({ id: String(index), name: name.replace(/ · 별도$/, ""), separate: name.endsWith(" · 별도") }))).map(work => (
                    <div key={work.id} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="min-w-0 break-words">{work.name}</span>
                      {work.separate && <span className="shrink-0 font-bold">별도</span>}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {state.snap.specialTerms?.trim() && (
              <Card title="특약사항">
                <div className="whitespace-pre-wrap py-3 text-[15px] text-[#6B7280]">
                  {state.snap.specialTerms.trim()}
                </div>
              </Card>
            )}

            {state.snap.note && (
              <Card title="현장 안내사항">
                <div className="whitespace-pre-wrap py-3 text-[15px] text-[#6B7280]">
                  {state.snap.note}
                </div>
              </Card>
            )}

            <Card title="담당자">
              <Row
                icon={<ClipboardList className="h-5 w-5" />}
                label="담당자"
                value={state.snap.staffName}
              />
              <Row
                icon={<Phone className="h-5 w-5" />}
                label="연락처"
                value={formatTel(state.snap.staffPhone)}
              />
            </Card>

            <div className="pt-1 text-center text-[12.5px] text-[#9CA3AF]">
              업무용 정보입니다. 외부에 공유하지 마세요.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
