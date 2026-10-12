/**
 * 고객 사전정보 입력 링크 서버 기능.
 *
 * 사장님용(로그인 필수, 자기 업체 자료만):
 *   listIntakeRequests · createIntakeRequest · getIntakeLink · sendIntakeSms
 *   cancelIntakeRequest · confirmIntakeRequest · markIntakeSeen · loadIntakeDraft
 *   listIntakeItemsOwner · saveIntakeItemSetting
 * 고객용(로그인 없음, 보안 토큰으로 연결된 한 건만):
 *   openIntake · saveIntakeProgress · submitIntake
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { formatTel } from "./format-input";
import {
  INTAKE_BASE_ITEMS, INTAKE_ROOMS, intakeSmsText, mergeIntakeIntoDraft, intakeSummary,
  type IntakeForm, type IntakeRooms,
} from "./intake";

const ADMIN_SENDER = "01075662542";
const OWNER_COLS =
  "id, estimate_id, source_estimate_id, customer_name, customer_phone, status, expires_at, submission, first_opened_at, last_opened_at, editing_started_at, first_submitted_at, last_submitted_at, submit_count, consent_at, confirmed_at, cancelled_at, owner_seen_at, last_sent_at, last_send_method, last_send_error, created_at, updated_at";

export interface IntakeRow {
  id: string;
  estimate_id: string;
  source_estimate_id: string | null;
  customer_name: string;
  customer_phone: string;
  status: string;
  expires_at: string;
  submission: IntakeForm | Record<string, never>;
  first_opened_at: string | null;
  last_opened_at: string | null;
  editing_started_at: string | null;
  first_submitted_at: string | null;
  last_submitted_at: string | null;
  submit_count: number;
  consent_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  owner_seen_at: string | null;
  last_sent_at: string | null;
  last_send_method: string | null;
  last_send_error: string | null;
  created_at: string;
  updated_at: string;
}

const phoneSchema = z.string().trim().regex(/^0\d{1,2}-?\d{3,4}-?\d{4}$/, "휴대전화 번호를 확인해 주세요.");
const pickSchema = z.object({ qty: z.number().int().min(1).max(20), disposal: z.boolean() });
const formSchema = z.object({
  customerName: z.string().trim().max(30),
  phone: z.string().trim().max(20),
  moveDate: z.string().max(10).regex(/^(\d{4}-\d{2}-\d{2})?$/),
  moveTime: z.string().max(20),
  fromAddress: z.string().max(200),
  fromDetail: z.string().max(100),
  toAddress: z.string().max(200),
  toDetail: z.string().max(100),
  fromX: z.number().nullable().optional(),
  fromY: z.number().nullable().optional(),
  toX: z.number().nullable().optional(),
  toY: z.number().nullable().optional(),
  rooms: z.record(z.enum(INTAKE_ROOMS), z.record(z.string().min(1).max(60), pickSchema)),
});

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

// ───────────────────────── 사장님용 ─────────────────────────

export const listIntakeRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; rows: IntakeRow[]; error?: string }> => {
    const { data, error } = await context.supabase
      .from("intake_requests").select(OWNER_COLS).eq("company_id", context.userId)
      .order("created_at", { ascending: false }).limit(300);
    if (error) return { ok: false, rows: [], error: "사전정보 요청 목록을 불러오지 못했습니다." };
    return { ok: true, rows: (data ?? []) as unknown as IntakeRow[] };
  });

export const createIntakeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().trim().min(1).max(30), phone: phoneSchema, sourceEstimateId: z.string().max(80).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; row?: IntakeRow; link?: string; error?: string }> => {
    const { makeIntakeToken, hashIntakeToken, encryptToken, intakeLink } = await import("./intake.server");
    // 같은 고객 견적에 진행 중인 요청이 있으면 새로 만들지 않고 그대로 돌려줍니다.
    if (data.sourceEstimateId) {
      const { data: open } = await context.supabase.from("intake_requests").select(OWNER_COLS + ", token_enc")
        .eq("company_id", context.userId).eq("source_estimate_id", data.sourceEstimateId)
        .not("status", "in", "(cancelled,confirmed)").gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (open) {
        const { decryptToken } = await import("./intake.server");
        const tok = await decryptToken((open as unknown as { token_enc: string | null }).token_enc);
        const { token_enc: _t, ...row } = open as unknown as IntakeRow & { token_enc?: string };
        return { ok: true, row, link: tok ? intakeLink(tok) : undefined };
      }
    }
    const token = makeIntakeToken();
    const estimateId = `est_intake_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const { data: row, error } = await context.supabase.from("intake_requests").insert({
      company_id: context.userId, created_by: context.userId, source_estimate_id: data.sourceEstimateId ?? null,
      estimate_id: estimateId, customer_name: data.name, customer_phone: formatTel(data.phone),
      token_hash: await hashIntakeToken(token), token_enc: await encryptToken(token),
      expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    }).select(OWNER_COLS).single();
    if (error || !row) {
      console.error("[createIntakeRequest]", error?.code);
      return { ok: false, error: "링크를 만들지 못했습니다. 다시 시도해 주세요." };
    }
    return { ok: true, row: row as unknown as IntakeRow, link: intakeLink(token) };
  });

async function ownRow(supabase: { from: (t: "intake_requests") => any }, userId: string, id: string) {
  const { data } = await supabase.from("intake_requests").select(OWNER_COLS + ", token_enc").eq("company_id", userId).eq("id", id).maybeSingle();
  return data as (IntakeRow & { token_enc: string | null }) | null;
}

export const getIntakeLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), method: z.enum(["copy", "kakao"]).optional() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; link?: string; error?: string }> => {
    const row = await ownRow(context.supabase, context.userId, data.id);
    if (!row) return { ok: false, error: "요청을 찾지 못했습니다." };
    if (row.status === "cancelled") return { ok: false, error: "취소된 링크입니다." };
    const { decryptToken, intakeLink } = await import("./intake.server");
    const tok = await decryptToken(row.token_enc);
    if (!tok) return { ok: false, error: "링크를 다시 만들어 주세요." };
    if (data.method) {
      const sb = await admin();
      await sb.from("intake_requests").update({
        last_sent_at: new Date().toISOString(), last_send_method: data.method,
        ...(row.status === "created" ? { status: "sent" } : {}),
      }).eq("id", row.id).eq("company_id", context.userId);
    }
    return { ok: true, link: intakeLink(tok) };
  });

export const sendIntakeSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string; msgId?: string }> => {
    const row = await ownRow(context.supabase, context.userId, data.id);
    if (!row) return { ok: false, error: "요청을 찾지 못했습니다." };
    if (row.status === "cancelled") return { ok: false, error: "취소된 링크는 보낼 수 없습니다." };
    if (row.status === "confirmed") return { ok: false, error: "이미 확정된 요청입니다." };
    if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, error: "만료된 링크입니다. 새로 만들어 주세요." };
    const to = row.customer_phone.replace(/[^0-9]/g, "");
    if (!/^01[016789]\d{7,8}$/.test(to)) return { ok: false, error: "고객 휴대전화 번호 형식이 올바르지 않습니다." };
    const { decryptToken, intakeLink } = await import("./intake.server");
    const tok = await decryptToken(row.token_enc);
    if (!tok) return { ok: false, error: "링크를 다시 만들어 주세요." };
    const { readCreds, sendViaAligo } = await import("./reminder-send.server");
    const creds = readCreds();
    const sb = await admin();
    const now = new Date().toISOString();
    const { data: profile } = await sb.from("profiles").select("phone").eq("id", context.userId).maybeSingle();
    const contact = formatTel(String(profile?.phone ?? "")) || formatTel(ADMIN_SENDER);
    const text = intakeSmsText({ customerName: row.customer_name, link: intakeLink(tok), contact });
    const out = creds
      ? await sendViaAligo({ to, text, title: "", msgType: "LMS", ...creds, sender: ADMIN_SENDER, companyId: context.userId })
      : { ok: false, error: "문자 발송 설정(알리고)이 준비되지 않아 보내지 않았습니다.", code: undefined, msgId: undefined, msgType: undefined };
    await sb.from("estimate_deliveries").insert({
      estimate_id: row.estimate_id, user_id: context.userId, company_id: context.userId,
      to_masked: `***-****-${to.slice(-4)}`, msg_type: out.msgType ?? "LMS", msg_id: out.msgId ?? null,
      status: out.ok ? "accepted" : "failed", error_message: out.ok ? null : out.error ?? null,
      error_code: out.ok ? null : out.code != null ? String(out.code) : null, delivery_method: "intake_link",
      provider: "aligo", provider_message_id: out.msgId ?? null, requested_at: now,
      failed_at: out.ok ? null : now, provider_result: { ok: out.ok, code: out.code ?? null, msg_type: out.msgType ?? null } as never,
      idempotency_key: `intake:${row.id}:${Date.now()}`,
    });
    await sb.from("intake_requests").update(out.ok
      ? { last_sent_at: now, last_send_method: "sms", last_send_error: null, ...(row.status === "created" ? { status: "sent" } : {}) }
      : { last_send_error: out.error ?? "문자 발송에 실패했습니다." }).eq("id", row.id).eq("company_id", context.userId);
    return out.ok ? { ok: true, msgId: out.msgId } : { ok: false, error: out.error ?? "문자 발송에 실패했습니다." };
  });

export const cancelIntakeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("intake_requests")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", data.id).eq("company_id", context.userId).neq("status", "confirmed");
    return error ? { ok: false, error: "링크를 취소하지 못했습니다." } : { ok: true };
  });

export const confirmIntakeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("intake_requests")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString(), owner_seen_at: new Date().toISOString() })
      .eq("id", data.id).eq("company_id", context.userId).eq("status", "submitted").select("id").maybeSingle();
    if (error) return { ok: false, error: "확정하지 못했습니다." };
    if (!row) return { ok: false, error: "고객이 입력을 완료한 요청만 확정할 수 있습니다." };
    return { ok: true };
  });

export const markIntakeSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.ids.length) return { ok: true };
    await context.supabase.from("intake_requests").update({ owner_seen_at: new Date().toISOString() })
      .eq("company_id", context.userId).in("id", data.ids);
    return { ok: true };
  });

/** 고객이 만든 견적 초안 (사장님 화면으로 불러오기) */
export const loadIntakeDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ estimateId: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; payload?: string; error?: string }> => {
    const { data: row } = await context.supabase.from("estimate_drafts").select("payload")
      .eq("user_id", context.userId).eq("estimate_id", data.estimateId).is("deleted_at", null).maybeSingle();
    if (!row) return { ok: false, error: "견적 초안을 찾지 못했습니다." };
    return { ok: true, payload: JSON.stringify(row.payload) };
  });

