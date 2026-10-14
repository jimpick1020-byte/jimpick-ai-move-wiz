/**
 * 사장님용 「고객 사전정보 요청」 화면 묶음.
 *  - IntakeRequestButton : 고객 카드·견적 시작 화면에 붙는 파란 버튼
 *  - IntakeRequestSheet  : 링크 만들기·문자·카카오톡·복사·다시 보내기·취소·확정·초안 열기
 *  - IntakeInbox         : 고객 관리 위쪽의 요청 목록
 *  - IntakeNotifier      : 고객이 제출하면 앱 알림
 *  - IntakeItemsManager  : 고객 링크 품목 관리
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, X, Send, Copy, MessageCircle, Ban, CheckCircle2, ArrowRight, Settings2, Plus, GripVertical, Trash2 } from "lucide-react";
import { useApp, ITEM_CATALOG, type Estimate } from "@/lib/jimpick";
import { formatTel } from "@/lib/format-input";
import { Icon3D, icon3dFor } from "@/lib/jimpick-icon3d";
import {
  cancelIntakeRequest, confirmIntakeRequest, createIntakeRequest, getIntakeLink, listIntakeItemsOwner,
  listIntakeDrafts, listIntakeRequests, loadIntakeDraft, markIntakeSeen, removeIntakeItem, saveIntakeItemSetting, saveIntakeOrder, sendIntakeSms,
  removeCustomerSelectedItem,
  type IntakeItem, type IntakeRow,
} from "@/lib/intake.functions";
import { Button } from "@/components/ui/button";
import { canManageIntakeItems, createCustomerIntakeItem } from "@/lib/intake.functions";
import { INTAKE_ROOMS, floorText, intakeItemName, intakeStatusLabel, strictFloor, type IntakeForm } from "@/lib/intake";

/** 고객이 아직 이름을 넣기 전에는 전화번호로 구분합니다 */
export function intakeDisplayName(r: Pick<IntakeRow, "customer_name">): string {
  return r.customer_name?.trim() || "이름 입력 전";
}

const STATUS_CLASS: Record<string, string> = {
  "링크 미발송": "bg-[#EEF1F5] text-[#6B7280]",
  "발송 완료": "bg-[#E0ECFF] text-[#1D4ED8]",
  "고객 열람": "bg-[#E0ECFF] text-[#1D4ED8]",
  "작성 중": "bg-[#FEF3C7] text-[#92400E]",
  "입력 완료": "bg-[#DCFCE7] text-[#166534]",
  "사장님 확인 완료": "bg-[#25282D] text-white",
  "링크 만료": "bg-[#F3F4F6] text-[#9CA3AF]",
  "링크 취소": "bg-[#FEE2E2] text-[#B91C1C]",
};

export function IntakeStatusChip({ row }: { row: Pick<IntakeRow, "status" | "expires_at"> }) {
  const l = intakeStatusLabel(row);
  return <span className={`rounded-full px-1.5 py-[1px] text-[10.5px] font-black ${STATUS_CLASS[l]}`}>{l === "입력 완료" ? "사전정보 입력 완료" : l}</span>;
}

/** 요청 목록 (모든 화면이 같은 목록을 함께 씁니다) */
let cache: IntakeRow[] = [];
const subs = new Set<(r: IntakeRow[]) => void>();
let inflight: Promise<void> | null = null;
export function reloadIntakeRequests(): Promise<void> {
  if (inflight) return inflight;
  inflight = listIntakeRequests()
    .then((r) => {
      if (r.ok) {
        cache = r.rows;
        subs.forEach((f) => f(cache));
      }
    })
    .catch(() => {})
    .finally(() => { inflight = null; });
  return inflight;
}
export function useIntakeRequests(): IntakeRow[] {
  const [rows, setRows] = useState<IntakeRow[]>(cache);
  useEffect(() => {
    subs.add(setRows);
    void reloadIntakeRequests();
    return () => { subs.delete(setRows); };
  }, []);
  return rows;
}

