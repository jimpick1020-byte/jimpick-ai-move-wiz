/**
 * 종이형 이사 견적서.
 *
 * 앞 단계에서 사장님이 넣은 값을 그대로 가져와 채웁니다.
 * 비어 있는 항목은 "없음"이라고 적지 않고 그 줄을 통째로 감춥니다.
 *
 * 확정한 뒤에는 sheetSnapshot 을 우선 사용해, 단가나 신청정보가
 * 나중에 바뀌어도 이미 보낸 견적서 금액이 흔들리지 않게 합니다.
 */
import { forwardRef } from "react";
import type { Estimate } from "@/lib/jimpick";
import { won } from "@/lib/jimpick";

/** 2026-08-20 → 2026년 8월 20일 */
function ymd(v: string | number | Date): string {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
import { ItemArt } from "@/lib/jimpick-art";
import logoImg from "@/assets/jimpick-logo.png";

export interface SheetRoom {
  name: string;
  items: { id: string; name: string; qty: number }[];
}

/** 한 줄 — 값이 없으면 아무것도 그리지 않습니다 */
function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value || !String(value).trim()) return null;
  return (
    <tr>
      <th className="w-[92px] border border-[#C9DBF5] bg-[#EAF2FF] px-2 py-2 text-center text-[15px] font-black text-[#0751D8]">
        {label}
      </th>
      <td className="border border-[#C9DBF5] px-3 py-2 text-left text-[16px] font-bold text-[#111827]">
        {value}
      </td>
    </tr>
  );
}

/** 금액 한 줄 */
function MoneyRow({ label, amount }: { label: string; amount: number }) {
  if (!amount) return null;
  return (
    <tr>
      <th className="w-[120px] border border-[#C9DBF5] bg-[#EAF2FF] px-2 py-2 text-center text-[15px] font-black text-[#0751D8]">
        {label}
      </th>
      <td className="border border-[#C9DBF5] px-3 py-2 text-right text-[16px] font-bold tabular-nums text-[#111827]">
        {won(amount)}
      </td>
    </tr>
  );
}

export interface EstimateSheetProps {
  draft: Estimate;
  rooms: SheetRoom[];
  parts: { label: string; amount: number }[];
  total: number;
  /** 화면 캡처(PDF·이미지)를 위해 바깥에서 참조를 받습니다 */
  companyName?: string;
  companyPhone?: string;
}