// ───────────── 고객 링크 품목 관리 ─────────────

export interface IntakeItem {
  id: string;
  name: string;
  /** 업체가 올린 그림 (기본 품목은 비어 있고 화면에서 기본 그림을 씁니다) */
  icon?: string;
  rooms: string[];
  visible: boolean;
  disposalAllowed: boolean;
  sort: number;
  kind: "base" | "company";
  cat?: string;
}
type BaseSetting = { visible?: boolean; disposal?: boolean; rooms?: string[]; sort?: number };

async function itemsFor(sb: any, companyId: string, onlyVisible: boolean): Promise<IntakeItem[]> {
  const [{ data: prof }, { data: icons }] = await Promise.all([
    sb.from("profiles").select("intake_item_settings").eq("id", companyId).maybeSingle(),
    sb.from("item_icons").select("id, item_id, display_name, category_group, intake_visible, intake_disposal_allowed, intake_rooms, intake_sort")
      .eq("user_id", companyId).eq("active", true).eq("status", "ready").not("storage_path", "is", null),
  ]);
  const settings = ((prof?.intake_item_settings ?? {}) as Record<string, BaseSetting>);
  const base: IntakeItem[] = INTAKE_BASE_ITEMS.map((b, i) => {
    const s = settings[b.id] ?? {};
    return { id: b.id, name: b.name, rooms: s.rooms?.length ? s.rooms : b.rooms, visible: s.visible ?? true,
      disposalAllowed: s.disposal ?? true, sort: s.sort ?? i, kind: "base" };
  });
  const mine: IntakeItem[] = ((icons ?? []) as any[]).map((r) => ({
    id: r.item_id, name: r.display_name, icon: `/api/public/item-icon/${r.id}.png`, rooms: r.intake_rooms ?? [],
    visible: !!r.intake_visible, disposalAllowed: r.intake_disposal_allowed !== false, sort: Number(r.intake_sort ?? 1000),
    kind: "company", cat: r.category_group,
  }));
  const all = [...base, ...mine].sort((a, b) => a.sort - b.sort);
  return onlyVisible ? all.filter((x) => x.visible) : all;
}

