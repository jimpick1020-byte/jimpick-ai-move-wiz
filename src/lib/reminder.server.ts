/**
 * 이사 전날 안내 문자 예약 만들기·취소 (서버 전용).
 *
 * 앱(브라우저)에 있는 견적 내용은 서버가 알 수 없으므로,
 * 고객이 예약을 확정할 때 저장된 견적서(estimate_terms + sheet_snapshot)에서
 * 발송에 필요한 값만 뽑아 move_reminders 에 남깁니다.
 *
 * 실제 발송은 크론이 부르는 send-move-reminders 가 합니다.
 */

/** 이사 전날 18:00 (한국시간) 을 UTC 시각으로 계산합니다 */
export function reminderScheduledAt(moveDate: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((moveDate || "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // 이사일 00:00 KST = 전날 15:00 UTC. 전날 18:00 KST = 전날 09:00 UTC.
  const moveDayUtcMidnight = Date.UTC(y, mo - 1, d);
  if (Number.isNaN(moveDayUtcMidnight)) return null;
  const prev = new Date(moveDayUtcMidnight - 24 * 60 * 60 * 1000);
  prev.setUTCHours(9, 0, 0, 0);
  return prev.toISOString();
}

/** 하이픈 등을 떼고 010… 형태로 만듭니다 */
function normalizePhone(raw: string): string {
  let d = String(raw || "").replace(/[^0-9]/g, "");
  if (d.startsWith("0082")) d = "0" + d.slice(4);
  else if (d.startsWith("82")) d = "0" + d.slice(2);
  return d;
}

function isKoreanMobile(d: string): boolean {
  return /^01[016789][0-9]{7,8}$/.test(d);
}

/** 고객 확인용 무작위 토큰 (추측할 수 없는 64자) */
export function newViewToken(): string {
  return (
    globalThis.crypto.randomUUID().replace(/-/g, "") +
    globalThis.crypto.randomUUID().replace(/-/g, "")
  );
}

export interface SyncResult {
  ok: boolean;
  /** created · updated · unchanged · canceled · skipped */
  action: string;
  reason?: string;
  scheduledAt?: string;
}

/**
 * 예약이 확정된 견적의 전날 안내 문자를 만들거나 다시 예약합니다.
 * 아직 확정되지 않았거나 취소된 견적이면 예약을 만들지 않습니다.
 */
export async function syncMoveReminder(estimateTermsId: string): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row, error } = await supabaseAdmin
    .from("estimate_terms")
    .select(
      "id, user_id, estimate_id, customer_name, contact_phone, company_phone, move_date, payment_status, sheet_snapshot",
    )
    .eq("id", estimateTermsId)
    .maybeSingle();
  if (error || !row) return { ok: false, action: "skipped", reason: "견적서를 찾지 못했습니다." };

  const r = row as Record<string, unknown>;
  const ownerId = String(r["user_id"] ?? "");
  const estimateId = String(r["estimate_id"] ?? "");

  // 고객이 실제로 예약을 확정했는지 확인합니다 (동의 기록이 있어야 합니다)
  const { data: acc } = await supabaseAdmin
    .from("terms_acceptances")
    .select("accepted, reservation_status")
    .eq("estimate_terms_id", estimateTermsId)
    .maybeSingle();
  const confirmed =
    !!acc &&
    (acc as { accepted?: boolean }).accepted === true &&
    String((acc as { reservation_status?: string }).reservation_status ?? "confirmed") !== "canceled";

  const paymentStatus = String(r["payment_status"] ?? "unpaid");
  const canceledReservation = paymentStatus === "canceled" || paymentStatus === "refunded";

  if (!confirmed || canceledReservation) {
    await cancelMoveReminders(estimateId, ownerId);
    return { ok: true, action: "canceled", reason: "확정되지 않았거나 취소된 예약입니다." };
  }

  // 견적 스냅샷에서 시작 시간·출발지를 읽습니다 (없으면 그 줄은 비웁니다)
  let draft: Record<string, unknown> = {};
  try {
    const snap = JSON.parse(String(r["sheet_snapshot"] ?? "{}")) as {
      draft?: Record<string, unknown>;
    };
    draft = snap?.draft ?? {};
  } catch {
    draft = {};
  }
  const sv = (k: string) => String(draft[k] ?? "").trim();

  const moveDate = String(r["move_date"] ?? "").trim() || sv("moveDate");
  const scheduledAt = reminderScheduledAt(moveDate);
  if (!scheduledAt) {
    await cancelMoveReminders(estimateId, ownerId);
    return { ok: false, action: "skipped", reason: "이사 날짜가 없어 예약하지 못했습니다." };
  }

  const phone = normalizePhone(String(r["contact_phone"] ?? "") || sv("phone"));
  if (!isKoreanMobile(phone)) {
    await cancelMoveReminders(estimateId, ownerId);
    return { ok: false, action: "skipped", reason: "고객 휴대전화번호가 없어 예약하지 못했습니다." };
  }

  const fromAddress = [sv("fromAddress"), sv("fromDetail")].filter(Boolean).join(" ");
  const toAddress = [sv("toAddress"), sv("toDetail")].filter(Boolean).join(" ");
  const idempotencyKey = `move-reminder-${estimateId}-${moveDate}`;
  // 이사 전날(한국시간) 날짜 — 같은 업체·견적·날짜에는 한 건만 만들어집니다
  const scheduledDate = new Date(new Date(scheduledAt).getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // 날짜가 바뀌었으면 예전 예약(아직 안 보낸 것)은 취소합니다
  await supabaseAdmin
    .from("move_reminders")
    .update({ status: "canceled", error_reason: "이사 날짜 변경으로 다시 예약했습니다." } as never)
    .eq("company_id", ownerId)
    .eq("estimate_id", estimateId)
    .eq("status", "scheduled")
    .neq("idempotency_key", idempotencyKey);

  const { data: existing } = await supabaseAdmin
    .from("move_reminders")
    .select("id, status, view_token")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  const phoneLast4 = phone.slice(-4);
  const payload = {
    company_id: ownerId,
    user_id: ownerId,
    estimate_id: estimateId,
    estimate_terms_id: estimateTermsId,
    customer_name: String(r["customer_name"] ?? "").trim() || sv("customerName"),
    customer_phone: phone,
    move_date: moveDate,
    start_time: sv("moveTime") || null,
    from_address: fromAddress || null,
    to_address: toAddress || null,
    company_phone: String(r["company_phone"] ?? "").trim() || null,
    scheduled_at: scheduledAt,
    scheduled_date: scheduledDate,
    delivery_type: "move_day_reminder",
    provider: "aligo",
    to_masked: `010-****-${phoneLast4}`,
    idempotency_key: idempotencyKey,
  };

  if (existing) {
    const status = String((existing as { status?: string }).status ?? "");
    // 이미 보낸·보내는 중인 문자는 다시 만들지 않습니다
    if (["success", "sending", "processing", "accepted", "delivered"].includes(status)) {
      return { ok: true, action: "unchanged", scheduledAt };
    }
    const { error: upErr } = await supabaseAdmin
      .from("move_reminders")
      .update({
        ...payload,
        status: "scheduled",
        error_reason: null,
        error_code: null,
        missed_reason: null,
        view_token:
          (existing as { view_token?: string | null }).view_token || newViewToken(),
      } as never)
      .eq("id", (existing as { id: string }).id);
    if (upErr) {
      console.error("[syncMoveReminder] update", upErr.message);
      return { ok: false, action: "skipped", reason: "안내 문자 예약을 저장하지 못했습니다." };
    }
    return { ok: true, action: "updated", scheduledAt };
  }

  const { error: insErr } = await supabaseAdmin
    .from("move_reminders")
    .insert({ ...payload, status: "scheduled", view_token: newViewToken() } as never);
  if (insErr) {
    // 같은 열쇠가 이미 있으면(동시 실행) 그대로 둡니다
    if (/duplicate key/i.test(insErr.message)) return { ok: true, action: "unchanged", scheduledAt };
    console.error("[syncMoveReminder] insert", insErr.message);
    return { ok: false, action: "skipped", reason: "안내 문자 예약을 저장하지 못했습니다." };
  }
  return { ok: true, action: "created", scheduledAt };
}

/** 아직 보내지 않은 안내 문자 예약을 모두 취소합니다 */
export async function cancelMoveReminders(
  estimateId: string,
  ownerId: string,
  reason = "예약이 취소되었습니다.",
): Promise<void> {
  if (!estimateId || !ownerId) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("move_reminders")
    .update({ status: "canceled", error_reason: reason } as never)
    .eq("company_id", ownerId)
    .eq("estimate_id", estimateId)
    .eq("status", "scheduled");
  if (error) console.error("[cancelMoveReminders]", error.message);
}
