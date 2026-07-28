import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { Home, Phone, Calendar, MapPin, Truck, Package, CheckCircle } from "lucide-react";
import {
  ITEM_CATALOG,
  calcEstimate,
  loadEstimateFromStorage,
  won,
  type Estimate,
} from "@/lib/jimpick";
import { MobileShell, TopBar, Card, PrimaryButton } from "./ui";
import truckImg from "@/assets/jimpick-truck.png";

export function SharePage() {
  const { id } = useParams({ from: "/share/$id" });
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const e = loadEstimateFromStorage(id);
    setEstimate(e);
    setLoading(false);
  }, [id]);

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
          <div className="text-sm text-[#6B7280]">
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

  const selectedItems = estimate.rooms.flatMap((room) =>
    Object.entries(room.items)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const catalog = ITEM_CATALOG.find((i) => i.id === itemId);
        return { room: room.name, name: catalog?.name || itemId, qty };
      })
  );

  const enabledOptions = estimate.options.filter((o) => o.enabled);

  return (
    <MobileShell bg="bg-white">
      <TopBar title="고객용 견적서" />
      <div className="p-5 space-y-4 flex-1 overflow-auto">
        {/* Header branding */}
        <div className="text-center pb-2">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-3xl font-black text-[#0751D8] tracking-tight">JIMPICK</span>
            <span className="text-sm font-bold text-white bg-[#0751D8] rounded-md px-2 py-0.5">7.0</span>
          </div>
          <div className="text-sm text-[#6B7280] mt-1">AI 이사 견적</div>
        </div>

        {/* Total amount */}
        <div
          className="rounded-2xl p-6 text-white text-center"
          style={{ background: "linear-gradient(135deg, #0A2A6C 0%, #0751D8 100%)" }}
        >
          <div className="text-sm opacity-90">예상 견적 금액</div>
          <div className="text-4xl font-black my-2">{won(total)}</div>
          <div className="text-xs opacity-80">VAT 별도</div>
        </div>

        {/* Customer info */}
        <Card className="space-y-2 text-sm">
          <div className="font-bold text-base mb-1">이사 정보</div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#0751D8]" />
            <span>{estimate.customerName} · {estimate.phone}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0751D8]" />
            <span>{estimate.moveDate} {estimate.moveTime}</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#0751D8]" />
            <span>{estimate.moveType}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-[#0751D8] mt-0.5" />
            <div className="flex-1">
              <div>출발: {estimate.fromAddress} {estimate.fromDetail}</div>
              <div>도착: {estimate.toAddress} {estimate.toDetail}</div>
            </div>
          </div>
          <div className="text-[#6B7280] pt-1">
            거리 {estimate.distanceKm}km · {estimate.workEnv} · {estimate.fromFloor}층 → {estimate.toFloor}층
          </div>
          <div className="text-[#6B7280]">
            1톤 {estimate.truck1t}대 · 5톤 {estimate.truck5t}대 · 사다리차 {estimate.ladder}대
          </div>
          {estimate.memo && (
            <div className="bg-[#F5F7FB] rounded-xl p-3 mt-2 text-[#111827]">
              <span className="font-semibold">고객 메모:</span> {estimate.memo}
            </div>
          )}
        </Card>

        {/* Items */}
        <Card className="space-y-2">
          <div className="flex items-center gap-2 font-bold text-base">
            <Package className="w-4 h-4 text-[#0751D8]" />
            <span>선택한 품목</span>
          </div>
          {selectedItems.length === 0 ? (
            <div className="text-sm text-[#6B7280]">선택된 품목이 없습니다.</div>
          ) : (
            <div className="space-y-1 max-h-60 overflow-auto">
              {selectedItems.map((item, idx) => (
                <div key={`${item.room}-${item.name}-${idx}`} className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">{item.room}</span>
                  <span className="font-medium">{item.name} × {item.qty}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Options */}
        {enabledOptions.length > 0 && (
          <Card className="space-y-2">
            <div className="font-bold text-base">추가 옵션</div>
            {enabledOptions.map((o) => (
              <div key={o.id} className="flex justify-between text-sm">
                <span>{o.name}</span>
                <span className="font-medium">{o.separate ? "별도" : won(o.price)}</span>
              </div>
            ))}
          </Card>
        )}

        {/* Special terms */}
        {estimate.specialTerms && (
          <Card className="space-y-2">
            <div className="font-bold text-base">특약사항</div>
            <div className="text-sm text-[#111827] whitespace-pre-line">{estimate.specialTerms}</div>
          </Card>
        )}

        {/* Breakdown */}
        <Card className="space-y-2">
          <div className="font-bold text-base">견적 내역</div>
          {calc.parts.map((p) => (
            <div key={p.label} className="flex justify-between text-sm">
              <span className="text-[#6B7280]">{p.label}</span>
              <span className="font-semibold">{won(p.amount)}</span>
            </div>
          ))}
          <div className="border-t border-[#E7EBF2] pt-2 flex justify-between font-bold">
            <span>합계</span>
            <span className="text-[#0751D8]">{won(total)}</span>
          </div>
        </Card>

        {/* Contact CTA */}
        <a
          href={`tel:${estimate.phone.replace(/-/g, "")}`}
          className="flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white"
          style={{ background: "linear-gradient(180deg, #4A94FF 0%, #0751D8 100%)" }}
        >
          <Phone className="w-5 h-5" /> 업체에 문의하기
        </a>

        <div className="text-center text-xs text-[#6B7280] pt-2">
          © JIMPICK · 본 견적은 예상 금액이며 실제 이사 비용과 다를 수 있습니다.
        </div>
      </div>
    </MobileShell>
  );
}