export const listIntakeItemsOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ ok: true, items: await itemsFor(context.supabase, context.userId, false) }));

export const saveIntakeItemSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().min(1).max(60), kind: z.enum(["base", "company"]),
    visible: z.boolean(), disposalAllowed: z.boolean(), rooms: z.array(z.enum(INTAKE_ROOMS)).max(6),
    sort: z.number().int().min(0).max(100000), name: z.string().trim().min(1).max(24).optional(),
    cat: z.enum(["가구", "가전", "주방", "생활용품", "운동·레저"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.kind === "base") {
      if (!INTAKE_BASE_ITEMS.some((b) => b.id === data.id)) return { ok: false, error: "품목을 찾지 못했습니다." };
      const { data: prof } = await context.supabase.from("profiles").select("intake_item_settings").eq("id", context.userId).maybeSingle();
      const cur = (prof?.intake_item_settings ?? {}) as Record<string, BaseSetting>;
      cur[data.id] = { visible: data.visible, disposal: data.disposalAllowed, rooms: data.rooms, sort: data.sort };
      const { error } = await context.supabase.from("profiles").update({ intake_item_settings: cur as never }).eq("id", context.userId);
      return error ? { ok: false, error: "저장하지 못했습니다." } : { ok: true };
    }
    // 이름·분류를 바꿔도 그림 파일 연결(storage_path)은 그대로 둡니다.
    const { data: row, error } = await context.supabase.from("item_icons").update({
      intake_visible: data.visible, intake_disposal_allowed: data.disposalAllowed, intake_rooms: data.rooms, intake_sort: data.sort,
      ...(data.name ? { display_name: data.name } : {}), ...(data.cat ? { category_group: data.cat } : {}),
    }).eq("user_id", context.userId).eq("item_id", data.id).eq("active", true).select("id").maybeSingle();
    if (error || !row) return { ok: false, error: "저장하지 못했습니다." };
    return { ok: true };
  });

