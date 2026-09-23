/**
 * 문자발송 설정 (사장님 · 관리자 전용).
 *
 * 기본 화면에는 연결 상태만 간단히 보여 주고, "설정 관리"를 눌렀을 때만
 * 상세(설정 상태 확인 · 테스트 발송)를 펼칩니다.
 *
 * 알리고 아이디·키·발신번호(전체)·이메일 주소는 어떤 화면에도 표시하지 않습니다.
 * 알리고 키는 Supabase Secrets 에만 있고, 여기서는 "설정되어 있는지"만 확인합니다.
 * 문자발송 로직·환경변수는 그대로 두고, 이 파일은 화면 표시만 정리합니다.
 */
import { useEffect, useState } from "react";
import { Card, TextInput } from "./ui";
import { tap } from "@/lib/feedback";
import { isSendablePhone } from "@/lib/sms";
import {
  checkSmsConfig,
  sendTestSms,
  type EdgeSmsResult,
  type SmsConfigStatus,
} from "@/lib/sms.edge";

const TEST_PHONE_KEY = "jimpick_test_phone";

/** 화면에는 뒷자리만 보여 줍니다 (전체 번호 노출 금지) */
function maskPhone(p: string): string {
  const d = (p || "").replace(/[^0-9]/g, "");
  return d.length >= 4 ? `010-****-${d.slice(-4)}` : "번호 없음";
}

type ConnState = "checking" | "connected" | "needSetup" | "error";

