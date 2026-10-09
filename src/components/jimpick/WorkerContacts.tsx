import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { disableWorkerContact, listWorkerContacts, saveWorkerContact } from "@/lib/worker-contact.functions";
import { maskedWorkerPhone, type WorkerContact } from "@/lib/worker-contact";
import { CHAR_IMG } from "@/lib/jimpick-art";

export function WorkerContacts({ selected, onSelect, onChange, defaultOpen = false }: {
  defaultOpen?: boolean;
  selected?: string[];
  onSelect?: (ids: string[]) => void;
  onChange?: (contacts: WorkerContact[], changed?: WorkerContact) => void;
}) {
  const list = useServerFn(listWorkerContacts);
  const save = useServerFn(saveWorkerContact);
  const [contacts, setContacts] = useState<WorkerContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<WorkerContact | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const [removing, setRemoving] = useState<WorkerContact | null>(null);
  const disable = useServerFn(disableWorkerContact);
  const remove = async () => {
    if (!removing || busy) return;
    setBusy(true); setError("");
    try {
      await disable({ data: { id: removing.id } });
      const rows = contacts.filter((c) => c.id !== removing.id);
      setContacts(rows); onChange?.(rows);
      if (onSelect && selected?.includes(removing.id)) onSelect(selected.filter((id) => id !== removing.id));
      setRemoving(null);
    } catch (e) { setError(e instanceof Error ? e.message : "작업자를 삭제하지 못했습니다."); setRemoving(null); }
    finally { setBusy(false); }
  };
  const load = async () => {
    setLoading(true);
    try { const rows = await list(); setContacts(rows); onChange?.(rows); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const persist = async () => {
    if (!editing || busy) return;
    setBusy(true); setError("");
    try {
      const saved = await save({ data: editing });
      const rows = contacts.some((c) => c.id === saved.id)
        ? contacts.map((c) => c.id === saved.id ? saved : c) : [...contacts, saved];
      setContacts(rows); onChange?.(rows, saved); setEditing(null);
    } catch (e) { setError(e instanceof Error ? e.message : "연락처를 확인해 주세요."); }
    finally { setBusy(false); }
  };
  return <section className="rounded-lg border border-auth-border bg-card text-card-foreground">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-auth-border px-4 py-4">
      <h2 className="text-base font-bold">{onSelect ? "보낼 작업자를 선택하세요" : "작업자 관리"}</h2>
      <div className="flex items-center gap-3">
      {onSelect && open && <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-auth-primary">
        <input type="checkbox" className="h-5 w-5 accent-auth-primary" aria-label="전체 선택"
          checked={contacts.length > 0 && contacts.every((c) => selected?.includes(c.id))}
          disabled={!contacts.length}
          onChange={(e) => onSelect(e.target.checked ? contacts.map((c) => c.id) : [])} />전체 선택
      </label>}
      <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "닫기 ▲" : "열기 ▼"}</Button>
      </div>
    </div>
    {open && <>
    {loading && <p className="px-4 py-5 text-sm text-muted-foreground">작업자 불러오는 중…</p>}
    {!loading && !contacts.length && <p className="px-4 py-5 text-sm text-muted-foreground">등록된 작업자가 없습니다.</p>}
    <div className="divide-y divide-border">
      {contacts.map((c) => <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
        {onSelect && <input type="checkbox" className="h-5 w-5 shrink-0 accent-auth-primary" aria-label={`${c.name} 선택`}
          checked={selected?.includes(c.id) ?? false} onChange={(e) => onSelect(e.target.checked ? [...(selected ?? []), c.id] : (selected ?? []).filter((id) => id !== c.id))} />}
        <img src={c.photo || (c.role.includes("주방") ? CHAR_IMG.female : CHAR_IMG.male)} alt={`${c.name} 사진`} className="h-12 w-12 shrink-0 rounded-full bg-auth-soft object-contain" />
        <div className="min-w-0 flex-1 cursor-pointer" role="button" tabIndex={0} aria-label={`${c.name} 정보 수정`} onClick={() => {setEditing(c); setError("");}} onKeyDown={(e) => {if (e.key === "Enter") {setEditing(c); setError("");}}}>
          <div className="flex flex-wrap items-baseline gap-x-2"><strong className="break-words text-base">{c.name}</strong><span className="break-words text-xs text-muted-foreground">{c.role}</span></div>
          <div className="mt-1 text-sm text-muted-foreground">{maskedWorkerPhone(c.phone)}</div>
        </div>
        <div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" className="text-auth-primary" onClick={() => {setEditing(c); setError("");}}>연락처 수정</Button>
        <Button variant="outline" size="sm" className="text-destructive" onClick={() => setRemoving(c)}>삭제</Button></div>
      </div>)}
    </div>
    <div className="px-4 py-3"><Button variant="ghost" size="sm" className="text-auth-primary" onClick={() => {setEditing({id: crypto.randomUUID(), name: "", role: "일반작업자", phone: "", photo: ""}); setError("");}}><Plus />작업자 추가</Button></div>
    </>}
    {!open && !loading && <p className="px-4 py-3 text-sm text-muted-foreground">작업자 {contacts.length}명{onSelect && selected?.length ? ` · ${contacts.filter((c) => selected.includes(c.id)).length}명 선택` : ""}</p>}
    {error && <div role="alert" className="px-4 pb-4 text-sm text-destructive">{error}{!editing && <Button variant="link" onClick={() => void load()}>다시 불러오기</Button>}</div>}
    {removing && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/40 p-4" role="dialog" aria-modal="true" aria-label="작업자 삭제 확인">
      <div className="w-full max-w-sm space-y-4 rounded-lg bg-card p-5">
        <h3 className="font-bold">이 작업자를 삭제하시겠습니까?</h3>
        <p className="text-sm text-muted-foreground">{removing.name} · 과거 계약과 작업지시서 기록은 그대로 보존되고, 작업자는 사용 중지됩니다.</p>
        <div className="flex gap-2"><Button variant="outline" className="h-12 flex-1" disabled={busy} onClick={() => setRemoving(null)}>취소</Button><Button variant="destructive" className="h-12 flex-1" disabled={busy} onClick={() => void remove()}>{busy ? "삭제 중…" : "삭제"}</Button></div>
      </div>
    </div>}
    {editing && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/40 p-4" role="dialog" aria-modal="true" aria-label="작업자 연락처 수정">
      <form onSubmit={(e) => {e.preventDefault(); void persist();}} className="w-full max-w-sm space-y-4 rounded-lg bg-card p-5">
        <div className="flex items-center justify-between"><h3 className="font-bold"><User className="mr-2 inline h-4 w-4" />작업자 연락처</h3><Button type="button" variant="ghost" size="icon" aria-label="연락처 수정 닫기" disabled={busy} onClick={() => setEditing(null)}><X /></Button></div>
        <label className="block text-sm font-semibold">이름<input required value={editing.name} onChange={(e) => setEditing({...editing, name: e.target.value})} className="mt-1 w-full rounded-md border border-input bg-background p-3" /></label>
        <label className="block text-sm font-semibold">역할<select value={editing.role} onChange={(e) => setEditing({...editing, role: e.target.value})} className="mt-1 w-full rounded-md border border-input bg-background p-3">{[...new Set([editing.role, "현장팀장", "일반작업자", "주방작업자"])].map((role) => <option key={role}>{role}</option>)}</select></label>
        <label className="block text-sm font-semibold">전화번호<input required type="tel" value={editing.phone} onChange={(e) => setEditing({...editing, phone: e.target.value})} className="mt-1 w-full rounded-md border border-input bg-background p-3" /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" variant="staff" className="h-12 w-full" disabled={busy}>{busy ? "저장 중…" : "저장"}</Button>
      </form>
    </div>}
  </section>;
}