// ───────────────────────── 고객용 ─────────────────────────

export interface IntakeOpen {
  ok: boolean;
  error?: string;
  /** closed: 확정되어 수정 마감 */
  state?: "open" | "submitted" | "closed";
  companyName?: string;
  contact?: string;
  form?: IntakeForm;
  items?: { id: string; name: string; icon?: string; rooms: string[]; disposalAllowed: boolean }[];
}

const tokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

async function findByToken(token: string) {
  const { hashIntakeToken } = await import("./intake.server");
  const sb = await admin();
  const { data } = await sb.from("intake_requests")
    .select("id, company_id, estimate_id, customer_name, customer_phone, status, expires_at, submission, draft, first_opened_at, editing_started_at, first_submitted_at, submit_count")
    .eq("token_hash", await hashIntakeToken(token)).maybeSingle();
  return { sb, row: data as any };
}

function blockReason(row: any): string | null {
  if (!row) return "잘못된 주소입니다. 업체에 다시 요청해 주세요.";
  if (row.status === "cancelled") return "취소된 링크입니다. 업체에 문의해 주세요.";
  if (row.status !== "confirmed" && new Date(row.expires_at).getTime() <= Date.now()) return "유효기간이 지난 링크입니다. 업체에 문의해 주세요.";
  return null;
}

export const openIntake = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }): Promise<IntakeOpen> => {
    const { sb, row } = await findByToken(data.token);
    const blocked = blockReason(row);
    if (blocked) return { ok: false, error: blocked };
    const { data: prof } = await sb.from("profiles").select("company_name, phone").eq("id", row.company_id).maybeSingle();
    const companyName = String(prof?.company_name ?? "").trim() || "이사업체";
    const contact = formatTel(String(prof?.phone ?? "")) || formatTel(ADMIN_SENDER);
    if (row.status === "confirmed") return { ok: true, state: "closed", companyName, contact };
    const now = new Date().toISOString();
    await sb.from("intake_requests").update({
      first_opened_at: row.first_opened_at ?? now, last_opened_at: now,
      ...(row.status === "created" || row.status === "sent" ? { status: "opened" } : {}),
    }).eq("id", row.id);
    const saved = (row.draft && Object.keys(row.draft).length ? row.draft : row.submission) as Partial<IntakeForm>;
    const form: IntakeForm = {
      customerName: saved.customerName ?? row.customer_name, phone: saved.phone ?? row.customer_phone,
      moveDate: saved.moveDate ?? "", moveTime: saved.moveTime ?? "", fromAddress: saved.fromAddress ?? "",
      fromDetail: saved.fromDetail ?? "", toAddress: saved.toAddress ?? "", toDetail: saved.toDetail ?? "",
      fromX: saved.fromX ?? null, fromY: saved.fromY ?? null, toX: saved.toX ?? null, toY: saved.toY ?? null,
      rooms: (saved.rooms ?? {}) as IntakeRooms,
    };
    const items = (await itemsFor(sb, row.company_id, true)).map(({ id, name, icon, rooms, disposalAllowed }) => ({ id, name, icon, rooms, disposalAllowed }));
    return { ok: true, state: row.status === "submitted" ? "submitted" : "open", companyName, contact, form, items };
  });

