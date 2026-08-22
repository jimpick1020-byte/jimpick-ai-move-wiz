/**
 * 직원 업무용 화면 — 카카오톡으로 받은 보안 링크로 열립니다.
 * 금액·계좌·약관은 없습니다. 현장에서 필요한 정보만 담습니다.
 */
import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { openStaffShare } from "@/lib/staff-share.functions";
import type { StaffSheetSnapshot } from "@/lib/staff-share";
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
} from "lucide-react";

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 border-b border-[#EEF3FB] py-3 last:border-0">
      <span className="mt-0.5 shrink-0 text-[#0864DC]">{icon}</span>
      <span className="w-[86px] shrink-0 text-[14px] font-bold text-[#6B7280]">{label}</span>
      <span className="min-w-0 flex-1 break-words text-[15px] font-bold text-[#111827]">
        {value}
      </span>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] border border-[#DCE8FA] bg-white px-3.5 py-2">
      {title && (
        <div className="border-b border-[#EEF3FB] py-2.5 text-[15px] font-black text-[#0864DC]">
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

  const mapUrl = (addr: string) =>
    `https://map.kakao.com/link/search/${encodeURIComponent(addr)}`;

  return (
    <div className="min-h-[100dvh] bg-[#E9EFF8] pb-10">
      <div className="flex h-[72px] items-center gap-2 bg-[#0864DC] px-4">
        <span className="text-[19px] font-black text-white">JIMPICK 직원용</span>
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
              <ShieldAlert className="h-8 w-8 text-[#DC2626]" />
              <div className="text-[16px] font-black text-[#111827]">{state.error}</div>
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
              <div className="mt-1 text-[20px] font-black text-[#0864DC]">
                {state.snap.moveDate || "이사일 미정"} {state.snap.moveTime || ""}
              </div>
              {state.expiresAt && (
                <div className="mt-1 text-[12.5px] text-[#9CA3AF]">
                  링크 만료 {new Date(state.expiresAt).toLocaleString("ko-KR")}
                </div>
              )}
            </div>

            <Card title="고객">
              <Row icon={<ClipboardList className="h-5 w-5" />} label="이름" value={state.snap.customerName} />
              <Row icon={<Phone className="h-5 w-5" />} label="연락처" value={state.snap.customerPhone} />
              <Row icon={<Calendar className="h-5 w-5" />} label="이사 날짜" value={state.snap.moveDate} />
              <Row icon={<Clock className="h-5 w-5" />} label="시작 시간" value={state.snap.moveTime} />
              <Row icon={<Truck className="h-5 w-5" />} label="이사 유형" value={state.snap.moveType} />
            </Card>

            {state.snap.customerPhone && (
              <a
                href={`tel:${state.snap.customerPhone.replace(/[^0-9+]/g, "")}`}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#0864DC] text-[16px] font-black text-white"
              >
                <Phone className="h-5 w-5" /> 고객 전화 연결
              </a>
            )}

            <Card title="주소">
              <Row
                icon={<MapPin className="h-5 w-5" />}
                label="출발지"
                value={`${state.snap.fromAddress} ${state.snap.fromDetail || ""}`.trim()}
              />
              <Row
                icon={<Building2 className="h-5 w-5" />}
                label="출발 층"
                value={state.snap.fromFloor ? `${state.snap.fromFloor}층` : ""}
              />
              <Row
                icon={<MapPin className="h-5 w-5" />}
                label="도착지"
                value={`${state.snap.toAddress} ${state.snap.toDetail || ""}`.trim()}
              />
              <Row
                icon={<Building2 className="h-5 w-5" />}
                label="도착 층"
                value={state.snap.toFloor ? `${state.snap.toFloor}층` : ""}
              />
              <Row
                icon={<Building2 className="h-5 w-5" />}
                label="엘리베이터"
                value={state.snap.workEnv}
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

            <div className="grid grid-cols-2 gap-2.5">
              {state.snap.fromAddress && (
                <a
                  href={mapUrl(state.snap.fromAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-[56px] items-center justify-center rounded-[16px] border border-[#DCE8FA] bg-white text-[15px] font-black text-[#0864DC]"
                >
                  출발지 지도
                </a>
              )}
              {state.snap.toAddress && (
                <a
                  href={mapUrl(state.snap.toAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-[56px] items-center justify-center rounded-[16px] border border-[#DCE8FA] bg-white text-[15px] font-black text-[#0864DC]"
                >
                  도착지 지도
                </a>
              )}
            </div>

            <Card title="차량">
              <Row icon={<Truck className="h-5 w-5" />} label="차량" value={state.snap.truckText} />
            </Card>

            {state.snap.rooms.length > 0 && (
              <Card title="공간별 품목">
                {state.snap.rooms.map((r) => (
                  <div key={r.name} className="border-b border-[#EEF3FB] py-3 last:border-0">
                    <div className="text-[15px] font-black text-[#111827]">
                      {r.name}{" "}
                      <span className="text-[13px] font-bold text-[#6B7280]">
                        품목 {r.items.length}종 · 총{" "}
                        {r.items.reduce((s, i) => s + (i.qty || 0), 0)}개
                      </span>
                    </div>
                    <div className="mt-1 break-words text-[14.5px] text-[#374151]">
                      {r.items.map((i) => `${i.name} ${i.qty}`).join(" · ")}
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {state.snap.extraWork.length > 0 && (
              <Card title="추가 작업">
                <div className="py-3 text-[15px] font-bold text-[#111827]">
                  {state.snap.extraWork.join(" · ")}
                </div>
              </Card>
            )}

            {state.snap.note && (
              <Card title="현장 안내사항">
                <div className="whitespace-pre-wrap py-3 text-[15px] text-[#374151]">
                  {state.snap.note}
                </div>
              </Card>
            )}

            <Card title="담당자">
              <Row icon={<ClipboardList className="h-5 w-5" />} label="담당자" value={state.snap.staffName} />
              <Row icon={<Phone className="h-5 w-5" />} label="연락처" value={state.snap.staffPhone} />
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
