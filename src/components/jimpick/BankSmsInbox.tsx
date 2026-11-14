/**
 * 「입금 문자」 화면 — 받은 은행 입금 문자와 연결된 견적을 보여 줍니다.
 * 문자는 매칭 성공 여부와 관계없이 모두 남습니다. 결제완료는 견적 내역에서 사장님이 직접 확인합니다.
 */
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { groupBankSmsMonths, bankSmsMonthIsOpen } from "@/lib/bank-sms-months";
import { bankSmsForwardUrl } from "@/lib/bank-sms-match";
import { PAYMENT_REVIEW_BORDER } from "@/lib/payment-review";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/jimpick";
import { MobileShell, TopBar, Card } from "./ui";
import {
  listBankSms, linkBankSms, ignoreBankSms, deleteBankSms, createBankSmsToken, getBankSmsTokenStatus, submitBankSms,
  type BankSmsRow,
} from "@/lib/bank-sms.functions";

const won = (n: number) => `${Number(n || 0).toLocaleString("ko-KR")}원`;
const kindLabel = (k: string | null) => (k === "balance" ? "잔금 입금" : k === "deposit" ? "예약금 입금" : "");

function statusText(r: BankSmsRow) {
  if (r.matchStatus === "matched") {
    const done = r.receiptStatus === "confirmed";
    return { text: `${kindLabel(r.paymentKind)} · ${r.matchedCustomerName ?? "견적"} 연결${done ? " · 확인 완료" : " · 확인 대기"}`, cls: r.paymentKind === "balance" ? "text-[#1D4ED8]" : "text-[#B45309]" };
  }
  if (r.matchStatus === "review") return { text: "확인 필요", cls: "text-[#D95C5C]" };
  if (r.matchStatus === "ignored") return { text: "제외", cls: "text-muted-foreground" };
  return { text: "연결할 견적 없음", cls: "text-muted-foreground" };
}

