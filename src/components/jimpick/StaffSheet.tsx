/**
 * 직원 업무용 화면 — 카카오톡으로 받은 보안 링크로 열립니다.
 * 금액·계좌·약관은 없습니다. 현장에서 필요한 정보만 담습니다.
 */
import { useRetainedRefresh } from "@/lib/use-retained-refresh";
import { useRef } from "react";
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
  ClipboardList,
  ShieldAlert,
  Navigation,
  Package,
  User,
  Timer,
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

function AddrRow({ label, address, detail, x, y, sub }: { label: string; address: string; detail?: string; x?: number | null; y?: number | null; sub?: string }) {
  const value = `${address} ${detail || ""}`.trim();
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 border-b border-[#E5E7EB] py-4 last:border-0">
      <span className="mt-0.5 shrink-0 text-[#25282D]"><MapPin className="h-5 w-5" /></span>
      <span className="w-[52px] shrink-0 text-[16px] font-black text-[#25282D]">{label}</span>
      <div className="min-w-0 flex-1">
        <TmapAddress label={label} address={address} x={x} y={y} className="break-keep text-[16px] font-medium text-[#25282D]">{value}</TmapAddress>
        {sub && <div className="mt-1 break-keep text-[14px] text-[#9CA3AF]">{sub}</div>}
      </div>
    </div>
  );
}

