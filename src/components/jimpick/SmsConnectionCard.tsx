/**
 * 문자발송 연결 확인 · 시험 발송.
 *
 * 알리고 아이디·키·발신번호는 Supabase Secrets 에만 있습니다.
 * 여기서는 "설정되어 있는지" 만 확인하고, 값은 절대 받아 오지 않습니다.
 *
 * 받는 번호는 코드에 고정하지 않고 사장님이 직접 넣습니다.
 * (한 번 넣으면 이 기기에 기억해 두었다가 다음에 그대로 보여 줍니다)
 */
import { useEffect, useState } from "react";
import { Card, TextInput } from "./ui";
import { tap } from "@/lib/feedback";
import { isSendablePhone } from "@/lib/sms";
import {
  checkSmsConfig,
  sendSmsViaEdge,
  TEST_SMS_TEXT,
  type EdgeSmsResult,
  type SmsConfigStatus,
} from "@/lib/sms.edge";

const TEST_PHONE_KEY = "jimpick_test_phone";

/** 화면에는 뒷자리만 보여 줍니다 */
function maskPhone(p: string): string {
  const d = (p || "").replace(/[^0-9]/g, "");
  return d.length >= 4 ? `010-****-${d.slice(-4)}` : "번호 없음";
}

export function SmsConnectionCard({ ownerPhone = "" }: { ownerPhone?: string }) {
  const [config, setConfig] = useState<SmsConfigStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<EdgeSmsResult | null>(null);

  useEffect(() => {
    try {
      setPhone(localStorage.getItem(TEST_PHONE_KEY) || "");
    } catch {
      /* 저장소를 못 읽어도 입력은 됩니다 */
    }
  }, []);

  const check = async () => {
    setChecking(true);
    setConfig(null);
    try {
      setConfig(await checkSmsConfig());
    } finally {
      setChecking(false);
    }
  };

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
      const r = await sendSmsViaEdge({
        to: phone,
        text: TEST_SMS_TEXT,
        title: "짐픽 연결 테스트",
        // 시험이라도 같은 순간에 두 번 나가지 않게 합니다
        idempotencyKey: `test-${Date.now()}`,
      });
      setResult(r);
      if (r.ok) tap("success");
    } finally {
      setSending(false);
    }
  };

  const rows = config?.config
    ? Object.entries(config.config).filter(([, v]) => typeof v === "boolean")
    : [];

  return (
    <Card className="space-y-3 rounded-[14px]">
      <div className="text-[17px] font-bold">문자발송 연결</div>

      <button
        onClick={() => {
          tap("soft");
          void check();
        }}
        disabled={checking}
        className="w-full rounded-[14px] border border-[#0864DC] bg-white py-3 text-[16px] font-black text-[#0864DC] disabled:opacity-50"
      >
        {checking ? "확인 중…" : "알리고 설정 확인"}
      </button>

      {config && (
        <div className="rounded-[14px] bg-[#F7F9FC] p-3.5">
          {config.error ? (
            <div className="text-[15px] font-bold text-[#B42318]">{config.error}</div>
          ) : (
            <>
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 py-1">
                  <span className="min-w-0 truncate text-[15px] text-[#6B7280]">{k}</span>
                  <span
                    className={`shrink-0 text-[15px] font-bold ${v ? "text-[#15803D]" : "text-[#B42318]"}`}
                  >
                    {v ? "설정됨" : "없음"}
                  </span>
                </div>
              ))}
              {typeof config.config?.발송경로 === "string" && (
                <div className="mt-1.5 text-[15px] text-[#6B7280]">
                  발송 경로: {config.config.발송경로}
                </div>
              )}
              <div className="mt-1.5 text-[14px] text-[#6B7280]">
                값은 보여 주지 않고 설정 여부만 확인합니다.
              </div>
            </>
          )}
        </div>
      )}

      <div>
        <div className="text-[15px] font-bold text-[#6B7280]">테스트 받는 번호</div>
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
              className="shrink-0 whitespace-nowrap rounded-[14px] border border-[#DCE8FA] bg-white px-3 text-[15px] font-bold text-[#0864DC]"
            >
              내 번호
            </button>
          )}
        </div>
        {phone && (
          <div className="mt-1 text-[15px] text-[#6B7280]">보낼 곳: {maskPhone(phone)}</div>
        )}
      </div>

      <button
        onClick={() => void sendTest()}
        disabled={sending || !phone.trim()}
        className="w-full rounded-[14px] bg-gradient-to-b from-[#1B76EF] to-[#0757C4] py-3.5 text-[17px] font-black text-white shadow-[0_4px_0_#0645B0] disabled:opacity-50 disabled:shadow-none"
      >
        {sending ? "보내는 중…" : "연결 테스트 문자 보내기"}
      </button>

      {result && (
        <div
          className={`rounded-[14px] p-3.5 ${result.ok ? "bg-[#ECFDF3]" : "bg-[#FFF1F2]"}`}
        >
          {result.ok ? (
            <>
              <div className="text-[16px] font-black text-[#15803D]">문자를 보냈습니다</div>
              <div className="mt-1 text-[15px] text-[#111827]">
                종류: {result.msgType ?? "SMS"}
                {result.msgId ? ` · 알리고 발송번호: ${result.msgId}` : ""}
              </div>
              <div className="mt-0.5 text-[15px] text-[#6B7280]">
                휴대폰에 실제로 도착했는지 확인해 주세요.
              </div>
            </>
          ) : (
            <>
              <div className="text-[16px] font-black text-[#B42318]">보내지 못했습니다</div>
              <div className="mt-1 break-words text-[15px] text-[#111827]">{result.error}</div>
            </>
          )}
        </div>
      )}

      <div className="text-[15px] leading-relaxed text-[#6B7280]">
        보내는 글: [JIMPICK 짐픽] 문자발송 연결 테스트입니다.
      </div>
    </Card>
  );
}