/** 고객 견적 id 목록이나 전화번호로 이 고객의 최신 요청 찾기 */
export function findIntakeFor(rows: IntakeRow[], ids: string[], phone: string): IntakeRow | undefined {
  const p = phone.replace(/[^0-9]/g, "");
  return rows.find((r) => (r.source_estimate_id && ids.includes(r.source_estimate_id)) || ids.includes(r.estimate_id))
    ?? rows.find((r) => p && r.customer_phone.replace(/[^0-9]/g, "") === p);
}

export function IntakeRequestButton({ name = "", phone = "", sourceEstimateId, label = "사전정보 요청", wide = false }:
  { name?: string; phone?: string; sourceEstimateId?: string; label?: string; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost"
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`${wide ? "w-full py-3 text-[15px]" : "px-2 py-2 text-[11px]"} inline-flex items-center justify-center gap-1 rounded-lg bg-[#2563EB] font-black text-white active:scale-[0.98]`}
      >
        <FileText className="w-4 h-4" /> {label}
      </Button>
      {open && <IntakeRequestSheet name={name} phone={phone} sourceEstimateId={sourceEstimateId} onClose={() => setOpen(false)} />}
    </>
  );
}

export function IntakeRequestSheet({ name, phone, sourceEstimateId, requestId, onClose }:
  { name: string; phone: string; sourceEstimateId?: string; requestId?: string; onClose: () => void }) {
  const rows = useIntakeRequests();
  // 고객 이름은 업체가 넣지 않고, 고객이 링크 1단계에서 직접 입력합니다.
  void name;
  const [p, setP] = useState(formatTel(phone));
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rowId, setRowId] = useState<string | undefined>(requestId);
  const { patchDraft, setScreen } = useApp();
  const row = rows.find((r) => r.id === rowId)
    ?? (sourceEstimateId ? rows.find((r) => r.source_estimate_id === sourceEstimateId && r.status !== "cancelled") : undefined);
  useEffect(() => { if (row && !rowId) setRowId(row.id); }, [row, rowId]);
  const label = row ? intakeStatusLabel(row) : "링크 미발송";
  const closed = !row || label === "링크 취소" || label === "링크 만료";

  const ensure = async (): Promise<{ id: string; link?: string } | null> => {
    if (row && !closed) return { id: row.id };
    const r = await createIntakeRequest({ data: { phone: p, sourceEstimateId } });
    if (!r.ok || !r.row) { setErr(r.error ?? "링크를 만들지 못했습니다."); return null; }
    setRowId(r.row.id);
    await reloadIntakeRequests();
    return { id: r.row.id, link: r.link };
  };
  const run = async (key: string, f: () => Promise<void>) => {
    setErr(null);
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(p)) return setErr("고객 휴대전화 번호를 확인해 주세요.");
    setBusy(key);
    try { await f(); } catch (e) { setErr(e instanceof Error ? e.message : "처리하지 못했습니다."); }
    finally { setBusy(null); void reloadIntakeRequests(); }
  };
  const sms = () => run("sms", async () => {
    const r = await ensure(); if (!r) return;
    const out = await sendIntakeSms({ data: { id: r.id } });
    if (out.ok) toast.success("문자를 보냈습니다. (문자업체 접수 완료)");
    else setErr(`문자 발송 실패: ${out.error}`);
  });
  const linkOf = async (method: "copy" | "kakao") => {
    const r = await ensure(); if (!r) return null;
    const l = await getIntakeLink({ data: { id: r.id, method } });
    if (!l.ok || !l.link) { setErr(l.error ?? "링크를 불러오지 못했습니다."); return null; }
    return l.link;
  };
  const copy = () => run("copy", async () => {
    const link = await linkOf("copy"); if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("링크를 복사했습니다.");
  });
  const kakao = () => run("kakao", async () => {
    const link = await linkOf("kakao"); if (!link) return;
    const text = "[JIMPICK 짐픽] 고객님, 방문견적 전 기본정보 입력을 부탁드립니다.";
    if (navigator.share) {
      try { await navigator.share({ title: "짐픽 사전정보 입력", text, url: link }); } catch { /* 사장님이 공유창을 닫음 */ }
    } else {
      await navigator.clipboard.writeText(`${text}\n${link}`);
      toast("이 기기에는 공유창이 없어 링크를 복사했습니다. 카카오톡에 붙여 넣어 주세요.");
    }
  });
  const cancel = () => run("cancel", async () => {
    if (!row) return;
    if (!window.confirm("이 링크를 취소할까요? 고객은 더 이상 열 수 없습니다.")) return;
    const r = await cancelIntakeRequest({ data: { id: row.id } });
    if (r.ok) toast.success("링크를 취소했습니다."); else setErr(r.error ?? "취소하지 못했습니다.");
  });
  const confirm = () => run("confirm", async () => {
    if (!row) return;
    if (!window.confirm("사전정보를 확정할까요? 확정 후에는 고객이 더 이상 수정할 수 없습니다.")) return;
    const r = await confirmIntakeRequest({ data: { id: row.id } });
    if (r.ok) toast.success("사전정보를 확정했습니다."); else setErr(r.error ?? "확정하지 못했습니다.");
  });
  const openDraft = () => run("draft", async () => {
    if (!row) return;
    const r = await loadIntakeDraft({ data: { estimateId: row.estimate_id } });
    if (!r.ok || !r.payload) { setErr(r.error ?? "견적 초안을 불러오지 못했습니다."); return; }
    const server = JSON.parse(r.payload) as Estimate;
    patchDraft(() => server);
    onClose();
    setScreen("step1");
  });

  const sub = row?.submission as IntakeForm | undefined;
  const hasSub = !!sub && !!sub.customerName;
  const nameOf = (id: string) => ITEM_CATALOG.find(item => item.id === id)?.name ?? intakeItemName(id) ?? id;
  const removeSelected = async (room: string, itemId: string) => {
    if (!row || busy) return;
    setBusy("remove"); setErr(null);
    try {
      const result = await removeCustomerSelectedItem({ data: { requestId: row.id, room: room as (typeof INTAKE_ROOMS)[number], itemId } });
      if (!result.ok) { setErr(result.error || "품목을 삭제하지 못했습니다."); return; }
      await reloadIntakeRequests();
      toast.success("이 고객의 선택 품목을 삭제했습니다.");
    } catch (error) { setErr(error instanceof Error ? error.message : "품목을 삭제하지 못했습니다."); }
    finally { setBusy(null); }
  };
  const t = (v: string | null | undefined) => (v ? new Date(v).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="w-full max-w-md max-h-[92vh] overflow-auto rounded-t-3xl bg-white p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-[#25282D]">고객 사전정보 요청</h2>
          <Button variant="ghost" type="button" onClick={onClose} aria-label="닫기" className="p-2"><X className="w-5 h-5" /></Button>
        </div>
        <label className="block text-sm font-bold">고객 휴대전화 번호
          <input value={p} inputMode="tel" onChange={(e) => setP(formatTel(e.target.value))} disabled={!!row && !closed}
            className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-3 text-base" placeholder="010-0000-0000" />
        </label>
        <p className="text-xs text-[#6B7280]">고객 이름은 문자를 받은 고객이 링크에서 직접 입력합니다.{row?.customer_name ? ` (고객 입력 이름: ${row.customer_name})` : ""}</p>
        <div className="flex items-center gap-2 text-sm font-bold">링크 상태 {row ? <IntakeStatusChip row={row} /> : <span className={`rounded-full px-1.5 py-[1px] text-[10.5px] font-black ${STATUS_CLASS["링크 미발송"]}`}>링크 미발송</span>}</div>
        {row && (
          <div className="text-xs text-[#6B7280] space-y-0.5">
            <div>처음 열람 {t(row.first_opened_at)} · 작성 시작 {t(row.editing_started_at)}</div>
            <div>처음 제출 {t(row.first_submitted_at)} · 최근 수정 {t(row.last_submitted_at)} · 수정 {Math.max(0, row.submit_count - 1)}회</div>
            {row.last_send_error && <div className="text-[#B91C1C] font-bold">최근 발송 실패: {row.last_send_error}</div>}
          </div>
        )}
        {err && <div className="rounded-xl bg-[#FEE2E2] px-3 py-2 text-sm font-bold text-[#B91C1C]">{err}</div>}
        {label !== "사장님 확인 완료" && (
          <div className="grid grid-cols-2 gap-2">
            <ActionBtn icon={Send} onClick={sms} busy={busy === "sms"} primary>{row?.last_sent_at ? "다시 보내기(문자)" : "문자로 보내기"}</ActionBtn>
            <ActionBtn icon={MessageCircle} onClick={kakao} busy={busy === "kakao"}>카카오톡으로 보내기</ActionBtn>
            <ActionBtn icon={Copy} onClick={copy} busy={busy === "copy"}>링크 복사</ActionBtn>
            {row && !closed && <ActionBtn icon={Ban} onClick={cancel} busy={busy === "cancel"} danger>링크 취소</ActionBtn>}
          </div>
        )}
        {hasSub && sub && (
          <div className="rounded-2xl bg-[#F7F8F5] p-3 text-sm space-y-1">
            <div className="font-black">고객 입력 내용</div>
            <div>{sub.customerName} · {sub.phone}</div>
            <div>이사 {sub.moveDate || "-"} {sub.moveTime}</div>
            {sub.fromSize && <div>출발지 평수(참고) {sub.fromSize}</div>}
            <div>출발 {sub.fromAddress} {sub.fromDetail} ({floorText(strictFloor(`${sub.fromDetail} ${sub.fromAddress}`))}){sub.fromZip ? ` · 우편 ${sub.fromZip}` : ""}</div>
            <div>도착 {sub.toAddress} {sub.toDetail} ({floorText(strictFloor(`${sub.toDetail} ${sub.toAddress}`))}){sub.toZip ? ` · 우편 ${sub.toZip}` : ""}</div>
            <div className="text-[#6B7280]">엘리베이터·사다리차: 방문 후 결정 · 폐기물 처리비: 방문 후 확인</div>
            {Object.entries(sub.rooms ?? {}).map(([room, picks]) => {
              const list = Object.entries(picks);
              if (!list.length) return null;
              return (
                <div key={room}><b>{room}</b>{" "}
                  {list.map(([id, pk]) => (
                    <span key={id} className={`inline-flex items-center gap-1 ${pk.disposal ? "text-destructive" : ""}`}>{nameOf(id)}{pk.disposal ? "(폐기)" : ""} {pk.qty}
                      <Button variant="ghost" size="icon" disabled={!!busy} className="size-8 text-destructive" aria-label={`${room} ${nameOf(id)} 선택 삭제`} onClick={() => void removeSelected(room, id)}><Trash2 className="size-4" /></Button>
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        {row && (row.status === "submitted" || row.status === "confirmed") && (
          <div className="grid grid-cols-1 gap-2">
            <ActionBtn icon={ArrowRight} onClick={openDraft} busy={busy === "draft"} primary>견적 초안으로 이동 · 내용 수정</ActionBtn>
            {row.status === "submitted" && <ActionBtn icon={CheckCircle2} onClick={confirm} busy={busy === "confirm"}>사전정보 확정</ActionBtn>}
          </div>
        )}
        <p className="text-[11px] text-[#9CA3AF]">문자는 짐픽 공통 번호(010-7566-2542)로 나가고, 문의번호에는 업체 연락처가 들어갑니다.</p>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, children, onClick, busy, primary, danger }:
  { icon: typeof Send; children: React.ReactNode; onClick: () => void; busy?: boolean; primary?: boolean; danger?: boolean }) {
  return (
    <Button variant="ghost" type="button" onClick={onClick} disabled={busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-sm font-black disabled:opacity-60 ${
        primary ? "bg-[#2563EB] text-white" : danger ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#EEF1F5] text-[#25282D]"}`}>
      <Icon className="w-4 h-4" /> {busy ? "처리 중…" : children}
    </Button>
  );
}

/** 고객 관리 위쪽 — 사전정보 요청 현황 */
export function IntakeInbox() {
  const rows = useIntakeRequests();
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = rows.filter((r) => r.status !== "cancelled").slice(0, 20);
  const open = rows.find((r) => r.id === openId);
  return (
    <div className="space-y-2">
      {shown.length > 0 && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3 space-y-2">
          <div className="text-sm font-black text-[#25282D]">사전정보 요청 {shown.length}건</div>
          {shown.map((r) => (
            <Button variant="ghost" key={r.id} type="button" onClick={() => setOpenId(r.id)}
              className="w-full flex items-center justify-between rounded-xl bg-[#F7F8F5] px-3 py-2 text-left">
              <span className="text-sm font-bold">{intakeDisplayName(r)} <span className="text-xs text-[#6B7280]">{r.customer_phone}</span></span>
              <IntakeStatusChip row={r} />
            </Button>
          ))}
        </div>
      )}
      {open && <IntakeRequestSheet name={open.customer_name} phone={open.customer_phone} requestId={open.id} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/** 고객이 제출하면 앱 알림 (앱을 열 때와 화면에 있는 동안 1분마다 확인) */
/** 고객이 제출한 사전정보 견적 초안을 사장님 「견적 내역」에 넣습니다 (같은 견적 id는 한 건만) */
let lastSyncKey = "";
function useIntakeDraftSync(rows: IntakeRow[]) {
  const { upsertServerEstimates, loggedIn } = useApp();
  const key = rows.filter((r) => r.status === "submitted" || r.status === "confirmed").map((r) => `${r.id}:${r.last_submitted_at}`).join("|");
  useEffect(() => {
    if (!loggedIn) { lastSyncKey = ""; return; }
    if (!key || key === lastSyncKey) return;
    lastSyncKey = key;
    listIntakeDrafts().then((r) => {
      if (!r.ok) { lastSyncKey = ""; return; }
      upsertServerEstimates(r.payloads.map((p) => JSON.parse(p) as Estimate));
    }).catch(() => { lastSyncKey = ""; });
  }, [key, loggedIn, upsertServerEstimates]);
}

export function IntakeNotifier() {
  const rows = useIntakeRequests();
  useIntakeDraftSync(rows);
  const shown = useRef(new Set<string>());
  useEffect(() => {
    const id = window.setInterval(() => void reloadIntakeRequests(), 60_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const fresh = rows.filter((r) => r.status === "submitted" && !r.owner_seen_at && !shown.current.has(`${r.id}:${r.last_submitted_at}`));
    if (!fresh.length) return;
    for (const r of fresh) {
      shown.current.add(`${r.id}:${r.last_submitted_at}`);
      toast.success(`${r.customer_name || r.customer_phone} 고객님이 사전정보 입력을 완료했습니다.`, { duration: 8000 });
    }
    void markIntakeSeen({ data: { ids: fresh.map((r) => r.id) } });
  }, [rows]);
  return null;
}

// ───────────── 고객 링크 품목 관리 ─────────────

export function IntakeItemsManager({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<IntakeItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(async () => {
    const r = await listIntakeItemsOwner();
    if (r.ok) setItems(r.items); else setErr(r.error ?? "품목을 불러오지 못했습니다.");
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async (it: IntakeItem, patch: Partial<IntakeItem>) => {
    const next = { ...it, ...patch };
    setItems((l) => l?.map((x) => (x.id === it.id ? next : x)) ?? l);
    const r = await saveIntakeItemSetting({ data: {
      id: next.id, kind: next.kind, visible: next.visible, disposalAllowed: next.disposalAllowed,
      rooms: next.rooms.filter((x): x is (typeof INTAKE_ROOMS)[number] => (INTAKE_ROOMS as readonly string[]).includes(x)),
      sort: next.sort, ...(patch.name ? { name: patch.name } : {}), ...(patch.group ? { cat:patch.group } : {}), ...(patch.size !== undefined ? { size:patch.size } : {}),
    } });
    if (!r.ok) { toast.error(r.error ?? "저장하지 못했습니다."); void load(); }
  };
  // ── 길게 눌러 끌어서 순서 바꾸기 ──
  const [dragId, setDragId] = useState<string | null>(null);
  const drag = useRef<{ id: string | null; timer?: number; x: number; y: number; moved: boolean }>({ id: null, x: 0, y: 0, moved: false });
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    // 끌기 중에는 화면이 스크롤되지 않게 막습니다(끌기 전에는 평소처럼 스크롤).
    const block = (e: TouchEvent) => { if (drag.current.id) e.preventDefault(); };
    document.addEventListener("touchmove", block, { passive: false });
    return () => document.removeEventListener("touchmove", block);
  }, []);
  const onDown = (e: React.PointerEvent, it: IntakeItem) => {
    if ((e.target as HTMLElement).closest("input,button,label,select")) return;
    const d = drag.current;
    d.x = e.clientX; d.y = e.clientY; d.moved = false;
    window.clearTimeout(d.timer);
    d.timer = window.setTimeout(() => {
      d.id = it.id; setDragId(it.id);
      try { navigator.vibrate?.(30); } catch { /* 진동 없음 */ }
    }, 450);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.id) {
      if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 10) window.clearTimeout(d.timer);
      return;
    }
    d.moved = true;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-intake-item]") as HTMLElement | null;
    const over = el?.dataset.intakeItem;
    if (!over || over === d.id) return;
    setItems((l) => {
      if (!l) return l;
      const from = l.findIndex((x) => x.id === d.id), to = l.findIndex((x) => x.id === over);
      if (from < 0 || to < 0) return l;
       const c = [...l]; const [m] = c.splice(from, 1); c.splice(to, 0, m);
       itemsRef.current = c;
      return c;
    });
  };
  const onUp = async () => {
    const d = drag.current;
    window.clearTimeout(d.timer);
    const was = d.id; d.id = null; setDragId(null);
    if (!was || !d.moved) return;
    const list = itemsRef.current ?? [];
    setItems(list.map((x, i) => ({ ...x, sort: i * 10 })));
    const r = await saveIntakeOrder({ data: { order: list.map((x) => ({ id: x.id, kind: x.kind })) } });
    if (!r.ok) { toast.error(r.error ?? "순서를 저장하지 못했습니다."); void load(); }
    else toast.success("순서를 저장했습니다.");
  };
  const remove = async (it: IntakeItem) => {
    if (!window.confirm(`「${it.name}」 카드를 고객 링크에서 삭제할까요?\n이미 받은 견적과 품목 그림은 그대로 남습니다.`)) return;
    const r = await removeIntakeItem({ data: { id: it.id, kind: it.kind } });
    if (r.ok) { setItems((l) => l?.filter((x) => x.id !== it.id) ?? l); toast.success("고객 링크에서 삭제했습니다."); }
    else toast.error(r.error ?? "삭제하지 못했습니다.");
  };
  useEffect(() => {
    const release = () => { if (drag.current.id) void onUp(); };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => { window.removeEventListener("pointerup", release); window.removeEventListener("pointercancel", release); };
  });
  return (
    <div className="fixed inset-0 z-[80] bg-white overflow-auto" onClick={(e) => e.stopPropagation()}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
        <h2 className="text-lg font-black">고객 링크 품목 관리</h2>
        <Button variant="ghost" type="button" onClick={onClose} className="p-2" aria-label="닫기"><X className="w-5 h-5" /></Button>
      </div>
      <div className="p-4 space-y-3 pb-24">
        <p className="text-sm text-[#6B7280]">카드를 길게 누른 채 위아래로 끌면 순서가 바뀝니다. 고객 사전정보 링크에 보일 큰 가구·가전입니다. 새로 추가한 품목은 그림과 함께 영구 저장되어 고객 링크에 나타납니다.</p>
        <Button variant="ghost" type="button" onClick={() => setAdding(true)} className="w-full inline-flex items-center justify-center gap-1 rounded-xl bg-[#2563EB] py-3 font-black text-white">
          <Plus className="w-4 h-4" /> 새 품목 추가
        </Button>
        {err && <div className="text-sm font-bold text-[#B91C1C]">{err}</div>}
        {!items && !err && <div className="py-10 text-center text-[#6B7280]">불러오는 중…</div>}
        {items?.map((it) => (
          <div key={it.id} data-intake-item={it.id}
            onPointerDown={(e) => onDown(e, it)} onPointerMove={onMove} onPointerUp={() => void onUp()} onPointerCancel={() => void onUp()}
            onContextMenu={(e) => e.preventDefault()}
            className={`select-none rounded-2xl border p-3 space-y-2 transition ${dragId === it.id ? "scale-[1.02] border-[#2563EB] bg-[#EFF6FF] shadow-lg" : it.visible ? "border-[#E5E7EB]" : "border-dashed border-[#D1D5DB] opacity-70"}`}>
            <div className="flex items-center gap-3">
              <GripVertical className="h-5 w-5 shrink-0 text-[#9CA3AF]" aria-hidden />
              <Icon3D key={it.icon} src={it.icon ?? icon3dFor(it.id, it.name)} alt={it.name} size={48} />
              <input defaultValue={it.name} aria-label={`${it.name} 이름`}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== it.name) void save(it, { name: v }); }}
                className="min-w-0 flex-1 rounded-lg border border-[#E5E7EB] px-2 py-2 font-bold disabled:bg-[#F7F8F5]" />
              <Button variant="ghost" type="button" onClick={() => void remove(it)} className="rounded-lg bg-[#FEE2E2] p-2 text-[#B91C1C]" aria-label={`${it.name} 삭제`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <select aria-label={`${it.name} 분류`} value={it.group} onChange={e => void save(it, {group:e.target.value as "가구"|"가전"|"주방"})} className="rounded-lg border px-2 py-2"><option>가구</option><option>가전</option><option>주방</option></select>
              <input aria-label={`${it.name} 크기`} defaultValue={it.size ?? ""} placeholder="크기 (예: 50~59인치)" onBlur={e => void save(it,{size:e.target.value})} className="min-w-0 flex-1 rounded-lg border px-2 py-2" />
            </div>
            <label className="block text-sm font-bold">그림 변경<input type="file" accept="image/*" className="mt-1 block w-full" onChange={async e => {
              const file=e.target.files?.[0];if(!file) return;
              try {const photo=await toJpeg(file);const r=await saveIntakeItemSetting({data:{id:it.id,kind:it.kind,visible:it.visible,disposalAllowed:it.disposalAllowed,rooms:it.rooms as (typeof INTAKE_ROOMS)[number][],sort:it.sort,photo}});if(!r.ok)toast.error(r.error);else await load();} catch(e){toast.error(e instanceof Error?e.message:"저장하지 못했습니다.");}
            }} /></label>
            <div className="flex flex-wrap gap-1">
              {INTAKE_ROOMS.map((room) => {
                const on = it.rooms.includes(room);
                return (
                  <Button variant="ghost" key={room} type="button" onClick={() => void save(it, { rooms: on ? it.rooms.filter((x) => x !== room) : [...it.rooms, room] })}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${on ? "bg-[#2563EB] text-white" : "bg-[#EEF1F5] text-[#6B7280]"}`}>{room}</Button>
                );
              })}
            </div>
            <div className="flex gap-4 text-sm font-bold">
              <label className="flex items-center gap-1"><input type="checkbox" checked={it.visible} onChange={(e) => void save(it, { visible: e.target.checked })} /> 고객 링크 표시</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={it.disposalAllowed} onChange={(e) => void save(it, { disposalAllowed: e.target.checked })} /> 폐기물 선택 가능</label>
            </div>
          </div>
        ))}
      </div>
      {adding && <AddIntakeItem onClose={() => setAdding(false)} onDone={() => { setAdding(false); void load(); }} sortBase={(items?.length ?? 0) * 10} />}
    </div>
  );
}

/** 사진을 JPEG(최대 640px)로 줄여 서버로 보냅니다 — 서버가 Storage에 영구 저장합니다 */
async function toJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const s = Math.min(1, 640 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    const g = c.getContext("2d");
    if (!g) throw new Error("그림을 준비하지 못했습니다.");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}

function AddIntakeItem({ onClose, onDone, sortBase }: { onClose: () => void; onDone: () => void; sortBase: number }) {
  const [name, setName] = useState("");
  const [cat, setCat] = useState<"가구" | "가전" | "주방">("가구");
  const [rooms, setRooms] = useState<string[]>(["거실"]);
  const [disposal, setDisposal] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [size, setSize] = useState("");
  const submit = async () => {
    setErr(null);
    if (name.trim().length < 2) return setErr("품목 이름을 2글자 이상 입력해 주세요.");
    if (!photo) return setErr("그림(사진)을 골라 주세요.");
    setBusy(true);
    try {
      const r = await createCustomerIntakeItem({data:{name:name.trim(),cat,size,rooms:rooms as (typeof INTAKE_ROOMS)[number][],disposal,sort:sortBase,photo}});
      if (!r.ok) { setErr(r.error ?? "저장하지 못했습니다."); return; }
      toast.success("고객 품목과 그림을 저장했습니다.");
      onDone();
    } catch(e) { setErr(e instanceof Error ? e.message : "저장하지 못했습니다."); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black">새 품목 추가</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="품목 이름 (예: 원목 수납장)"
          className="w-full rounded-xl border border-[#E5E7EB] px-3 py-3" />
        <div className="flex gap-2">
          {(["가구", "가전", "주방"] as const).map((c) => (
            <Button variant="ghost" key={c} type="button" onClick={() => setCat(c)} className={`flex-1 rounded-xl py-2 font-bold ${cat === c ? "bg-[#2563EB] text-white" : "bg-[#EEF1F5]"}`}>{c}</Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {INTAKE_ROOMS.map((room) => (
            <Button variant="ghost" key={room} type="button" onClick={() => setRooms((l) => l.includes(room) ? l.filter((x) => x !== room) : [...l, room])}
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${rooms.includes(room) ? "bg-[#2563EB] text-white" : "bg-[#EEF1F5] text-[#6B7280]"}`}>{room}</Button>
          ))}
        </div>
        <input aria-label="크기" value={size} onChange={e=>setSize(e.target.value)} placeholder="크기 (예: 퀸, 50~59인치)" className="w-full rounded-xl border px-3 py-3" />
        <label className="flex items-center gap-1 text-sm font-bold"><input type="checkbox" checked={disposal} onChange={(e) => setDisposal(e.target.checked)} /> 폐기물 선택 가능</label>
        <label className="block rounded-xl border border-dashed border-[#D1D5DB] p-3 text-center text-sm font-bold">
          {photo ? <img src={photo} alt="선택한 그림" className="mx-auto h-24 object-contain" /> : "그림 고르기"}
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await toJpeg(f)); }} />
        </label>
        {err && <div className="text-sm font-bold text-[#B91C1C]">{err}</div>}
        <Button variant="ghost" type="button" disabled={busy} onClick={submit} className="w-full rounded-xl bg-[#2563EB] py-3 font-black text-white disabled:opacity-60">{busy ? "저장 중…" : "저장"}</Button>
      </div>
    </div>
  );
}

/** 견적 내역 위쪽 — 고객이 입력을 마친 사전정보 견적 초안 */
export function IntakeSubmittedList() {
  const all = useIntakeRequests();
  useIntakeDraftSync(all);
  const rows = all.filter((r) => r.status === "submitted" || r.status === "confirmed").slice(0, 10);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.id === openId);
  if (!rows.length) return null;
  return (
    <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-3 space-y-2">
      <div className="text-sm font-black text-[#1E3A8A]">고객 사전정보 견적 초안</div>
      {rows.map((r) => (
        <Button variant="ghost" key={r.id} type="button" onClick={() => setOpenId(r.id)} className="w-full flex items-center justify-between rounded-xl bg-white px-3 py-2 text-left">
          <span className="text-sm font-bold">{intakeDisplayName(r)} <span className="text-xs text-[#6B7280]">{r.submission && "moveDate" in r.submission ? r.submission.moveDate : ""}</span></span>
          <IntakeStatusChip row={r} />
        </Button>
      ))}
      {open && <IntakeRequestSheet name={open.customer_name} phone={open.customer_phone} requestId={open.id} onClose={() => setOpenId(null)} />}
    </div>
  );
}
