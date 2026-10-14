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
  INTAKE_BASE_ITEMS, INTAKE_ROOMS, INTAKE_SIZES, intakeItemName, intakeSmsText, mergeIntakeIntoDraft, intakeSummary,
  type IntakeForm, type IntakeRooms, customerItemLabel, isLargeCustomerItem, customerCatalogRoleAllowed,
} from "./intake";

const ADMIN_SENDER = "01075662542";
const OWNER_COLS =
  "id, estimate_id, source_estimate_id, customer_name, customer_phone, status, expires_at, submission, first_opened_at, last_opened_at, editing_started_at, first_submitted_at, last_submitted_at, submit_count, consent_at, confirmed_at, cancelled_at, owner_seen_at, last_sent_at, last_send_method, last_send_error, created_at, updated_at, visit_date, visit_time, visit_status";

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
  /** 방문 견적 일정 (YYYY-MM-DD) */
  visit_date: string | null;
  visit_time: string | null;
  /** none | scheduled */
  visit_status: string;
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
  fromJibun: z.string().max(200).optional(),
  fromZip: z.string().max(10).optional(),
  toJibun: z.string().max(200).optional(),
  toZip: z.string().max(10).optional(),
  fromSize: z.union([z.enum(INTAKE_SIZES), z.enum(["50~60평"]), z.literal("")]).optional(),
  moveType: z.enum(["포장이사", "반포장이사", "일반이사", "보관이사", "사무실이사"]).optional(),
  storageEnabled: z.boolean().optional(), memo: z.string().max(2000).optional(),
  fromEnv: z.enum(["계단", "엘리베이터"]).optional(), toEnv: z.enum(["계단", "엘리베이터"]).optional(),
  fromFloor: z.number().int().min(-5).max(100).nullable().optional(), toFloor: z.number().int().min(-5).max(100).nullable().optional(),
  fromFloorEdited: z.boolean().optional(), toFloorEdited: z.boolean().optional(),
  ladderFrom: z.boolean().optional(), ladderTo: z.boolean().optional(),
  fromDecideOnVisit: z.boolean().optional(), toDecideOnVisit: z.boolean().optional(),
  spaces: z.array(z.enum(["거실", "안방", "작은방", "부엌", "베란다", "기타", "입구방", "옷방", "서재"])).max(9).optional(),
  rooms: z.record(z.enum(["거실", "안방", "작은방", "부엌", "베란다", "기타", "입구방", "옷방", "서재"]), z.record(z.string().min(1).max(60), pickSchema)),
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

/** 사전 견적요청에 방문 견적 일정을 저장하거나 지웁니다 (자기 업체 요청만, RLS 적용). */
export const setIntakeVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    time: z.string().trim().max(20).nullable(),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const patch = data.date
      ? { visit_date: data.date, visit_time: data.time || null, visit_status: "scheduled" }
      : { visit_date: null, visit_time: null, visit_status: "none" };
    const { data: rows, error } = await context.supabase.from("intake_requests").update(patch)
      .eq("id", data.id).eq("company_id", context.userId).select("id");
    if (error) return { ok: false, error: `방문 일정을 저장하지 못했습니다. (${error.message})` };
    if (!rows?.length) return { ok: false, error: "이 업체의 사전 견적요청을 찾지 못했습니다." };
    return { ok: true };
  });

export const createIntakeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().trim().max(30).optional(), phone: phoneSchema, sourceEstimateId: z.string().max(80).optional() }).parse(d),
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
      estimate_id: estimateId, customer_name: data.name ?? "", customer_phone: formatTel(data.phone),
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

/**
 * 고객이 제출한 사전정보 견적 초안 전체 — 사장님 「견적 내역」 목록에 넣기 위해 씁니다.
 * (견적 내역은 휴대폰에 저장된 목록이라, 고객이 서버에 만든 초안은 여기서 받아와 합칩니다.)
 */
export const listIntakeDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; payloads: string[]; error?: string }> => {
    const { data: reqs, error } = await context.supabase.from("intake_requests").select("estimate_id")
      .eq("company_id", context.userId).in("status", ["submitted", "confirmed"]).limit(300);
    if (error) return { ok: false, payloads: [], error: "사전정보 견적을 불러오지 못했습니다." };
    const ids = (reqs ?? []).map((r) => r.estimate_id as string);
    if (!ids.length) return { ok: true, payloads: [] };
    const { data: rows, error: e2 } = await context.supabase.from("estimate_drafts").select("payload")
      .eq("user_id", context.userId).in("estimate_id", ids).is("deleted_at", null);
    if (e2) return { ok: false, payloads: [], error: "사전정보 견적을 불러오지 못했습니다." };
    return { ok: true, payloads: (rows ?? []).map((r) => JSON.stringify(r.payload)) };
  });