export function BankSmsScreen() {
  const { setScreen } = useApp();
  const list = useServerFn(listBankSms);
  const link = useServerFn(linkBankSms);
  const ignore = useServerFn(ignoreBankSms);
  const remove = useServerFn(deleteBankSms);
  const [deleteTarget, setDeleteTarget] = useState<BankSmsRow | null>(null);
  const makeToken = useServerFn(createBankSmsToken);
  const tokenStatus = useServerFn(getBankSmsTokenStatus);
  const submit = useServerFn(submitBankSms);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerNotice, setRegisterNotice] = useState("");
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [rows, setRows] = useState<BankSmsRow[]>([]);
  const [openEstimates, setOpenEstimates] = useState<Array<{ estimateId: string; customerName: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [token, setToken] = useState<{ exists: boolean; lastReceivedAt: string | null } | null>(null);
  const [newUrl, setNewUrl] = useState("");

  const load = () => list().then((r) => { setRows(r.rows); setOpenEstimates(r.openEstimates); setLoaded(true); }).catch(() => { setLoaded(true); toast.error("입금 문자를 불러오지 못했습니다"); });
  const refresh = async () => {
    await Promise.all([load(), tokenStatus().then(setToken).catch(() => toast.error("마지막 수신 시각을 불러오지 못했습니다"))]);
  };
  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guard = async (key: string, fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(key);
    try { await fn(); } finally { lock.current = false; setBusy(null); }
  };

  const doLink = (id: string) => guard(id, async () => {
    const estimateId = pick[id];
    if (!estimateId) { toast.error("연결할 견적을 골라 주세요"); return; }
    try {
      const r = await link({ data: { id, estimateId } });
      if (!r.ok) toast.error("연결 실패", { description: r.error });
      else { toast.success("견적에 연결했습니다. 견적 내역에서 입금을 확인해 주세요."); window.dispatchEvent(new Event("jimpick:payment-updated")); }
    } catch (e) { toast.error("연결 실패", { description: e instanceof Error ? e.message : "" }); }
    finally { void load(); }
  });

  const doIgnore = (id: string) => guard(id, async () => {
    try { await ignore({ data: { id } }); } finally { void load(); }
  });

  const goHistory = (estimateId: string) => {
    try { sessionStorage.setItem("jp_waiting_history_target", estimateId); } catch { /* 저장소 제한 */ }
    setScreen("history");
  };

  const doDelete = () => {
    const target = deleteTarget; if (!target) return;
    return guard(`delete-${target.id}`, async () => {
      try {
        const result = await remove({ data: { id: target.id } });
        if (!result.ok) { toast.error(result.error ?? "삭제하지 못했습니다"); return; }
        setRows((prev) => prev.filter((row) => row.id !== target.id));
        setDeleteTarget(null);
        await load();
        toast.success("받은 문자 목록에서 삭제했습니다");
      } catch { toast.error("삭제하지 못했습니다. 다시 시도해 주세요."); }
    });
  };

  const doToken = () => guard("token", async () => {
    try {
      const r = await makeToken();
      if (!r.ok || !r.token) { toast.error(r.error ?? "주소를 만들지 못했습니다"); return; }
      // 미리보기 주소는 외부 요청을 앱에 전달하지 않으므로(Unauthorized) 항상 운영 주소로 만듭니다.
      setNewUrl(bankSmsForwardUrl(r.token));
      setToken({ exists: true, lastReceivedAt: null });
    } catch { toast.error("주소를 만들지 못했습니다"); }
  });

  const doRegister = () => {
    if (lock.current) return;
    const text = rawText.trim();
    setRegisterNotice("");
    if (!text || text.length > 2000) {
      setRegisterError(!text ? "은행 입금 알림 원문을 입력해 주세요." : "은행 입금 알림 원문은 2,000자 이내로 입력해 주세요.");
      return;
    }
    setRegisterError("");
    void guard("register", async () => {
      try {
        const result = await submit({ data: { text } });
        if (!result.ok) { setRegisterError(result.error ?? "문자를 등록하지 못했습니다. 다시 시도해 주세요."); return; }
        setRawText("");
        setRegisterNotice(result.duplicated ? "이미 등록한 문자입니다. 기존 기록을 확인해 주세요." : result.matchStatus === "matched" ? "문자를 등록했습니다. 견적 내역에서 실제 입금을 확인해 주세요." : "문자를 등록했습니다. 받은 문자 목록에서 연결 상태를 확인해 주세요.");
        await refresh();
        window.dispatchEvent(new Event("jimpick:payment-updated"));
      } catch { setRegisterError("문자를 등록하지 못했습니다. 입력 내용을 유지했습니다. 다시 시도해 주세요."); }
    });
  };

  const months = groupBankSmsMonths(rows);
  return (
    <MobileShell>
      <TopBar title="입금 문자" onBack={() => setScreen("settings")} />
      <div className="flex-1 space-y-3 overflow-auto p-4 pb-24">
        <Card>
          <div className="text-[15px] font-bold">자동 전달 (안드로이드)</div>
          <p className="mt-1 text-[13px] text-muted-foreground">문자 전달 앱에서 은행 문자를 아래 주소로 보내도록 설정하면 자동으로 들어옵니다.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">은행 알림이 휴대폰에만 도착하면 견적잇에는 표시되지 않습니다. 문자 전달 앱의 전송 설정을 확인해 주세요.</p>
          <p className="mt-1 text-[12px] text-muted-foreground">마지막 자동 수신 (한국시간): {token?.lastReceivedAt ? new Date(token.lastReceivedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : token ? "수신 기록 없음" : "조회 중"}</p>
          {newUrl && <div className="mt-2 break-all rounded-md bg-muted p-2 text-[12px]">{newUrl}</div>}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={busy !== null || token === null} onClick={() => { if (token?.exists) setReplaceOpen(true); else void doToken(); }}>{token?.exists ? "주소 새로 만들기" : "주소 만들기"}</Button>
            <Button variant="outline" disabled={!newUrl} onClick={() => { void navigator.clipboard?.writeText(newUrl).then(() => toast.success("주소를 복사했습니다")); }}>주소 복사</Button>
          </div>
          {token?.exists && !newUrl && <p className="mt-1 text-[12px] text-muted-foreground">주소는 만들 때 한 번만 보입니다. 새로 만들면 이전 주소는 더 이상 쓰이지 않습니다.</p>}
        </Card>

        <section className="border-y border-border py-2">
          <Button variant="ghost" className="w-full justify-between" aria-expanded={registerOpen} aria-controls="bank-sms-register" onClick={() => setRegisterOpen((open) => !open)}><span>입금 문자 직접 등록</span>{registerOpen ? <ChevronUp /> : <ChevronDown />}</Button>
          {registerOpen && <div id="bank-sms-register" className="space-y-2 px-1 py-2">
            <label htmlFor="bank-sms-original" className="text-sm font-bold">은행 입금 알림 원문</label>
            <textarea id="bank-sms-original" rows={5} maxLength={2000} value={rawText} disabled={busy === "register"} onChange={(event) => { setRawText(event.target.value); setRegisterError(""); setRegisterNotice(""); }} className="w-full rounded-md border border-input bg-background p-3 text-sm text-foreground" />
            <p className="text-xs text-muted-foreground">송금 화면이 아닌 은행 입금 알림 원문을 붙여넣어 주세요. 등록만으로 입금 확인이나 결제완료가 처리되지 않습니다.</p>
            {registerError && <p role="alert" className="text-sm text-destructive">{registerError}</p>}
            {registerNotice && <p role="status" className="text-sm text-foreground">{registerNotice}</p>}
            <Button variant="outline" className="w-full" disabled={busy !== null} onClick={doRegister}>{busy === "register" ? "등록 중…" : "등록"}</Button>
          </div>}
        </section>
        <Button variant="ghost" disabled={busy !== null} onClick={() => void guard("refresh", refresh)}>새로고침</Button>

        <div className="text-[14px] font-bold">받은 문자 {rows.length}건</div>
        {loaded && rows.length === 0 && <div className="py-8 text-center text-[13px] text-muted-foreground">받은 입금 문자가 없습니다.</div>}
        {months.map((month) => {
          const isOpen = bankSmsMonthIsOpen(month.key, months[0]?.key, openMonths);
          return <section key={month.key} className="space-y-3">
            <Button variant="ghost" className="h-auto w-full justify-between px-1 py-3 text-[14px] font-bold" aria-expanded={isOpen} aria-controls={`sms-month-${month.key}`} onClick={() => setOpenMonths((prev) => ({ ...prev, [month.key]: !isOpen }))}>
              <span>{month.year}년 {month.month}월 · {month.rows.length}건</span>
              {isOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            </Button>
            {isOpen && <div id={`sms-month-${month.key}`} className="space-y-3">{month.rows.map((r) => {
          const st = statusText(r);
          const choices = r.candidates.length ? r.candidates : openEstimates;
          const pendingBorder = r.matchStatus === "matched" && r.receiptStatus === "pending_review" ? PAYMENT_REVIEW_BORDER[r.paymentKind === "balance" ? "balance" : "deposit"] : undefined;
          return (
            <Card key={r.id} borderOverride={pendingBorder} data-bank-sms-status={r.matchStatus} data-bank-sms-kind={r.paymentKind ?? ""}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-[14px] font-bold">{r.depositorName || "이름 미확인"} · {won(r.amount)}</div>
                <div className={`shrink-0 text-[12.5px] font-bold ${st.cls}`}>{st.text}</div>
              </div>
               <div className="mt-0.5 text-[12px] text-muted-foreground">{new Date(r.receivedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · {r.channel === "forward" ? "자동 전달" : "직접 등록"}{r.bank ? ` · ${r.bank}` : ""}</div>
              <div className="mt-1.5 whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-[12px]">{r.rawText}</div>
              {r.matchNote && <div className="mt-1 text-[12px] text-muted-foreground">{r.matchNote}</div>}
              <div className="flex justify-end"><Button variant="ghost" size="icon" title="문자 삭제" aria-label={`${r.depositorName || "이름 미확인"} ${won(r.amount)} 문자 삭제`} disabled={busy !== null} onClick={() => setDeleteTarget(r)} className="text-destructive"><Trash2 className="size-4" /></Button></div>
              {r.matchStatus === "matched" && r.matchedEstimateId && (
                 <Button variant="outline" className="mt-2 w-full" onClick={() => { if (r.matchedEstimateId) goHistory(r.matchedEstimateId); }}>견적 내역에서 확인</Button>
              )}
              {(r.matchStatus === "review" || r.matchStatus === "unmatched") && r.amount > 0 && (
                <div className="mt-2 space-y-2">
                  <select aria-label="연결할 견적" value={pick[r.id] ?? ""} onChange={(e) => setPick((p) => ({ ...p, [r.id]: e.target.value }))} className="w-full rounded-md border border-input bg-background p-2 text-sm">
                    <option value="">연결할 견적 선택</option>
                    {choices.map((c) => <option key={c.estimateId} value={c.estimateId}>{c.customerName || "이름 없음"} ({c.estimateId.slice(-6)})</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="staff" disabled={busy !== null || !pick[r.id]} onClick={() => void doLink(r.id)}>{busy === r.id ? "처리 중…" : "이 견적에 연결"}</Button>
                    <Button variant="outline" disabled={busy !== null} onClick={() => void doIgnore(r.id)}>제외</Button>
                  </div>
                </div>
              )}
            </Card>
          );
            })}</div>}
          </section>;
        })}
      </div>
      <AlertDialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>전달 주소를 새로 만들까요?</AlertDialogTitle><AlertDialogDescription>기존 주소는 더 이상 사용할 수 없습니다. 새 주소를 문자 전달 앱에 다시 설정해야 합니다.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={() => { setReplaceOpen(false); void doToken(); }}>새로 만들기</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && busy === null) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>받은 문자를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.depositorName || "이름 미확인"} · {won(deleteTarget?.amount ?? 0)}<br />문자 목록에서만 제거됩니다. 연결된 견적과 입금 기록, 입금 확인 상태는 그대로 유지됩니다.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={busy !== null}>취소</AlertDialogCancel><AlertDialogAction disabled={busy !== null} onClick={(event) => { event.preventDefault(); void doDelete(); }}>{busy ? "삭제 중…" : "삭제"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MobileShell>
  );
}
