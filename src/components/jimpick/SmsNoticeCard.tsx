/**
 * 업체용 문자 알림 카드.
 *
 * 업체 화면에는 문자 사용 가능 여부와 내 업체 발송 현황만 보여 줍니다.
 * 알리고 설정값·환경변수 이름·테스트 발송은 서비스 관리자 화면에만 있습니다.
 */
import { useEffect, useState } from "react";
import { Card } from "./ui";
import { getSmsServiceStatus, type SmsServiceStatus } from "@/lib/sms-status.functions";

export function SmsNoticeCard() {
  const [status, setStatus] = useState<SmsServiceStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void getSmsServiceStatus()
      .then((s) => {
        if (alive) setStatus(s);
      })
      .catch(() => {
        if (alive) setError("문자 상태를 확인하지 못했습니다");
      });
    return () => {
      alive = false;
    };
  }, []);

  const label =
    status === null
      ? error || "상태 확인 중…"
      : status.state === "ready"
        ? "문자 보낼 수 있습니다"
        : status.state === "maintenance"
          ? "문자 점검 중입니다"
          : "상태를 확인하지 못했습니다";
  const dot =
    status?.state === "ready"
      ? "bg-[#3E9B78]"
      : status?.state === "maintenance"
        ? "bg-[#D95C5C]"
        : "bg-[#CBD5E1]";
  const color =
    status?.state === "ready"
      ? "text-[#3E9B78]"
      : status?.state === "maintenance"
        ? "text-[#D95C5C]"
        : "text-[#6B7280]";

  return (
    <Card className="space-y-2 rounded-[14px] bg-white">
      <div className="text-[16px] font-bold text-[#25282D]">문자 알림</div>
      <div className="flex items-center gap-1.5">
        <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
        <span className={`text-[14px] font-bold ${color}`}>{label}</span>
      </div>
      <div className="text-[13px] text-[#6B7280]">
        예약 확정 알림 받는 번호:{" "}
        {status?.noticePhoneLast4 ? `010-****-${status.noticePhoneLast4}` : "사업자 정보의 연락처"}
      </div>
      {status && (
        <div className="text-[13px] text-[#6B7280]">
          내 업체 문자 {status.sentCount}건 발송
          {status.failedCount > 0 ? ` · 실패 ${status.failedCount}건` : ""}
        </div>
      )}
      <div className="text-[12px] text-[#9AA3B2]">
        받는 번호는 아래 사업자 정보의 연락처를 씁니다. 문자 설정은 서비스 관리자가 관리합니다.
      </div>
    </Card>
  );
}