export const saveIntakeProgress = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenSchema, form: formSchema }).parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean; closed?: boolean; error?: string }> => {
    const { sb, row } = await findByToken(data.token);
    const blocked = blockReason(row);
    if (blocked) return { ok: false, error: blocked };
    if (row.status === "confirmed") return { ok: false, closed: true };
    const now = new Date().toISOString();
    const { error } = await sb.from("intake_requests").update({
      draft: data.form as never, editing_started_at: row.editing_started_at ?? now,
      ...(row.status !== "submitted" ? { status: "editing" } : {}),
    }).eq("id", row.id).neq("status", "confirmed");
    return error ? { ok: false, error: "임시 저장하지 못했습니다." } : { ok: true };
  });

export const submitIntake = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenSchema, form: formSchema, consent: z.literal(true) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean; closed?: boolean; error?: string }> => {
    const { sb, row } = await findByToken(data.token);
    const blocked = blockReason(row);
    if (blocked) return { ok: false, error: blocked };
    if (row.status === "confirmed") return { ok: false, closed: true };
    const f = data.form;
    if (!f.customerName.trim()) return { ok: false, error: "이름을 입력해 주세요." };
    if (!phoneSchema.safeParse(f.phone).success) return { ok: false, error: "휴대전화 번호를 확인해 주세요." };
    const form: IntakeForm = { ...f, phone: formatTel(f.phone), customerName: f.customerName.trim() };

    // 견적 초안은 요청마다 미리 정해 둔 견적 ID 한 건만 씁니다 (같은 업체·같은 ID는 데이터베이스에서 하나만 허용).
    const { baseEstimate } = await import("./intake.server");
    const { data: draftRow } = await sb.from("estimate_drafts").select("id, payload, revision, deleted_at")
      .eq("user_id", row.company_id).eq("estimate_id", row.estimate_id).maybeSingle();
    const prevRooms = (row.submission?.rooms ?? null) as IntakeRooms | null;
    const base = (draftRow?.payload as Record<string, unknown> | null) ?? baseEstimate(row.estimate_id);
    const nameOf = (id: string) => INTAKE_BASE_ITEMS.find((b) => b.id === id)?.name ?? id;
    const merged = mergeIntakeIntoDraft(base, form, prevRooms, { intakeRequestId: row.id });
    merged.intakeNote = intakeSummary(form, nameOf).join("\n");
    merged.intakeDisposalFee = "방문 후 확인";
    const revision = Math.max(Number(draftRow?.revision ?? 0) + 1, Math.floor(Date.now() / 1000));
    if (!draftRow) {
      const { error } = await sb.from("estimate_drafts").insert({ user_id: row.company_id, estimate_id: row.estimate_id, payload: merged as never, revision });
      if (error && error.code !== "23505") return { ok: false, error: "저장하지 못했습니다. 잠시 후 다시 눌러 주세요." };
      if (error) {
        await sb.from("estimate_drafts").update({ payload: merged as never, revision }).eq("user_id", row.company_id).eq("estimate_id", row.estimate_id);
      }
    } else if (!draftRow.deleted_at) {
      // 사장님이 지운 견적은 되살리지 않습니다.
      const { error } = await sb.from("estimate_drafts").update({ payload: merged as never, revision }).eq("id", draftRow.id);
      if (error) return { ok: false, error: "저장하지 못했습니다. 잠시 후 다시 눌러 주세요." };
    }
    const now = new Date().toISOString();
    const { error } = await sb.from("intake_requests").update({
      submission: form as never, draft: form as never, status: "submitted", consent_at: now,
      first_submitted_at: row.first_submitted_at ?? now, last_submitted_at: now,
      submit_count: Number(row.submit_count ?? 0) + 1, owner_seen_at: null,
      editing_started_at: row.editing_started_at ?? now,
    }).eq("id", row.id).neq("status", "confirmed");
    if (error) return { ok: false, error: "저장하지 못했습니다. 잠시 후 다시 눌러 주세요." };
    return { ok: true };
  });