export const EstimateSheet = forwardRef<HTMLDivElement, EstimateSheetProps>(function EstimateSheet(
  { draft, rooms, parts, total, companyPhone },
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

  const truckText = [
    draft.truck5t > 0 ? `5톤 ${draft.truck5t}대` : "",
    draft.truck1t > 0 ? `1톤 ${draft.truck1t}대` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const envText = String(draft.workEnv || "");
  const floorText =
    draft.fromFloor || draft.toFloor ? `${draft.fromFloor}층 → ${draft.toFloor}층` : "";

  return (
    <div ref={ref} className="bg-white px-3 py-3">
      {/* 로고 */}
      <div className="mb-2 flex items-center justify-center gap-2">
        <img src={logoImg} alt="JIMPICK" className="h-9 w-9 object-contain" />
        <span className="text-[26px] font-black tracking-tight text-[#0751D8]">JIMPICK</span>
      </div>

      {/* 종이 — 이중 테두리 */}
      <div className="rounded-[6px] border-[3px] border-[#2F63AE] bg-[#FBFCFE] p-1.5">
        <div className="border border-[#8FB3E4] px-3 py-4">
          <h1 className="text-center text-[34px] font-black leading-tight tracking-tight text-[#12233F]">
            짐픽 이사 견적서
          </h1>
          {version > 1 && (
            <div className="mt-1 text-center text-[15px] font-black text-[#B45309]">
              {version}차 수정 견적서
            </div>
          )}
          <div className="mx-auto mt-2 mb-4 flex items-center justify-center gap-2">
            <span className="h-px w-16 bg-[#8FB3E4]" />
            <span className="text-[#2F63AE]">◆</span>
            <span className="h-px w-16 bg-[#8FB3E4]" />
          </div>

          {/* 기본 정보 */}
          <table className="w-full border-collapse">
            <tbody>
              <Row label="견적번호" value={draft.sheetNo} />
              <Row label="작성일" value={ymd(draft.createdAt)} />
              <Row label="고객명" value={draft.customerName ? `${draft.customerName} 님` : ""} />
              <Row label="연락처" value={draft.phone} />
              <Row label="이사일" value={draft.moveDate ? ymd(draft.moveDate) : ""} />
              <Row label="시작 시간" value={String(draft.moveTime || "").trim()} />
              <Row label="이동 거리" value={draft.distanceKm ? `${draft.distanceKm}km` : ""} />
              <Row
                label="예상 이동시간"
                value={draft.durationMin ? `${draft.durationMin}분` : ""}
              />
              <Row label="출발지" value={`${draft.fromAddress} ${draft.fromDetail || ""}`.trim()} />
              <Row label="도착지" value={`${draft.toAddress} ${draft.toDetail || ""}`.trim()} />
              <Row label="층수" value={floorText} />
              <Row label="작업환경" value={envText} />
              <Row label="차량" value={truckText} />
              <Row label="이사 유형" value={draft.moveType} />
            </tbody>
          </table>

          {/* 선택 품목 */}
          {rooms.length > 0 && (
            <>
              <div className="mt-5 mb-2 flex items-center justify-center gap-2">
                <span className="h-px w-10 bg-[#8FB3E4]" />
                <span className="text-[17px] font-black text-[#0751D8]">선택 품목</span>
                <span className="h-px w-10 bg-[#8FB3E4]" />
              </div>
              <div className="space-y-2">
                {rooms.map((r) => (
                  <div
                    key={r.name}
                    className="break-inside-avoid rounded-md border border-[#C9DBF5] px-2.5 py-2"
                  >
                    <div className="text-[15px] font-black text-[#0751D8]">
                      {r.name}
                      <span className="ml-1.5 text-[13px] font-bold text-[#6B7280]">
                        품목 {r.items.length}종 · 총 {r.items.reduce((s, it) => s + it.qty, 0)}개
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-2">
                      {r.items.map((it) => (
                        <span
                          key={it.id + it.name}
                          className="flex min-w-0 items-center gap-1.5"
                        >
                          <ItemArt id={it.id} name={it.name} size={48} />
                          <span className="text-[14px] font-bold leading-tight text-[#111827]">
                            {it.name} {it.qty}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 금액 */}
          <table className="mt-5 w-full border-collapse">
            <tbody>
              <MoneyRow label="기본 운송비" amount={transport} />
              <MoneyRow label="추가 작업비" amount={extraWork} />
              <MoneyRow label="할인 금액" amount={discount} />
              <MoneyRow label="예약금" amount={deposit} />
              <MoneyRow label="잔금" amount={deposit ? balance : 0} />
            </tbody>
          </table>

          {/* 총액 */}
          <div className="mt-3 flex items-center justify-between rounded-md border-2 border-[#2F63AE] bg-[#EAF2FF] px-3 py-3">
            <span className="text-[18px] font-black text-[#0751D8]">총 견적금액</span>
            <span className="text-[30px] font-black leading-none tabular-nums text-[#0751D8]">
              {won(total)}
            </span>
          </div>

          <p className="mt-4 text-center text-[15px] font-bold text-[#334155]">
            {draft.sheetNote?.trim() || "위 내용으로 정성껏 이사해 드리겠습니다."}
          </p>

          <div className="my-3 border-t border-dashed border-[#B9CFEC]" />

          {/* 담당자 · 도장 */}
          <div className="flex items-center justify-center gap-3">
            <span className="text-[16px] font-black text-[#0751D8]">짐픽 담당자</span>
            <span className="font-serif text-[24px] font-bold italic text-[#12233F]">
              {draft.staffName?.trim() || "담당자"}
            </span>
            <span className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full border-2 border-[#2F63AE] text-center leading-none">
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-[7px] font-black tracking-widest text-[#2F63AE]">JIMPICK</span>
                <span className="text-[15px] font-black text-[#2F63AE]">짐픽</span>
                <span className="text-[7px] font-black tracking-widest text-[#2F63AE]">JIMPICK</span>
              </span>
            </span>
          </div>

          {/* 담당자 연락처 · 입금 계좌 — 고객이 계약을 진행할 때 필요한 정보입니다 */}
          <table className="mt-4 w-full border-collapse">
            <tbody>
              <Row label="담당자" value={draft.staffName?.trim() || null} />
              <Row label="연락처" value={draft.staffPhone?.trim() || companyPhone || null} />
              <Row
                label="입금 계좌"
                value={
                  draft.bankAccount?.trim()
                    ? `${draft.bankName?.trim() ?? ""} ${draft.bankAccount.trim()}${
                        draft.bankHolder?.trim() ? ` (예금주 ${draft.bankHolder.trim()})` : ""
                      }`.trim()
                    : null
                }
              />
            </tbody>
          </table>

        </div>
      </div>
    </div>
  );
});