function InfoLine({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex min-w-0 items-center gap-2.5 text-[#25282D]"><span className="shrink-0">{icon}</span><span className="min-w-0 break-keep">{children}</span></div>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 px-3 py-4">
      <span className="shrink-0 text-[#25282D]">{icon}</span>
      <span className="min-w-0">
        <span className="block break-keep text-[13px] text-[#6B7280]">{label}</span>
        <span className="block break-keep text-[16px] font-black text-[#25282D]">{value}</span>
      </span>
    </div>
  );
}

/** 차량 칸에는 트럭 종류와 대수만 (사다리차 표시 제외, 원본 자료는 그대로) */
function truckOnly(text: string) {
  return (text || "").split(" · ").filter(part => part && !part.startsWith("사다리차")).join(" · ");
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
  const openedToken = useRef("");
  const result = useRetainedRefresh(token, async () => {
    const r = await openStaffShare({ data: { token, refresh: openedToken.current === token } });
    if (r.ok) openedToken.current = token;
    return r;
  }, r => r.ok && !!r.snapshot);
  return <StaffSheetView state={{ loading: !result.data && result.refreshing, snap: result.data?.snapshot,
    expiresAt: result.data?.expiresAt, error: result.rejected ? "열 수 없는 링크입니다." : result.error }} />;
}

export function StaffSheetView({ state }: { state: { loading: boolean; error?: string; snap?: StaffSheetSnapshot; expiresAt?: string } }) {
  state = { ...state, snap: state.snap ? repairStaffSheet(state.snap) : undefined };

  return (
    <div className="min-h-[100dvh] bg-[#F3F4F6] pb-10">
      <div className="flex h-[72px] items-center gap-2 bg-[#3578C8] px-4">
        <span className="text-[19px] font-black text-white">작업지시서</span>
      </div>

      <div className="mx-auto w-full max-w-[430px] space-y-3 px-3.5 py-4">
        {state.loading && (
          <Card>
            <div className="py-8 text-center text-[15px] font-bold text-[#6B7280]">
              이사정보를 불러오는 중…
            </div>
          </Card>
        )}

        {state.snap && state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        {!state.loading && state.error && !state.snap && (
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
            <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
              {state.snap.sheetNo && <div className="text-[14px] font-bold text-[#6B7280]">{state.snap.sheetNo}</div>}
              <h1 className="mt-0.5 break-keep text-[24px] font-black leading-tight text-[#25282D]">
                {state.snap.companyName ? `${state.snap.companyName} ` : ""}작업지시서
              </h1>
              {state.expiresAt && (
                <div className="mt-1 text-[12.5px] text-[#9CA3AF]">
                  링크 만료 {new Date(state.expiresAt).toLocaleString("ko-KR")}
                </div>
              )}
              <div className="mt-3 space-y-2.5 border-t border-[#E5E7EB] pt-3 text-[16px]">
                {state.snap.customerName && (
                  <InfoLine icon={<User className="h-5 w-5" />}><b className="font-black">{state.snap.customerName}</b> <span className="text-[#6B7280]">고객님</span></InfoLine>
                )}
                {state.snap.customerPhone && (
                  <InfoLine icon={<Phone className="h-5 w-5" />}><span className="text-[#6B7280]">연락처</span> <a className="font-black" href={`tel:${state.snap.customerPhone.replace(/[^0-9+]/g, "")}`}>{formatTel(state.snap.customerPhone)}</a></InfoLine>
                )}
                <InfoLine icon={<Calendar className="h-5 w-5" />}><span className="text-[#6B7280]">이사일</span> <b className="font-black">{state.snap.moveDate || "미정"}</b></InfoLine>
                <InfoLine icon={<Package className="h-5 w-5" />}><span className="text-[#6B7280]">출발지 평수</span> {state.snap.sizeTab ? <b className="font-black">{state.snap.sizeTab}</b> : <b className="font-black text-[#D95C5C]">미입력</b>}</InfoLine>
                <InfoLine icon={<Package className="h-5 w-5" />}><span className="text-[#6B7280]">도착지 평수</span> {state.snap.toSizeTab ? <b className="font-black">{state.snap.toSizeTab}</b> : <b className="font-black text-[#D95C5C]">미입력</b>}</InfoLine>
              </div>
            </div>

            {(state.snap.moveTime || state.snap.distanceKm > 0) && (
              <div className="grid grid-cols-3 divide-x divide-[#E5E7EB] rounded-[20px] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                <Stat icon={<Clock className="h-5 w-5" />} label="시작 시간" value={state.snap.moveTime || "-"} />
                <Stat icon={<Navigation className="h-5 w-5" />} label="이동 거리" value={state.snap.distanceKm ? `${state.snap.distanceKm}km` : "-"} />
                <Stat icon={<Timer className="h-5 w-5" />} label="예상 이동시간" value={state.snap.durationMin ? `${state.snap.durationMin}분` : "-"} />
              </div>
            )}

            <div className="rounded-[20px] bg-white px-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
              <AddrRow label="출발지" address={state.snap.fromAddress} detail={state.snap.fromDetail} x={state.snap.fromX} y={state.snap.fromY}
                sub={state.snap.fromEnv ?? (state.snap.fromFloor ? `${state.snap.fromFloor}층` : "")} />
              <AddrRow label="도착지" address={state.snap.toAddress} detail={state.snap.toDetail} x={state.snap.toX} y={state.snap.toY}
                sub={state.snap.toEnv ?? (state.snap.toFloor ? `${state.snap.toFloor}층` : "")} />
            </div>

            {state.snap.specialTerms?.trim() && (
              <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                <div className="text-[18px] font-black text-[#25282D]">특약사항</div>
                <div className="mt-2 whitespace-pre-wrap text-[15px] text-[#6B7280]">{state.snap.specialTerms.trim()}</div>
              </div>
            )}

            {(() => { const truck = truckOnly(state.snap.truckText); return (truck || state.snap.moveType) ? (
              <div className="grid grid-cols-2 divide-x divide-[#E5E7EB] rounded-[20px] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                <Stat icon={<Truck className="h-5 w-5" />} label="차량" value={truck || "-"} />
                <Stat icon={<Package className="h-5 w-5" />} label="이사 유형" value={state.snap.moveType || "-"} />
              </div>
            ) : null; })()}

            {((state.snap.workers ?? 0) > 0 || (state.snap.kitchenStaff ?? 0) > 0) && (
              <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                <div className="flex items-center gap-2 text-[18px] font-black text-[#25282D]"><User className="h-5 w-5" /> 작업 인원</div>
                {(state.snap.workers ?? 0) > 0 && <div className="mt-2 flex justify-between text-[16px]"><span className="text-[#6B7280]">남자 작업자</span><b className="font-black">{state.snap.workers}명</b></div>}
                {(state.snap.kitchenStaff ?? 0) > 0 && <div className="mt-2 flex justify-between text-[16px]"><span className="text-[#6B7280]">주방 작업자</span><b className="font-black">{state.snap.kitchenStaff}명</b></div>}
              </div>
            )}

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
                      className="flex items-stretch gap-2 rounded-[20px] bg-white p-3 shadow-[0_1px_3px_rgba(16,24,40,0.06)]"
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
                              <span className="relative flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-[#F7F8F5]">
                                <Icon3D
                                  src={item.icon ?? "none:no-image"}
                                  alt={item.name}
                                  size={44}
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

            {(() => {
              const works = (state.snap.extraWorkItems ?? state.snap.extraWork.map((name, index) => ({ id: String(index), name: name.replace(/ · 별도$/, ""), separate: name.endsWith(" · 별도") })))
                .filter(work => !work.name.startsWith("사다리차"));
              return works.length > 0 ? (
                <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                  <div className="text-[18px] font-black text-[#25282D]">추가 작업</div>
                  <div className="mt-1 text-[16px] text-[#25282D]">
                    {works.map(work => (
                      <div key={work.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0 break-words">{work.name}</span>
                        {work.separate && <span className="shrink-0 font-black">별도</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

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
