/**
 * 업체용 문자 알림 상태.
 *
 * 업체 화면에는 "지금 문자를 보낼 수 있는지"만 알려 줍니다.
 * 알리고 아이디·키·발신번호·환경변수 이름은 어떤 응답에도 담지 않습니다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SmsServiceStatus {
  /** ready: 발송 가능 · maintenance: 점검 중 · unknown: 확인 실패 */
  state: "ready" | "maintenance" | "unknown";
  /** 내 업체 관리자 알림을 받는 번호 (뒤 4자리만) */
  noticePhoneLast4: string | null;
  /** 내 업체가 보낸 문자 건수 */
  sentCount: number;
  /** 내 업체 발송 실패 건수 */
  failedCount: number;
}

function last4(phone: string | null): string | null {
  const d = (phone ?? "").replace(/[^0-9]/g, "");
  return d.length >= 4 ? d.slice(-4) : null;
}

export const getSmsServiceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SmsServiceStatus> => {
    const [profileRes, deliveriesRes] = await Promise.all([
      context.supabase.from("profiles").select("phone").eq("id", context.userId).maybeSingle(),
      context.supabase.from("estimate_deliveries").select("status").eq("user_id", context.userId),
    ]);

    let state: SmsServiceStatus["state"] = "unknown";
    try {
      const url = process.env["SUPABASE_URL"];
      const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
      const serverSecret = process.env["JIMPICK_PROXY_SECRET"] ?? "";
      if (url && serviceKey) {
        const r = await fetch(`${url}/functions/v1/send-estimate-sms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            "x-jimpick-server": serverSecret,
          },
          body: JSON.stringify({ checkOnly: true }),
        });
        const body = (await r.json().catch(() => null)) as { ok?: boolean } | null;
        state = body?.ok === true ? "ready" : "maintenance";
      }
    } catch {
      state = "unknown";
    }

    const rows = deliveriesRes.data ?? [];
    return {
      state,
      noticePhoneLast4: last4(profileRes.data?.phone ?? null),
      sentCount: rows.filter((d) => ["sent", "success", "accepted", "delivered"].includes(d.status)).length,
      failedCount: rows.filter((d) => d.status === "failed").length,
    };
  });