/** Retire only unconverted submitted intake drafts; the locked RPC preserves formal records. */
export const retireUnconvertedIntakeDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; ids: string[]; error?: string }> => {
    const { data, error } = await context.supabase.rpc("retire_unconverted_intake_drafts");
    if (error) return { ok: false, ids: [], error: error.message };
    return data as { ok: boolean; ids: string[] };
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
  size?: string;
  kind: "base" | "company";
  cat?: string;
  /** 가구 / 가전 */
  group: "가구" | "가전" | "주방";
  /** 묶음 이름 (침대·소파·TV …) */
  family?: string;
  /** 추천 평수 범위 */
  sizes?: [number, number];
}
/** Platform roles are verified through the authenticated client's role rows before privileged access. */
async function catalogAllowed(context: { supabase: any; userId: string }): Promise<boolean> {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).in("role", ["admin", "super_admin"]);
  return !error && customerCatalogRoleAllowed((data ?? []).map((r: {role:string}) => r.role));
}
export const canManageIntakeItems = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ allowed: await catalogAllowed(context) }));

async function itemsFor(sb: any, companyId: string, onlyVisible: boolean): Promise<IntakeItem[]> {
  const { data: icons, error } = await sb.from("item_icons")
    .select("id,item_id,name,display_name,image_path,storage_path,image_url,category_group,customer_key,customer_only,customer_visible,customer_room,customer_order,customer_category,customer_name,customer_size,customer_disposal_allowed,customer_deleted_at")
    .or(`customer_only.eq.true,user_id.eq.${companyId}`).eq("active", true).eq("status", "ready");
  if (error) throw new Error("품목 그림을 불러오지 못했습니다.");
  const rows = (icons ?? []) as any[];
  const overrides = new Map(rows.filter(r => r.customer_key).map(r => [r.customer_key, r]));
  const base: IntakeItem[] = await Promise.all(INTAKE_BASE_ITEMS.filter(b => !overrides.has(b.id)).map(async (b) => {
    const source = rows.find(r => !r.customer_only && (r.item_id === b.id || (b.id === "bookshelf-01" && r.item_id === "bookself-01")));
    const path = source?.image_path || source?.storage_path;
    let icon = b.img;
    if (path) {
      const signed = await sb.storage.from("item-icons").createSignedUrl(path, 900);
      if (signed.error || !signed.data?.signedUrl) throw new Error("품목 그림을 불러오지 못했습니다.");
      icon = signed.data.signedUrl;
    }
    return {id:b.id,name:b.name,icon,rooms:b.rooms,visible:true,disposalAllowed:true,sort:INTAKE_BASE_ITEMS.indexOf(b)*10,kind:"base" as const,group:b.group,family:b.kind,sizes:b.sizes,size:""};
  }));
  const custom: IntakeItem[] = await Promise.all(rows.filter(r => r.customer_only || r.customer_visible === true).filter(r => !r.customer_deleted_at).map(async r => {
    const original = INTAKE_BASE_ITEMS.find(b => b.id === r.customer_key);
    const label = customerItemLabel(r.customer_name, r.display_name, r.name, r.item_id);
    const name = r.customer_size && !label.includes(r.customer_size) ? `${label} ${r.customer_size}` : label;
    const source = original && rows.find(s => !s.customer_only && (s.item_id === original.id || (original.id === "bookshelf-01" && s.item_id === "bookself-01")));
    const path = r.image_path || r.storage_path || source?.image_path || source?.storage_path;
    let icon = original?.img;
    if (path) {
      const signed = await sb.storage.from("item-icons").createSignedUrl(path, 900);
      if (signed.error || !signed.data?.signedUrl) throw new Error("품목 그림을 불러오지 못했습니다.");
      icon = signed.data.signedUrl;
    }
    return {id:r.item_id,name,icon,rooms:r.customer_room ?? original?.rooms ?? [], visible:r.customer_visible !== false,
      disposalAllowed:r.customer_disposal_allowed !== false,sort:r.customer_order,kind:"company" as const,
      group:(r.customer_category === "가전" || r.customer_category === "주방" ? r.customer_category : "가구") as "가구" | "가전" | "주방",family:original?.kind,sizes:original?.sizes,size:r.customer_size || ""};
  }));
  const all = [...base,...custom].filter(i => isLargeCustomerItem(i.name)).sort((a,b) => a.sort-b.sort);
  return onlyVisible ? all.filter(i => i.visible) : all;
}

