import { useEffect, useState } from "react";
import { formatTel } from "@/lib/format-input";
import { Calendar, ChevronLeft, MessageSquare, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkerContacts } from "./WorkerContacts";
import { selectedWorkerContacts, type WorkerContact } from "@/lib/worker-contact";

export function StaffSendScreen({ date, customer, from, to, selected, onSelect, onContacts, onClose, prepare, busy, ready, error, onKakao, onSms }: {
  date: string; customer: string; from: string; to: string;
  selected: string[]; onSelect: (ids: string[]) => void;
  onContacts: (contacts: WorkerContact[], changed?: WorkerContact) => void;
  onClose: () => void; prepare: () => Promise<void>; busy: boolean; ready: boolean; error: string | null;
  onKakao: () => Promise<void>; onSms: (contacts: WorkerContact[]) => void;
}) {
  const [contacts, setContacts] = useState<WorkerContact[]>([]);
  const [confirm, setConfirm] = useState<"sms" | "kakao" | null>(null);
  const recipients = selectedWorkerContacts(contacts, selected);
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {document.body.style.overflow = old;};
  }, []);
  const request = (method: "sms" | "kakao") => { setConfirm(method); void prepare(); };
  return <div className="fixed inset-0 z-[60] flex h-dvh flex-col bg-auth-canvas text-auth-text" role="dialog" aria-modal="true" aria-label="작업지시서 보내기">
    <header className="shrink-0 border-b border-auth-border bg-card">
      <div className="mx-auto grid max-w-2xl grid-cols-[36px_1fr_36px] items-center gap-2 px-4 py-3"><Button variant="ghost" size="icon" aria-label="작업지시서 보내기 닫기" disabled={busy} onClick={onClose}><ChevronLeft /></Button><h1 className="text-center text-lg font-bold">작업지시서 보내기</h1></div>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-2xl space-y-4 p-4 pb-8">
        <section className="rounded-lg border border-auth-border bg-card p-5">
          <div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-auth-soft text-auth-primary"><Calendar className="h-7 w-7" /></div><div className="min-w-0"><div className="break-words text-lg font-bold">{date}</div><h2 className="mt-2 break-words text-lg">{customer || "이름 미입력"} 고객님</h2></div></div>
          <div className="mt-4 space-y-2 border-t border-auth-border pt-4 text-sm"><p className="break-words"><span className="mr-3 text-muted-foreground">출발</span>{from || "미정"}</p><p className="break-words"><span className="mr-3 text-muted-foreground">도착</span>{to || "미정"}</p></div>
        </section>
        <WorkerContacts defaultOpen selected={selected} onSelect={onSelect} onChange={(rows, changed) => {setContacts(rows); onContacts(rows, changed);}} />
        {recipients.length > 0 && <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="staff" className="h-auto min-h-14 whitespace-normal px-4 py-4 text-base font-bold" disabled={!recipients.length || busy} onClick={() => request("sms")}><Smartphone />휴대폰 문자로 보내기</Button>
          <Button variant="kakao" className="h-auto min-h-14 whitespace-normal px-4 py-4 text-base font-bold" disabled={!recipients.length || busy} onClick={() => request("kakao")}><MessageSquare />카카오톡으로 보내기</Button>
        </div>}
      </div>
    </main>
    {confirm && <div className="absolute inset-0 z-10 flex items-center justify-center bg-foreground/40 p-4" role="dialog" aria-modal="true" aria-label="발송 최종 확인">
      <div className="max-h-[85dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-lg bg-card p-5">
        <h2 className="text-lg font-bold">선택한 작업자에게 보낼까요?</h2>
        <ul className="divide-y divide-border rounded-md bg-auth-soft px-3">{recipients.map((c) => <li key={c.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><strong>{c.name}</strong><span>{formatTel(c.phone)}</span></li>)}</ul>
        <p className="text-sm text-muted-foreground">{confirm === "kakao" ? "카카오톡 공유창에서 위 작업자를 직접 선택해 주세요. 공유창이 열린 것만으로 전송이 완료되지 않습니다." : "휴대폰 문자 앱에서 수신번호를 확인한 뒤 직접 보내 주세요."}</p>
        {busy && <p className="text-sm text-muted-foreground">보안 링크 준비 중…</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}<Button variant="link" disabled={busy} onClick={() => void prepare()}>다시 준비하기</Button></p>}
        <div className="flex gap-2"><Button variant="outline" className="h-12 flex-1" disabled={busy} onClick={() => setConfirm(null)}>취소</Button><Button variant={confirm === "sms" ? "staff" : "kakao"} className="h-12 flex-1" disabled={busy || !ready || !recipients.length} onClick={() => { if (confirm === "sms") {onSms(recipients); setConfirm(null);} else {void onKakao();} }}>{confirm === "sms" ? "문자 앱 열기" : "카카오톡 열기"}</Button></div>
      </div>
    </div>}
  </div>;
}