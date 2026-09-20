/**
 * 고객용 견적서 공유 링크 — 실제 운영 주소 + 이미 저장해 둔 보안 토큰으로 만듭니다.
 *
 *  - 견적번호만 들어간 주소는 쓰지 않습니다 (추측 가능).
 *  - 삭제된 견적서, 발송하지 않아 토큰이 없는 견적서, 다른 업체의 견적서는 막습니다.
 *  - 공개 주소는 서버 환경변수 PUBLIC_APP_URL 을 씁니다 (없으면 요청 주소).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ShareLinkCode = "not_sent" | "deleted" | "no_token" | "forbidden" | "error";

export interface ShareLinkResult {
  ok: boolean;
  url?: string;
  /** 표시용 고객/계약 정보 (공유 문구에 씁니다) */
  customerName?: string;
  moveDate?: string | null;
  total?: number;
  code?: ShareLinkCode;
  error?: string;
}

/** 운영 공개 주소 (끝의 / 는 제거) */
function publicBase(): string {
  const env = (process.env["PUBLIC_APP_URL"] ?? "").trim();
  if (env) return env.replace(/\/$/, "");
  try {
    // 환경변수가 없으면 지금 요청이 들어온 주소를 씁니다.
    return "";
  } catch {
    return "";
  }
}

export const getCustomerShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ estimateId: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }): Promise<ShareLinkResult> => {
    const { data: rows, error } = await context.supabase
      .from("estimate_terms")
      .select("id, access_token, deleted_at, sheet_version, customer_name, move_date, total")
      .eq("user_id", context.userId)
      .eq("estimate_id", data.estimateId)
      .order("sheet_version", { ascending: false })
      .limit(5);
    if (error) {
      console.error("[getCustomerShareLink]", error.message);
      return { ok: false, code: "error", error: "공유 링크를 만들지 못했습니다." };
    }
    const list = (rows ?? []) as {
      access_token: string | null;
      deleted_at: string | null;
      customer_name: string | null;
      move_date: string | null;
      total: number | null;
    }[];
    if (list.length === 0) {
      return {
        ok: false,
        code: "not_sent",
        error: "아직 고객에게 발송한 견적서가 없습니다. 먼저 견적서를 발송해 주세요.",
      };
    }
    const live = list.find((r) => !r.deleted_at);
    if (!live) {
      return { ok: false, code: "deleted", error: "삭제된 견적서는 공유할 수 없습니다." };
    }
    if (!live.access_token) {
      return { ok: false, code: "no_token", error: "공유 토큰이 없어 링크를 만들 수 없습니다." };
    }

    let base = publicBase();
    if (!base) {
      try {
        const { getRequest } = await import("@tanstack/react-start/server");
        base = new URL(getRequest()!.url).origin;
      } catch {
        base = "";
      }
    }
    if (!base) {
      return { ok: false, code: "error", error: "공개 주소 설정(PUBLIC_APP_URL)이 필요합니다." };
    }

    return {
      ok: true,
      url: `${base}/share/${encodeURIComponent(data.estimateId)}?t=${encodeURIComponent(live.access_token)}`,
      customerName: (live.customer_name ?? "").trim(),
      moveDate: live.move_date,
      total: Number(live.total ?? 0) || 0,
    };
  });