export const listIntakeItemsOwner = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ok:boolean;items:IntakeItem[];error?:string}> => {
    if (!await catalogAllowed(context)) return {ok:false,items:[],error:"관리자만 고객 품목을 관리할 수 있습니다."};
    return {ok:true,items:await itemsFor(await admin(), context.userId, false)};
  });

const settingSchema = z.object({id:z.string().min(1).max(60),kind:z.enum(["base","company"]),visible:z.boolean(),disposalAllowed:z.boolean(),
  rooms:z.array(z.enum(INTAKE_ROOMS)).max(6),sort:z.number().int().min(0).max(100000),name:z.string().trim().min(1).max(24).optional(),
  cat:z.enum(["가구","가전","주방"]).optional(),size:z.string().max(24).optional(),photo:z.string().max(4000000).optional()});

async function catalogRow(sb:any, userId:string, id:string) {
  const existing = await sb.from("item_icons").select("id,item_id,customer_key,image_path,storage_path").or(`customer_only.eq.true,user_id.eq.${userId}`).eq("item_id",id).eq("active",true).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data;
  const b=INTAKE_BASE_ITEMS.find(b=>b.id===id);
  if (!b) throw new Error("품목을 찾지 못했습니다.");
  const inserted=await sb.from("item_icons").insert({user_id:userId,created_by:userId,item_id:b.id,name:b.name,display_name:b.name,
    norm_name:`customer:${b.id}`,normalized_name:`customer:${b.id}`,cat:b.group,category_group:b.group,status:"ready",source:"company",
    customer_only:true,customer_key:b.id,customer_visible:true,customer_name:b.name,customer_category:b.group,customer_room:b.rooms,
    customer_order:INTAKE_BASE_ITEMS.indexOf(b)*10,default_volume:b.vol ?? 0.5}).select("id,item_id,customer_key,image_path,storage_path").single();
  if(inserted.error) throw new Error(inserted.error.message);
  return inserted.data;
}

async function uploadCustomerPicture(sb:any,userId:string,photo:string) {
  if(!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(photo)) throw new Error("그림 파일을 확인해 주세요.");
  const png=photo.startsWith("data:image/png");
  const bytes=Uint8Array.from(atob(photo.split(",")[1]),c=>c.charCodeAt(0));
  if(bytes.length<100 || (png ? bytes[0]!==137 || bytes[1]!==80 : bytes[0]!==255 || bytes[1]!==216)) throw new Error("그림 파일을 확인해 주세요.");
  const path=`${userId}/customer-${crypto.randomUUID()}.${png?"png":"jpg"}`;
  const uploaded=await sb.storage.from("item-icons").upload(path,bytes,{contentType:png?"image/png":"image/jpeg",upsert:false});
  if(uploaded.error) throw new Error(uploaded.error.message);
  return path;
}

export const saveIntakeItemSetting = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>settingSchema.parse(d))
 .handler(async({data,context})=>{
  if(!await catalogAllowed(context)) return {ok:false,error:"관리자만 고객 품목을 관리할 수 있습니다."};
  const sb=await admin(); let path:string|undefined;
  try {
    if(data.name && !isLargeCustomerItem(data.name)) return {ok:false,error:"큰 가구·가전 이름을 입력해 주세요."};
    const row=await catalogRow(sb,context.userId,data.id);
    if(data.photo) path=await uploadCustomerPicture(sb,context.userId,data.photo);
    const {error}=await sb.from("item_icons").update({customer_visible:data.visible,customer_disposal_allowed:data.disposalAllowed,
      customer_room:data.rooms,customer_order:data.sort,...(data.name?{customer_name:data.name}:{}),...(data.cat?{customer_category:data.cat}:{}),
      ...(data.size!==undefined?{customer_size:data.size}:{}),...(path?{image_path:path,storage_path:path}: {})}).eq("id",row.id);
    if(error) throw new Error(error.message);
    return {ok:true};
  }catch(e){if(path) await sb.storage.from("item-icons").remove([path]);return {ok:false,error:e instanceof Error?e.message:"저장하지 못했습니다."};}
 });