export function SmsConnectionCard({
  ownerPhone = "",
  onNeedLogin,
}: {
  ownerPhone?: string;
  onNeedLogin?: () => void;
}) {
  const [config, setConfig] = useState<SmsConfigStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<EdgeSmsResult | null>(null);

  const check = async () => {
    setChecking(true);
    try {
      setConfig(await checkSmsConfig());
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // 연결 상태를 한눈에 보여 주기 위해 처음에 한 번 확인합니다.
    void check();
    try {
      setPhone(localStorage.getItem(TEST_PHONE_KEY) || "");
    } catch {
      /* 저장소를 못 읽어도 입력은 됩니다 */
    }
  }, []);

  const cfgBools: [string, boolean][] = config?.config
    ? (Object.entries(config.config).filter(([, v]) => typeof v === "boolean") as [
        string,
        boolean,
      ][])
    : [];
  const allConfigured =
    !!config?.ok &&
    cfgBools.length > 0 &&
    cfgBools.every(([, v]) => v) &&
    !(config?.missing && config.missing.length > 0);

  const state: ConnState = !config
    ? "checking"
    : config.error
      ? "error"
      : allConfigured
        ? "connected"
        : "needSetup";

  const dot =
    state === "connected" ? "bg-[#3E9B78]" : state === "checking" ? "bg-[#CBD5E1]" : "bg-[#D95C5C]";
  const label =
    state === "connected"
      ? "문자발송 연결됨"
      : state === "needSetup"
        ? "문자발송 설정 필요"
        : state === "error"
          ? "문자발송 연결 오류"
          : "연결 상태 확인 중…";
  const labelColor =
    state === "connected"
      ? "text-[#3E9B78]"
      : state === "checking"
        ? "text-[#6B7280]"
        : "text-[#D95C5C]";

  const sendTest = async () => {
    if (sending) return;
    if (!isSendablePhone(phone)) {
      setResult({ ok: false, error: "받는 번호를 010으로 시작하는 형식으로 넣어 주세요." });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      localStorage.setItem(TEST_PHONE_KEY, phone);
    } catch {
      /* 기억해 두지 못해도 발송은 됩니다 */
    }
    try {
      const r = await sendTestSms(phone);
      setResult(r);
      if (r.ok) tap("success");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="space-y-3 rounded-[14px] bg-white">
      {/* 기본: 제목 + 연결 상태 + 설정 관리 */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[16px] font-bold text-[#25282D]">문자발송 설정</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
            <span className={`truncate text-[14px] font-bold ${labelColor}`}>{label}</span>
          </div>
        </div>
        <button
          onClick={() => {
            tap("soft");
            setOpen((v) => !v);
          }}
          className="shrink-0 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[13px] font-bold text-[#25282D]"
          aria-expanded={open}
        >
          {open ? "닫기" : "설정 관리"}
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-[#E5E7EB] pt-3">
          {/* 알리고 설정 상태 확인 (값은 보여 주지 않고 설정 여부만) */}
          <div className="rounded-[14px] bg-[#F7F8F5] p-3.5">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="text-[14px] font-bold text-[#25282D]">알리고 설정 상태</div>
              <button
                onClick={() => {
                  tap("soft");
                  void check();
                }}
                disabled={checking}
                className="rounded-full border border-[#3578C8] bg-white px-2.5 py-1 text-[12px] font-bold text-[#25282D] disabled:opacity-50"
              >
                {checking ? "확인 중…" : "다시 확인"}
              </button>
            </div>
            {config?.error ? (
              <div className="text-[14px] font-bold text-[#D95C5C]">{config.error}</div>
            ) : cfgBools.length > 0 ? (
              <>
                {cfgBools.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 py-1">
                    <span className="min-w-0 truncate text-[14px] text-[#6B7280]">{k}</span>
                    <span
                      className={`shrink-0 text-[14px] font-bold ${v ? "text-[#3E9B78]" : "text-[#D95C5C]"}`}
                    >
                      {v ? "설정됨" : "없음"}
                    </span>
                  </div>
                ))}
                {typeof config?.config?.발송경로 === "string" && (
                  <div className="mt-1 text-[13px] text-[#6B7280]">
                    발송 경로: {config.config.발송경로}
                  </div>
                )}
                <div className="mt-1 text-[12px] text-[#9AA3B2]">
                  아이디·키·발신번호 등 값은 보여 주지 않고 설정 여부만 확인합니다.
                </div>
              </>
            ) : (
              <div className="text-[14px] text-[#6B7280]">설정 상태를 확인하는 중입니다…</div>
            )}
          </div>

          {/* 테스트 받을 번호 (전체 번호는 가려서 표시) */}
          <div>
            <div className="text-[14px] font-bold text-[#6B7280]">테스트 받을 번호</div>
            <div className="mt-1.5 flex gap-2">
              <TextInput
                value={phone}
                inputMode="numeric"
                placeholder="010-0000-0000"
                onChange={(e) => setPhone(e.target.value)}
              />
              {ownerPhone && (
                <button
                  onClick={() => {
                    tap("soft");
                    setPhone(ownerPhone);
                  }}
                  className="shrink-0 whitespace-nowrap rounded-[14px] border border-[#E5E7EB] bg-white px-3 text-[14px] font-bold text-[#25282D]"
                >
                  내 번호
                </button>
              )}
            </div>
            {phone && (
              <div className="mt-1 text-[13px] text-[#6B7280]">보낼 곳: {maskPhone(phone)}</div>
            )}
          </div>

          <button
            onClick={() => void sendTest()}
            disabled={sending || !phone.trim()}
            className="w-full rounded-[14px] bg-gradient-to-b from-[#3578C8] to-[#2C63A8] py-3 text-[15px] font-black text-white shadow-[0_3px_0_#285C99] disabled:opacity-50 disabled:shadow-none"
          >
            {sending ? "보내는 중…" : "테스트 문자 보내기"}
          </button>

          <div className="text-[12px] text-[#9AA3B2]">
            테스트 문자도 실제로 발송되어 무료 체험 문자 사용량에 포함됩니다.
          </div>

          {result && (
            <div className={`rounded-[14px] p-3.5 ${result.ok ? "bg-[#ECFDF3]" : "bg-[#FBEAEA]"}`}>
              {result.ok ? (
                <>
                   <div className="text-[15px] font-black text-[#3E9B78]">문자 발송이 접수되었습니다</div>
                  <div className="mt-1 text-[14px] text-[#25282D]">
                    종류: {result.msgType ?? "SMS"}
                    {result.msgId ? ` · 알리고 발송번호: ${result.msgId}` : ""}
                  </div>
                  <div className="mt-0.5 text-[13px] text-[#6B7280]">
                     접수된 문자입니다. 휴대폰 도착은 따로 확인해 주세요.
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[15px] font-black text-[#D95C5C]">보내지 못했습니다</div>
                  <div className="mt-1 break-words text-[14px] text-[#25282D]">{result.error}</div>
                  {result.needLogin && onNeedLogin && (
                    <button
                      onClick={onNeedLogin}
                      className="mt-2 w-full rounded-[14px] bg-[#3578C8] py-2.5 text-[15px] font-black text-white"
                    >
                      로그인 화면으로 가기
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
