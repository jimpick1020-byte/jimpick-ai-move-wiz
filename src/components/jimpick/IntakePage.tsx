/**
 * 고객 전용 사전정보 입력 화면 (로그인 없음, 관리자 메뉴 없음).
 * 1 기본정보 → 2 주소·층수 → 3 기본 작업정보 → 4 현재 집 평수 → 확인·동의 → 제출. 고객은 품목을 고르지 않습니다.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Step1, Step2, Step3 } from "./screens";
import { CharacterImg } from "./CharacterGuide";
import { StepHero, ResultHero } from "./StepHero";
import { MobileShell, TopBar, BottomButtonBar, PrimaryButton } from "./ui";
import { CustomerFlowProvider, type Estimate, type Screen } from "@/lib/jimpick";
import { InAppBrowserNotice, useForceLightPage } from "./InAppBrowserNotice";
import { intakeToEstimate, estimateToIntake } from "@/lib/intake-estimate-adapter";
import { registerCustomIcons } from "@/lib/jimpick-icon3d";
import { openIntake, saveIntakeProgress, submitIntake, type IntakeOpen } from "@/lib/intake.functions";
import type { IntakeForm } from "@/lib/intake";

const SIZE_CHOICES = ["5평 이하", "5~10평", "10~20평", "20~30평", "30~40평", "40~50평", "50평 이상", "잘 모름"] as const;
const DONE = "입력이 완료되었습니다.";
const CLOSED = "사전정보 입력이 마감되었습니다. 변경사항은 방문 시 담당자에게 말씀해 주세요.";

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

  if (!data) return <Shell><div className="py-24 text-center text-xl">불러오는 중…</div></Shell>;
  if (!data.ok) return <Shell><Message text={data.error ?? "링크를 열 수 없습니다."} /></Shell>;
  if (closed) return <Shell company={data.companyName}><Message text={CLOSED} sub={`문의: ${data.contact}`} /></Shell>;
  if (done) return <div className="jp-intake-done" data-intake-done><CharacterImg pose="thumbsup" size={140} priority className="mx-auto mb-4" /><p className="text-2xl font-black">{DONE}</p></div>;
  if (!form) return null;

  return <div className="jp-customer-flow">
    <InAppBrowserNotice />
    <IntakeEstimateFlow token={token} form={form} setForm={setForm} data={data} step={step} setStep={setStep}
      consent={consent} setConsent={setConsent} busy={busy} setBusy={setBusy} err={err} setErr={setErr}
      onDone={() => setDone(true)} onClosed={() => setClosed(true)} />
  </div>;
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
    {step === 1 ? <Step1 /> : step === 2 ? <Step2 /> : step === 3 ? <Step3 /> : step === 4 ?
      <MobileShell className="jp-estimate-flow jp-tone-4 jp-redesign">
        <StepHero step={4} total={4} title="집 평수" pose="house" bubble="지금 사시는 집의 평수를 하나만 골라 주세요." onBack={() => setStep(3)} />
        <div className="px-4 pt-1 space-y-3 flex-1 overflow-auto pb-32">
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="현재 집 평수">
            {SIZE_CHOICES.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={form.fromSize === s} data-choice-selected={form.fromSize === s}
                onClick={() => setForm(c => c ? { ...c, fromSize: s } : c)}
                className={`rounded-2xl border-2 py-4 text-lg font-black ${form.fromSize === s ? "jp-pick-orange border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"}`}>{s}</button>
            ))}
          </div>
          <p className="jp-form-card text-base font-bold">가구·가전과 자세한 이삿짐은 업체가 방문하여 확인해 드립니다.</p>
        </div>
        <BottomButtonBar><PrimaryButton className="jp-next-btn" disabled={!form.fromSize} onClick={() => { setStep(5); window.scrollTo(0, 0); }}>다음: 입력 내용 확인</PrimaryButton></BottomButtonBar>
      </MobileShell> :
      <MobileShell className="jp-estimate-flow jp-tone-4 jp-redesign">
        <ResultHero title="입력 내용 확인" pose="document" bubble="입력하신 내용을 확인해 주세요." onBack={() => setStep(4)} />
        <div className="px-4 pt-1 space-y-4 flex-1 overflow-auto pb-32">
          <Review form={form} consent={consent} setConsent={setConsent} />
          {err && <p role="alert" className="text-destructive font-bold">{err}</p>}
        </div>
        <BottomButtonBar><PrimaryButton className="jp-next-btn" disabled={busy} onClick={submit}>{busy ? "저장 중…" : err ? "다시 저장" : "기본정보 입력 완료"}</PrimaryButton></BottomButtonBar>
      </MobileShell>}
  </CustomerFlowProvider>;
}

function Review({ form, consent, setConsent }: { form: IntakeForm; consent: boolean; setConsent: (v: boolean) => void }) {
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
        <div>현재 집 평수: {form.fromSize || "-"}</div>
        <div className="text-sm text-muted-foreground">가구·가전과 자세한 이삿짐은 업체가 방문하여 확인해 드립니다.</div>
      </div>
      <div className="rounded-2xl border p-4 text-sm leading-relaxed text-muted-foreground">
        <b className="text-base text-foreground">개인정보 수집·이용 동의</b><br />
        수집 항목: 이름, 휴대전화 번호, 이사 날짜·시간, 주소, 집 평수<br />
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