export const createCustomerIntakeItem = createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 .inputValidator((d:unknown)=>z.object({name:z.string().trim().min(2).max(24),cat:z.enum(["가구","가전","주방"]),size:z.string().max(24),
  rooms:z.array(z.enum(INTAKE_ROOMS)).max(6),disposal:z.boolean(),sort:z.number().int().min(0),photo:z.string().max(4000000)}).parse(d))
 .handler(async({data,context})=>{
  if(!await catalogAllowed(context)) return {ok:false,error:"관리자만 고객 품목을 관리할 수 있습니다."};
  if(!isLargeCustomerItem(data.name)) return {ok:false,error:"큰 가구·가전 이름을 입력해 주세요."};
  const sb=await admin();let path:string|undefined;
  try {
    path=await uploadCustomerPicture(sb,context.userId,data.photo);
    const id=crypto.randomUUID(), itemId=`customer_${id.replace(/-/g,"").slice(0,16)}`;
    const {error}=await sb.from("item_icons").insert({id,item_id:itemId,user_id:context.userId,created_by:context.userId,name:data.name,
      display_name:data.name,norm_name:itemId,normalized_name:itemId,cat:data.cat,category_group:data.cat,status:"ready",active:true,
      source:"company",image_path:path,storage_path:path,customer_only:true,customer_visible:true,customer_name:data.name,
      customer_room:data.rooms,customer_order:data.sort,customer_size:data.size,customer_category:data.cat,customer_disposal_allowed:data.disposal});
    if(error) throw new Error(error.message);
    return {ok:true};
  } catch(e) {if(path) await sb.storage.from("item-icons").remove([path]);return {ok:false,error:e instanceof Error?e.message:"저장하지 못했습니다."};}
 });

export const saveIntakeOrder = createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 .inputValidator((d:unknown)=>z.object({order:z.array(z.object({id:z.string().min(1).max(60),kind:z.enum(["base","company"])})).max(300)}).parse(d))
 .handler(async({data,context})=>{
  if(!await catalogAllowed(context)) return {ok:false,error:"관리자만 고객 품목을 관리할 수 있습니다."};
  const sb=await admin();
  try {const ids=[]; for(const o of data.order) ids.push((await catalogRow(sb,context.userId,o.id)).id);
    const r=await context.supabase.rpc("save_customer_catalog_order",{ids});
    return r.error?{ok:false,error:r.error.message}:{ok:true};
  }catch(e){return {ok:false,error:e instanceof Error?e.message:"순서를 저장하지 못했습니다."};}
 });
