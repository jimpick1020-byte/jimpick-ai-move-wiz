/**
 * 발송 결과를 Supabase 에 남깁니다.
 *
 * Service Role Key 를 쓰므로 이 파일은 서버에서만 돌아야 합니다.
 * 키는 로그에도 남기지 않습니다.
 */

/** 발송 이력 한 줄을 저장합니다. 실패해도 문자 발송 자체는 막지 않습니다. */
export async function saveDelivery(row) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[supabase] SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 가 없어 기록을 건너뜁니다");
    return { saved: false, reason: "not-configured" };
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/estimate_deliveries`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[supabase] insert 실패", res.status, body.slice(0, 200));
      return { saved: false, reason: `http-${res.status}` };
    }
    const [saved] = await res.json();
    return { saved: true, id: saved?.id };
  } catch (e) {
    console.error("[supabase] 기록 중 오류", e?.message);
    return { saved: false, reason: "network" };
  }
}

/**
 * 같은 요청이 이미 성공했는지 확인합니다 (중복 발송 방지).
 * idempotency_key 로 찾습니다.
 */
export async function findDelivery(idempotencyKey) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !idempotencyKey) return null;

  try {
    const q = new URLSearchParams({
      idempotency_key: `eq.${idempotencyKey}`,
      status: "eq.success",
      select: "id,msg_id,msg_type,sent_at",
      limit: "1",
    });
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/estimate_deliveries?${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
