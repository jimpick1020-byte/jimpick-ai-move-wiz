/**
 * 고객 전용 사전정보 입력 화면 (로그인 없음, 관리자 메뉴 없음).
 * 짐픽과 같은 1~4단계: 기본정보 → 주소·층수 → 이사 조건·공간 → 방별 품목 → 확인·동의 → 제출.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Step1, Step2, Step3, Step6 } from "./screens";
import { MobileShell, TopBar, BottomButtonBar, PrimaryButton } from "./ui";
import { CustomerFlowProvider, ITEM_CATALOG, type Estimate, type Screen } from "@/lib/jimpick";
import { InAppBrowserNotice, useForceLightPage } from "./InAppBrowserNotice";
import { intakeToEstimate, estimateToIntake } from "@/lib/intake-estimate-adapter";
import { registerCustomIcons } from "@/lib/jimpick-icon3d";
import { openIntake, saveIntakeProgress, submitIntake, type IntakeOpen } from "@/lib/intake.functions";
import { setQty, type IntakeForm } from "@/lib/intake";

const DONE = "입력이 완료되었습니다.";
const CLOSED = "사전정보 입력이 마감되었습니다. 변경사항은 방문 시 담당자에게 말씀해 주세요.";

type Item = NonNullable<IntakeOpen["items"]>[number];

export function IntakePage({ token }: { token: string }) {
  useForceLightPage();
  const [data, setData] = useState<IntakeOpen | null>(null);
  const [form, setForm] = useState<IntakeForm | null>(null);
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [closed, setClosed] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [returnReady, setReturnReady] = useState(false);
  const returnAttempt = useRef(false);

  // Renew private image links before expiry without replacing the customer's unsaved form.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible" || done || closed) return;
      openIntake({ data: { token } }).then(r => { if (r.ok) setData(r); }).catch(() => {});
    };
    const id = window.setInterval(refresh, 10 * 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", refresh); };
  }, [token, done, closed]);

  useEffect(() => {
    openIntake({ data: { token } })
      .then((r) => {
        setData(r);
        if (r.ok && r.state === "closed") setClosed(true);
        if (r.form) setForm(r.form);
      })
      .catch(() => setData({ ok: false, error: "잠시 후 다시 열어 주세요." }));
  }, [token]);

  // 입력할 때마다 잠시 뒤 서버에 임시 저장 (단계를 옮기거나 다시 열어도 그대로)
  const timer = useRef<number | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (!form || closed || done || busy) return;
    if (first.current) { first.current = false; return; }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void saveIntakeProgress({ data: { token, form } }).then((r) => { if (r.closed) setClosed(true); else if (!r.ok) setErr(r.error || "임시 저장하지 못했습니다."); }).catch(() => setErr("임시 저장하지 못했습니다."));
    }, 800);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [form, token, closed, done, busy]);

  useEffect(() => {
    if (!done || returnAttempt.current) return;
    const h = window.setTimeout(() => {
      returnAttempt.current = true;
      // A fresh browser tab may have only its initial blank entry, not the SMS app.
      // Keep an in-document return target in that case so the fallback is not unloaded.
      const navigation = (window as Window & { navigation?: { canGoBack: boolean } }).navigation;
      if (navigation?.canGoBack === false || window.history.length <= 1) {
        window.history.pushState(window.history.state, "", window.location.href);
      }
      window.history.back();
      window.setTimeout(() => setReturnReady(true), 800);
    }, 1500);
    return () => window.clearTimeout(h);
  }, [done]);

  if (!data) return <Shell><div className="py-24 text-center text-xl">불러오는 중…</div></Shell>;
  if (!data.ok) return <Shell><Message text={data.error ?? "링크를 열 수 없습니다."} /></Shell>;
  if (closed) return <Shell company={data.companyName}><Message text={CLOSED} sub={`문의: ${data.contact}`} /></Shell>;
  if (done) return (
    <Shell company={data.companyName}>
      <Message text={DONE} sub={`문의: ${data.contact}`} />
      {returnReady && <div className="mx-5 space-y-3">
        <Button asChild className="w-full h-auto py-4 text-lg font-bold bg-auth-primary text-auth-primary-foreground"><a href="sms:">문자 화면으로 돌아가기</a></Button>
        <Button variant="secondary" onClick={() => { setDone(false); setReturnReady(false); returnAttempt.current=false; setStep(1); }} className="w-full h-auto py-4 text-lg font-bold">입력 내용 수정하기</Button>
      </div>}
    </Shell>
  );
  if (!form) return null;

  return <>
    <InAppBrowserNotice />
    <IntakeEstimateFlow token={token} form={form} setForm={setForm} data={data} step={step} setStep={setStep}
      consent={consent} setConsent={setConsent} busy={busy} setBusy={setBusy} err={err} setErr={setErr}
      onDone={() => setDone(true)} onClosed={() => setClosed(true)} />
  </>;
}

function Shell({ children }: { children: React.ReactNode; company?: string }) {
  return <MobileShell className="jp-estimate-flow jp-tone-1">{children}</MobileShell>;
}
function Message({ text, sub }: { text: string; sub?: string }) {
  return <div className="px-6 py-20 text-center"><p className="text-xl font-bold">{text}</p>{sub && <p className="mt-4 text-muted-foreground">{sub}</p>}</div>;
}

function IntakeEstimateFlow({ token, form, setForm, data, step, setStep, consent, setConsent, busy, setBusy, err, setErr, onDone, onClosed }: {
  token: string; form: IntakeForm; setForm: React.Dispatch<React.SetStateAction<IntakeForm | null>>;
  data: IntakeOpen; step: number; setStep: (n: number) => void; consent: boolean; setConsent: (v: boolean) => void;
  busy: boolean; setBusy: (v: boolean) => void; err: string | null; setErr: (v: string | null) => void;
  onDone: () => void; onClosed: () => void;
}) {
  const draft = useMemo(() => intakeToEstimate(form), [form]);
  const latest = useRef(form); latest.current = form;
  useEffect(() => { registerCustomIcons((data.items ?? []).filter(i => i.icon).map(i => ({ id: i.id, icon: i.icon }))); }, [data.items]);
  const update = (patch: Partial<Estimate>) => setForm(current => current ? estimateToIntake({ ...intakeToEstimate(current), ...patch }, current) : current);
  const persist = async (next: Estimate) => {
    const nextForm = estimateToIntake(next, latest.current);
    const r = await saveIntakeProgress({ data: { token, form: nextForm } });
    if (!r.ok) throw new Error(r.error || "저장하지 못했습니다. 다시 시도해 주세요.");
  };
  const navigate = (screen: Screen) => {
    if (screen === "home") { window.history.back(); return; }
    const n = screen === "step1" ? 1 : screen === "step2" ? 2 : screen === "step3" ? 3 : screen === "scan" || screen === "step6" ? 4 : 5;
    setStep(n); window.scrollTo(0, 0);
  };
  const submit = async () => {
    if (!consent) { setErr("개인정보 수집·이용에 동의해 주세요."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await submitIntake({ data: { token, form: latest.current, consent: true } });
      if (r.ok) onDone(); else if (r.closed) onClosed(); else setErr(r.error || "저장하지 못했습니다.");
    } catch (e) { setErr(e instanceof Error ? e.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  };
  const flow = { persist, hidden: data.hiddenIds ?? [], catalog: (data.items ?? []).map(i => ({ id: i.id, name: i.name, cat: i.group, cat5: i.group, sub: i.family || i.name, group: i.family, emoji: "", extra: 0 })) };
  return <CustomerFlowProvider draft={draft} updateDraft={update} setScreen={navigate} flow={flow}>
    {step === 1 ? <Step1 /> : step === 2 ? <Step2 /> : step === 3 ? <Step3 /> : step === 4 ? <Step6 /> :
      <MobileShell className="jp-estimate-flow jp-tone-4">
        <TopBar title="입력 내용 확인" onBack={() => setStep(4)} />
        <div className="p-5 space-y-4 flex-1 overflow-auto pb-24">
          <Review form={form} items={data.items ?? []} consent={consent} setConsent={setConsent} setForm={setForm} />
          {err && <p role="alert" className="text-destructive font-bold">{err}</p>}
        </div>
        <BottomButtonBar><PrimaryButton disabled={busy} onClick={submit}>{busy ? "저장 중…" : err ? "다시 저장" : "기본정보 입력 완료"}</PrimaryButton></BottomButtonBar>
      </MobileShell>}
  </CustomerFlowProvider>;
}

function Review({ form, items, consent, setConsent, setForm }: { form: IntakeForm; items: Item[]; consent: boolean; setConsent: (v: boolean) => void; setForm: React.Dispatch<React.SetStateAction<IntakeForm | null>> }) {
  const drop = (room: string, id: string) => setForm((s) => (s ? { ...s, rooms: { ...s.rooms, [room]: setQty(s.rooms[room] ?? {}, id, 0) } } : s));
  const nameOf = (id: string) => ITEM_CATALOG.find((i) => i.id === id)?.name ?? items.find((i) => i.id === id)?.name ?? "품목";
  return (
    <div className="space-y-4 text-base">
      <h2 className="text-xl font-black">입력 내용 확인</h2>
      <div className="rounded-2xl bg-auth-soft p-4 space-y-1">
        <div><b>{form.customerName}</b> · {form.phone}</div>
        <div>이사 날짜: {form.moveDate || "아직 미정"} {form.moveTime}</div>
        <div>나가는 곳: {form.fromAddress || "-"} {form.fromDetail}</div>
        <div>들어가는 곳: {form.toAddress || "-"} {form.toDetail}</div>
      </div>
      <div className="rounded-2xl bg-auth-soft p-4 space-y-1">
        {Object.entries(form.rooms).filter(([, p]) => Object.keys(p).length).map(([room, picks]) => (
          <div key={room}>
            <b>{room}</b>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(picks).map(([id, p]) => (
                <span key={id} className={`inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-sm font-bold ${p.disposal ? "bg-destructive/10 text-destructive" : "bg-card"}`}>
                  {nameOf(id)}{p.disposal ? "(버림)" : ""} {p.qty}
                  <Button variant="ghost" type="button" onClick={() => drop(room, id)} className="rounded-full p-1" aria-label={`${nameOf(id)} 삭제`}><X className="h-4 w-4" /></Button>
                </span>
              ))}
            </div>
          </div>
        ))}
        <div className="pt-1 text-sm text-muted-foreground">{form.fromSize ? `출발지 평수: ${form.fromSize} · ` : ""}수량을 바꾸려면 「이전」을 눌러 주세요.</div>
        {!Object.values(form.rooms).some((p) => Object.keys(p).length) && <div className="text-muted-foreground">선택한 가구·가전이 없습니다. 방문 시 확인해 드립니다.</div>}
      </div>
      <div className="rounded-2xl border p-4 text-sm leading-relaxed text-muted-foreground">
        <b className="text-base text-foreground">개인정보 수집·이용 동의</b><br />
        수집 항목: 이름, 휴대전화 번호, 이사 날짜·시간, 주소, 이삿짐 정보<br />
        이용 목적: 방문견적 안내와 이사 견적 작성<br />
        보유 기간: 견적·계약 업무 종료 시까지(관련 법령에 따른 보관 기간은 예외)<br />
        동의하지 않으셔도 되며, 이 경우 전화로 안내해 드립니다.
      </div>
      <label className="flex items-center gap-3 rounded-2xl bg-auth-soft p-4 text-lg font-bold">
        <input type="checkbox" className="h-6 w-6" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> 개인정보 수집·이용에 동의합니다
      </label>
    </div>
  );
}