export const removeIntakeItem = createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 .inputValidator((d:unknown)=>z.object({id:z.string().min(1).max(60),kind:z.enum(["base","company"])}).parse(d))
 .handler(async({data,context})=>{
  if(!await catalogAllowed(context)) return {ok:false,error:"관리자만 고객 품목을 관리할 수 있습니다."};
  try {const sb=await admin(); const row=await catalogRow(sb,context.userId,data.id);
    const r=await sb.from("item_icons").update({customer_visible:false,customer_deleted_at:new Date().toISOString()}).eq("id",row.id);
    return r.error?{ok:false,error:r.error.message}:{ok:true};
  }catch(e){return {ok:false,error:e instanceof Error?e.message:"삭제하지 못했습니다."};}
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
  items?: { id: string; name: string; icon?: string; rooms: string[]; disposalAllowed: boolean; group: "가구" | "가전" | "주방"; family?: string; sizes?: [number, number] }[];
  /** 관리자가 고객 화면에서 숨긴 짐픽 기본 품목 ID */
  hiddenIds?: string[];
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
      // 이름은 고객이 1단계에서 직접 입력합니다(업체가 저장한 이름을 미리 채우지 않음).
      customerName: saved.customerName ?? "", phone: saved.phone ?? row.customer_phone,
      moveDate: saved.moveDate ?? "", moveTime: saved.moveTime ?? "", fromAddress: saved.fromAddress ?? "",
      fromDetail: saved.fromDetail ?? "", toAddress: saved.toAddress ?? "", toDetail: saved.toDetail ?? "",
      fromX: saved.fromX ?? null, fromY: saved.fromY ?? null, toX: saved.toX ?? null, toY: saved.toY ?? null,
      fromJibun: saved.fromJibun ?? "", fromZip: saved.fromZip ?? "", toJibun: saved.toJibun ?? "", toZip: saved.toZip ?? "",
      fromSize: saved.fromSize ?? "",
      spaces: Array.isArray(saved.spaces) ? saved.spaces : undefined,
      moveType: saved.moveType, storageEnabled: saved.storageEnabled, memo: saved.memo,
      fromEnv: saved.fromEnv, toEnv: saved.toEnv, fromFloor: saved.fromFloor, toFloor: saved.toFloor,
      fromFloorEdited: saved.fromFloorEdited, toFloorEdited: saved.toFloorEdited,
      ladderFrom: saved.ladderFrom, ladderTo: saved.ladderTo,
      rooms: (saved.rooms ?? {}) as IntakeRooms,
    };
    // 고객 화면은 짐픽 기본 품목(가구·가전·주방)을 그대로 쓰고, 여기서는 관리자가 추가한 고객용 카드만 더합니다.
    const items = (await itemsFor(sb, row.company_id, true)).filter(i => i.kind === "company").map(({ id, name, icon, rooms, disposalAllowed, group, family, sizes }) => ({ id, name, icon, rooms, disposalAllowed, group, family, sizes }));
    const { data: hiddenRows } = await sb.from("item_icons").select("customer_key,item_id").eq("customer_visible", false).not("customer_key", "is", null).or(`customer_only.eq.true,user_id.eq.${row.company_id}`);
    const hiddenIds = Array.from(new Set(((hiddenRows ?? []) as { customer_key: string | null }[]).map(r => r.customer_key).filter((v): v is string => !!v)));
    return { ok: true, state: row.status === "submitted" ? "submitted" : "open", companyName, contact, form, items, hiddenIds };
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
    const company = await itemsFor(sb, row.company_id, false);
    const { ITEM_CATALOG } = await import("./jimpick");
    const nameOf = (id: string) => ITEM_CATALOG.find((c) => c.id === id)?.name ?? intakeItemName(id) ?? company.find((c) => c.id === id)?.name ?? id;
    const merged = mergeIntakeIntoDraft(base, form, prevRooms, { intakeRequestId: row.id });
    const pickedIds = new Set(Object.values(form.rooms).flatMap(p => Object.keys(p)));
    const snapshots = (base.customItems as any[] | undefined) ?? [];
    const {data:storedIcons}=await sb.from("item_icons").select("id,item_id,image_path,storage_path").in("item_id",[...Array.from(pickedIds), ...(pickedIds.has("bookshelf-01") ? ["bookself-01"] : [])]).or(`customer_only.eq.true,user_id.eq.${row.company_id}`).eq("active",true);
    const pictureFor = (id:string) => (storedIcons ?? []).find(r => (r.item_id===id || (id==="bookshelf-01" && r.item_id==="bookself-01")) && (r.image_path || r.storage_path));
    merged.customItems = [...snapshots.filter(i => !pickedIds.has(i.id)), ...company.filter(i => pickedIds.has(i.id)).map(i => ({
      id:i.id,name:i.name,cat:i.group,extra:0.5,active:true,icon:pictureFor(i.id) ? `/api/public/item-icon/${pictureFor(i.id)?.id}.png` : (INTAKE_BASE_ITEMS.find(b=>b.id===i.id || b.id===i.family)?.img ?? i.icon)
    }))];
    merged.intakeNote = intakeSummary(form, nameOf).join("\n");
    merged.intakeDisposalFee = "방문 후 확인";
    merged.intakeSubmittedAt = new Date().toISOString();
    const FAIL = "저장하지 못했습니다. 다시 눌러 주세요.";
    const revision = Math.max(Number(draftRow?.revision ?? 0) + 1, Math.floor(Date.now() / 1000));
    if (!draftRow) {
      const { error } = await sb.from("estimate_drafts").insert({ user_id: row.company_id, estimate_id: row.estimate_id, payload: merged as never, revision });
      if (error && error.code !== "23505") { console.error("[submitIntake] draft insert", error.code, error.message); return { ok: false, error: FAIL }; }
      if (error) {
        const u = await sb.from("estimate_drafts").update({ payload: merged as never, revision }).eq("user_id", row.company_id).eq("estimate_id", row.estimate_id);
        if (u.error) { console.error("[submitIntake] draft update", u.error.code, u.error.message); return { ok: false, error: FAIL }; }
      }
    } else if (!draftRow.deleted_at) {
      // 사장님이 지운 견적은 되살리지 않습니다.
      const { error } = await sb.from("estimate_drafts").update({ payload: merged as never, revision }).eq("id", draftRow.id);
      if (error) { console.error("[submitIntake] draft update", error.code, error.message); return { ok: false, error: FAIL }; }
    }
    if (draftRow?.deleted_at) return {ok:false,error:FAIL};
    const now = new Date().toISOString();
    const { data: submitted, error } = await sb.from("intake_requests").update({
      submission: form as never, draft: form as never, status: "submitted", customer_name: form.customerName, consent_at: now,
      first_submitted_at: row.first_submitted_at ?? now, last_submitted_at: now,
      submit_count: Number(row.submit_count ?? 0) + 1, owner_seen_at: null,
      editing_started_at: row.editing_started_at ?? now,
    }).eq("id", row.id).neq("status", "confirmed").select("id").maybeSingle();
    if (error || !submitted) { console.error("[submitIntake] request update", error?.code, error?.message); return { ok: false, error: FAIL }; }
    return { ok: true };
  });
