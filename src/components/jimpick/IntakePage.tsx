/**
 * 고객 전용 사전정보 입력 화면 (로그인 없음, 관리자 메뉴 없음).
 * 1단계 기본정보 → 2단계 주소 → 3단계 큰 가구·가전 → 확인·동의 → 제출.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, MoreVertical, Search, X } from "lucide-react";
import { MoveDateCalendar } from "./MoveDateCalendar";
import { openIntake, saveIntakeProgress, submitIntake, type IntakeOpen } from "@/lib/intake.functions";
import { searchAddress, type KakaoPlace } from "@/lib/kakao.functions";
import { Icon3D, icon3dFor } from "@/lib/jimpick-icon3d";
import { formatTel } from "@/lib/format-input";
import { INTAKE_ROOMS, INTAKE_SIZES, fitsSize, setQty, tapOnce, tapTwice, type IntakeForm } from "@/lib/intake";

const NOTICE = "방문견적 전에 기본정보와 큰 가구·가전만 간단히 선택해 주세요. 층수, 작업환경, 잔짐과 정확한 견적은 방문 시 자세히 확인해 드립니다.";
const DONE = "기본정보가 정상적으로 입력되었습니다. 세부 품목, 작업환경과 정확한 견적은 방문 시 자세히 설명드리겠습니다.";
const CLOSED = "사전정보 입력이 마감되었습니다. 변경사항은 방문 시 담당자에게 말씀해 주세요.";
const TIMES = ["오전 7시", "오전 8시", "오전 9시", "오전 10시", "오후 1시", "오후 2시", "협의 가능"];
const DOUBLE_MS = 280;

type Item = NonNullable<IntakeOpen["items"]>[number];

export function IntakePage({ token }: { token: string }) {
  const [data, setData] = useState<IntakeOpen | null>(null);
  const [form, setForm] = useState<IntakeForm | null>(null);
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [closed, setClosed] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(false);

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
    if (!form || closed) return;
    if (first.current) { first.current = false; return; }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void saveIntakeProgress({ data: { token, form } }).then((r) => { if (r.closed) setClosed(true); }).catch(() => {});
    }, 800);
  }, [form, token, closed]);

  if (!data) return <Shell><div className="py-24 text-center text-xl">불러오는 중…</div></Shell>;
  if (!data.ok) return <Shell><Message text={data.error ?? "링크를 열 수 없습니다."} /></Shell>;
  if (closed) return <Shell company={data.companyName}><Message text={CLOSED} sub={`문의: ${data.contact}`} /></Shell>;
  // 닫기: 입력 내용은 그대로 두고 안전한 종료 화면만 보여 줍니다(브라우저를 강제로 닫지 않음).
  if (done && left) return (
    <Shell company={data.companyName}>
      <Message text="입력이 완료되었습니다." sub={`이 화면은 닫으셔도 됩니다. 문의: ${data.contact}`} />
      <button type="button" onClick={() => setLeft(false)} className="mx-5 mt-6 w-[calc(100%-40px)] rounded-2xl bg-[#EEF1F5] py-4 text-lg font-bold text-[#25282D]">입력 내용 다시 보기</button>
    </Shell>
  );
  if (done) return (
    <Shell company={data.companyName}>
      <Message text={DONE} sub={`문의: ${data.contact}`} />
      <div className="mx-5 mt-6 flex gap-3">
        <button type="button" onClick={() => { setDone(false); setStep(1); }} className="flex-1 rounded-2xl bg-[#EEF1F5] py-4 text-lg font-bold text-[#25282D]">입력 내용 수정하기</button>
        <button type="button" onClick={() => { setLeft(true); window.scrollTo(0, 0); }} className="flex-1 rounded-2xl bg-[#2563EB] py-4 text-lg font-black text-white">닫기</button>
      </div>
    </Shell>
  );
  if (!form) return null;

  const up = (patch: Partial<IntakeForm>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const next = () => {
    setErr(null);
    if (step === 1) {
      if (!form.customerName.trim()) return setErr("이름을 입력해 주세요.");
      if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(form.phone)) return setErr("휴대전화 번호를 확인해 주세요.");
    }
    setStep((s) => Math.min(4, s + 1));
    window.scrollTo(0, 0);
  };
  const submit = async () => {
    setErr(null);
    if (!consent) return setErr("개인정보 수집·이용에 동의해 주세요.");
    setBusy(true);
    try {
      const r = await submitIntake({ data: { token, form, consent: true } });
      if (r.ok) setDone(true);
      else if (r.closed) setClosed(true);
      else setErr(r.error ?? "저장하지 못했습니다. 다시 눌러 주세요.");
    } catch (e) {
      console.error("[intake submit]", e);
      setErr("저장하지 못했습니다. 다시 눌러 주세요.");
    } finally { setBusy(false); }
  };

  return (
    <Shell company={data.companyName}>
      <div className="px-5 pt-4">
        <p className="rounded-2xl bg-[#EFF6FF] p-4 text-[15px] leading-relaxed text-[#1E3A8A]">{NOTICE}</p>
        <div className="mt-4 flex gap-2" aria-label="진행 단계">
          {["기본정보", "주소", "가구·가전"].map((l, i) => (
            <div key={l} className={`flex-1 rounded-full py-2 text-center text-sm font-bold ${step >= i + 1 ? "bg-[#2563EB] text-white" : "bg-[#EEF1F5] text-[#6B7280]"}`}>{i + 1}. {l}</div>
          ))}
        </div>
      </div>
      <div className="px-5 pb-40 pt-5 space-y-5">
        {step === 1 && (
          <>
            <Big label="이름"><input className={inp} value={form.customerName} onChange={(e) => up({ customerName: e.target.value })} placeholder="홍길동" /></Big>
            <Big label="휴대전화 번호"><input className={inp} inputMode="tel" value={form.phone} onChange={(e) => up({ phone: formatTel(e.target.value) })} placeholder="010-0000-0000" /></Big>
            <div>
              <div className="mb-2 text-lg font-bold text-[#25282D]">이사 날짜</div>
              <MoveDateCalendar value={form.moveDate} onSelect={(d) => up({ moveDate: d })} sonLabel="손 없는 날" />
            </div>
            <TimeSelect value={form.moveTime} onChange={(t) => up({ moveTime: t })} />
          </>
        )}
        {step === 2 && (
          <>
            <AddressField label="나가는 주소" value={form.fromAddress} jibun={form.fromJibun} zip={form.fromZip} lockWhenPicked
              onPick={(p) => up({ fromAddress: p.roadAddress || p.address, fromJibun: p.jibunAddress ?? p.address, fromZip: p.zipCode ?? "", fromX: p.x, fromY: p.y })} />
            <Big label="나가는 상세주소"><input className={inp} value={form.fromDetail} onChange={(e) => up({ fromDetail: e.target.value })} placeholder="예) 101동 502호 / 3층" /></Big>
            <AddressField label="들어가는 주소" value={form.toAddress} jibun={form.toJibun} zip={form.toZip}
              onPick={(p) => up({ toAddress: p.roadAddress || p.address, toJibun: p.jibunAddress ?? p.address, toZip: p.zipCode ?? "", toX: p.x, toY: p.y })} />
            <Big label="들어가는 상세주소"><input className={inp} value={form.toDetail} onChange={(e) => up({ toDetail: e.target.value })} placeholder="예) 2층" /></Big>
          </>
        )}
        {step === 3 && <ItemsStep form={form} items={data.items ?? []} setForm={setForm} />}
        {step === 4 && (
          <Review form={form} items={data.items ?? []} consent={consent} setConsent={setConsent} setForm={setForm} />
        )}
        {err && <div className="rounded-2xl bg-[#FEE2E2] p-4 text-base font-bold text-[#B91C1C]">{err}</div>}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md gap-3 border-t bg-white p-4">
        {step > 1 && <button type="button" onClick={() => setStep((s) => s - 1)} className="flex-1 rounded-2xl bg-[#EEF1F5] py-4 text-lg font-bold">이전</button>}
        {step < 4
          ? <button type="button" onClick={next} className="flex-[2] rounded-2xl bg-[#2563EB] py-4 text-lg font-black text-white">{step === 3 ? "확인하기" : "다음"}</button>
          : <button type="button" disabled={busy} onClick={submit} className="flex-[2] rounded-2xl bg-[#2563EB] py-4 text-lg font-black text-white disabled:opacity-60">{busy ? "저장 중…" : "기본정보 입력 완료"}</button>}
      </div>
    </Shell>
  );
}

const inp = "w-full rounded-2xl border-2 border-[#E5E7EB] bg-white text-[#25282D] px-4 py-4 text-lg outline-none focus:border-[#2563EB]";

function Shell({ children, company }: { children: React.ReactNode; company?: string }) {
  return (
    // 휴대폰 「어두운 모드」가 켜져도 흰 바탕·검은 글씨로 보이게 밝은 화면으로 고정합니다.
    <div className="min-h-screen bg-white text-[#25282D]" style={{ colorScheme: "light" }}>
      <div className="mx-auto max-w-md bg-white">
        <header className="border-b px-5 py-4 text-lg font-black text-[#25282D]">{company ? `${company} · 이사 사전정보` : "이사 사전정보"}</header>
        {children}
      </div>
    </div>
  );
}

function Message({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="px-6 py-20 text-center">
      <p className="text-xl font-bold leading-relaxed text-[#25282D]">{text}</p>
      {sub && <p className="mt-4 text-base text-[#6B7280]">{sub}</p>}
    </div>
  );
}

function Big({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="mb-2 text-lg font-bold text-[#25282D]">{label}</div>{children}</label>;
}

function TimeSelect({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="mb-2 text-lg font-bold text-[#25282D]">희망 시간</div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center justify-between rounded-2xl border-2 border-[#E5E7EB] px-4 py-4 text-lg font-bold">
        <span className={value ? "text-[#25282D]" : "text-[#9CA3AF]"}>{value || "시간을 골라 주세요"}</span>
        <ChevronDown className={`h-6 w-6 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="listbox" className="mt-2 overflow-hidden rounded-2xl border-2 border-[#E5E7EB]">
          {TIMES.map((t) => (
            <button key={t} type="button" role="option" aria-selected={value === t} onClick={() => { onChange(t); setOpen(false); }}
              className={`block w-full border-b px-4 py-4 text-left text-lg font-bold last:border-b-0 ${value === t ? "bg-[#2563EB] text-white" : "bg-white"}`}>{t}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 카카오 주소검색 — 입력하면 잠시 뒤 결과가 자동으로 나옵니다. 도로명·지번·우편번호를 저장합니다. */
function AddressField({ label, value, jibun, zip, onPick, lockWhenPicked = false }: { label: string; value: string; jibun?: string; zip?: string; onPick: (p: KakaoPlace) => void; lockWhenPicked?: boolean }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<KakaoPlace[] | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const find = async (text: string) => {
    const t = text.trim();
    if (t.length < 2) { setList(null); return; }
    const my = ++seq.current;
    setBusy(true);
    try {
      const r = await searchAddress({ data: { query: t } });
      if (my === seq.current) setList(r.places);
    } catch { if (my === seq.current) setList([]); }
    finally { if (my === seq.current) setBusy(false); }
  };
  useEffect(() => {
    const h = window.setTimeout(() => void find(q), 400);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const pick = async (p: KakaoPlace) => {
    setList(null); setQ("");
    // 건물 이름으로 찾은 결과에는 우편번호가 없어서, 도로명주소로 한 번 더 찾아 채웁니다.
    if (!p.zipCode && p.roadAddress) {
      try {
        const r = await searchAddress({ data: { query: p.roadAddress } });
        const hit = r.places.find((x) => x.zipCode);
        if (hit) p = { ...p, zipCode: hit.zipCode, jibunAddress: p.jibunAddress || hit.jibunAddress };
      } catch { /* 우편번호 없이 저장 */ }
    }
    onPick(p);
  };
  return (
    <div>
      <div className="mb-2 text-lg font-bold text-[#25282D]">{label}</div>
      {value && (
        <div className="mb-2 rounded-2xl bg-[#EFF6FF] px-4 py-3 text-[#1E3A8A]">
          <div className="text-base font-bold">{value}</div>
          {jibun && jibun !== value && <div className="text-sm">지번 {jibun}</div>}
          {zip && <div className="text-sm">우편번호 {zip}</div>}
        </div>
      )}
      {!(lockWhenPicked && value) && <div className="relative">
        <input className={inp + " pr-12"} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={value ? "다른 주소 검색" : "도로명·건물명·동 이름 입력"} aria-label={`${label} 검색`} />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280]">{busy ? "…" : <Search className="h-6 w-6" />}</span>
      </div>}
      {list && (
        <div className="mt-2 max-h-72 overflow-auto rounded-2xl border">
          {list.length === 0 && <div className="p-4 text-base text-[#6B7280]">검색 결과가 없습니다. 다른 이름으로 찾아 주세요.</div>}
          {list.map((p, i) => (
            <button key={i} type="button" onClick={() => void pick(p)} className="block w-full border-b px-4 py-3 text-left text-base">
              <div className="font-bold">{p.name}</div>
              <div className="text-sm text-[#6B7280]">{p.roadAddress || p.address}{p.zipCode ? ` (${p.zipCode})` : ""}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemsStep({ form, items, setForm }: { form: IntakeForm; items: Item[]; setForm: React.Dispatch<React.SetStateAction<IntakeForm | null>> }) {
  const [room, setRoom] = useState<(typeof INTAKE_ROOMS)[number]>("거실");
  const [menu, setMenu] = useState<string | null>(null);
  const [group, setGroup] = useState<"가구" | "가전">("가구");
  const [q, setQ] = useState("");
  const [sizeOpen, setSizeOpen] = useState(!form.fromSize);
  const pending = useRef<{ id: string; t: number } | null>(null);
  const picks = form.rooms[room] ?? {};
  const term = q.replace(/\s+/g, "").toLowerCase();
  // 검색하면 방·분류와 상관없이 모든 품목에서 찾습니다.
  const pool = term ? items.filter((i) => i.name.replace(/\s+/g, "").toLowerCase().includes(term) || (i.family ?? "").toLowerCase().includes(term))
    : items.filter((i) => i.group === group);
  // 평수·방에 맞는 품목을 먼저 보여 줍니다(추천용 — 나머지도 아래에서 고를 수 있음).
  const fitRoom = (i: Item) => room === "기타" || !i.rooms.length || i.rooms.includes(room);
  const shown = term ? pool : pool.filter((i) => fitRoom(i) && fitsSize(i.sizes, form.fromSize));
  const others = term ? [] : pool.filter((i) => !shown.includes(i));
  const setRoomPicks = (f: (r: typeof picks) => typeof picks) =>
    setForm((s) => (s ? { ...s, rooms: { ...s.rooms, [room]: f(s.rooms[room] ?? {}) } } : s));
  const buzz = () => { try { navigator.vibrate?.(25); } catch { /* 진동 없음 */ } };

  // 한 번 누르기와 두 번 누르기가 겹치지 않도록 짧게 기다린 뒤 한 번 누르기로 처리합니다.
  const press = (it: Item) => {
    const now = Date.now();
    const p = pending.current;
    if (p && p.id === it.id && now - p.t < DOUBLE_MS) {
      window.clearTimeout((p as { id: string; t: number; h?: number }).h);
      pending.current = null;
      setRoomPicks((r) => tapTwice(r, it.id, it.disposalAllowed));
      buzz();
      return;
    }
    if (p) window.clearTimeout((p as { h?: number }).h);
    const h = window.setTimeout(() => { pending.current = null; setRoomPicks((r) => tapOnce(r, it.id)); buzz(); }, DOUBLE_MS);
    pending.current = Object.assign({ id: it.id, t: now }, { h });
  };

  const card = (it: Item) => {
    const p = picks[it.id];
    return (
      <div key={it.id} className={`relative rounded-2xl border-2 p-2 text-center transition ${p ? (p.disposal ? "border-[#EF4444] bg-[#FEE2E2]/70" : "border-[#2563EB] bg-[#EFF6FF]") : "border-[#E5E7EB]"}`}>
        {p && (
          <button type="button" onClick={() => { setRoomPicks((r) => setQty(r, it.id, 0)); setMenu(null); buzz(); }}
            className="absolute -left-2 -top-2 z-[5] flex h-7 w-7 items-center justify-center rounded-full bg-[#25282D] text-white shadow" aria-label={`${it.name} 선택 삭제`}>
            <X className="h-4 w-4" strokeWidth={3} />
          </button>
        )}
        <button type="button" onClick={() => press(it)} className="block w-full select-none" style={{ touchAction: "manipulation" }} aria-pressed={!!p} aria-label={it.name}>
          <span className="relative mx-auto block h-16 w-16">
            <Icon3D src={it.icon ?? icon3dFor(it.id, it.name)} alt={it.name} size={64} className={p?.disposal ? "opacity-50" : ""} />
            {p?.disposal && <X className="absolute inset-0 m-auto h-14 w-14 text-[#DC2626]" strokeWidth={3.5} />}
          </span>
          <span className="mt-1 block text-[15px] font-bold leading-tight">{it.name}</span>
          {p?.disposal && <span className="block text-sm font-black text-[#DC2626]">폐기물</span>}
        </button>
        {p && (
          <>
            <button type="button" onClick={() => setMenu(menu === it.id ? null : it.id)} className="absolute right-1 top-1 p-1" aria-label="메뉴"><MoreVertical className="w-5 h-5" /></button>
            {menu === it.id && (
              <div className="absolute right-1 top-8 z-10 w-36 rounded-xl border bg-white text-left shadow-lg">
                {it.disposalAllowed && !p.disposal && <button type="button" className="block w-full px-3 py-3 text-sm font-bold" onClick={() => { setRoomPicks((r) => tapTwice(r, it.id, true)); setMenu(null); buzz(); }}>폐기물로 변경</button>}
                {p.disposal && <button type="button" className="block w-full px-3 py-3 text-sm font-bold" onClick={() => { setRoomPicks((r) => tapTwice(r, it.id, true)); setMenu(null); buzz(); }}>일반 이사 품목으로 변경</button>}
                <button type="button" className="block w-full px-3 py-3 text-sm font-bold text-[#B91C1C]" onClick={() => { setRoomPicks((r) => setQty(r, it.id, 0)); setMenu(null); buzz(); }}>선택 삭제</button>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <button type="button" onClick={() => setRoomPicks((r) => setQty(r, it.id, p.qty - 1))} className="h-9 w-9 rounded-full bg-white text-xl font-black shadow" aria-label="빼기">−</button>
              <span className="text-lg font-black">{p.qty}</span>
              <button type="button" onClick={() => setRoomPicks((r) => setQty(r, it.id, p.qty + 1))} className="h-9 w-9 rounded-full bg-white text-xl font-black shadow" aria-label="더하기">+</button>
            </div>
          </>
        )}
      </div>
    );
  };
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-[#E5E7EB] p-3">
        <button type="button" onClick={() => setSizeOpen((o) => !o)} aria-expanded={sizeOpen} className="flex w-full items-center justify-between text-lg font-bold">
          <span>출발지 평수 {form.fromSize ? <span className="text-[#2563EB]">· {form.fromSize}</span> : <span className="text-[#9CA3AF]">· 골라 주세요</span>}</span>
          <ChevronDown className={`h-6 w-6 transition ${sizeOpen ? "rotate-180" : ""}`} />
        </button>
        {sizeOpen && (
          <>
            <p className="mt-1 text-sm text-[#6B7280]">평수에 맞는 품목을 먼저 보여 드려요. 다른 품목도 모두 고를 수 있습니다.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {INTAKE_SIZES.map((z) => (
                <button key={z} type="button" onClick={() => { setForm((s) => (s ? { ...s, fromSize: z } : s)); setSizeOpen(false); }}
                  className={`rounded-xl py-3 text-base font-bold ${form.fromSize === z ? "bg-[#2563EB] text-white" : "bg-[#EEF1F5]"}`}>{z}</button>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="rounded-2xl bg-[#FEF2F2] p-4 text-[15px] leading-relaxed text-[#991B1B]">버릴 물건은 품목 카드를 두 번 빠르게 눌러 주세요. 빨간색 X가 표시되면 폐기물로 선택된 것입니다.</p>
      <div className="grid grid-cols-3 gap-2">
        {INTAKE_ROOMS.map((r) => {
          const n = Object.values(form.rooms[r] ?? {}).reduce((a, p) => a + p.qty, 0);
          return (
            <button key={r} type="button" onClick={() => { setRoom(r); setMenu(null); }}
              className={`rounded-xl py-3 text-base font-bold ${room === r ? "bg-[#25282D] text-white" : "bg-[#EEF1F5]"}`}>{r}{n ? ` ${n}` : ""}</button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["가구", "가전"] as const).map((g) => (
          <button key={g} type="button" onClick={() => { setGroup(g); setMenu(null); }}
            className={`rounded-xl py-3 text-lg font-black ${group === g && !term ? "bg-[#2563EB] text-white" : "bg-[#EEF1F5]"}`}>{g}</button>
        ))}
      </div>
      <div className="relative">
        <input className={inp + " pr-12"} value={q} onChange={(e) => setQ(e.target.value)} placeholder="품목 검색 (예: 침대, 냉장고)" aria-label="품목 검색" />
        {q ? <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1" aria-label="검색 지우기"><X className="h-6 w-6" /></button>
          : <Search className="pointer-events-none absolute right-4 top-1/2 h-6 w-6 -translate-y-1/2 text-[#6B7280]" />}
      </div>
      {term && !shown.length && <div className="rounded-2xl bg-[#F7F8F5] p-4 text-base text-[#6B7280]">찾는 품목이 없습니다. 비슷한 품목을 고르시거나 방문 시 말씀해 주세요.</div>}
      {!term && form.fromSize && shown.length > 0 && <div className="text-sm font-bold text-[#6B7280]">{form.fromSize} {room} 추천 품목</div>}
      <div className="grid grid-cols-3 gap-3 pt-1">{shown.map(card)}</div>
      {others.length > 0 && (
        <details className="rounded-2xl bg-[#F7F8F5] p-3">
          <summary className="text-base font-bold">다른 품목 더 보기</summary>
          <div className="mt-3 grid grid-cols-3 gap-3 pt-1">{others.map(card)}</div>
        </details>
      )}
    </div>
  );
}

function Review({ form, items, consent, setConsent, setForm }: { form: IntakeForm; items: Item[]; consent: boolean; setConsent: (v: boolean) => void; setForm: React.Dispatch<React.SetStateAction<IntakeForm | null>> }) {
  const drop = (room: string, id: string) => setForm((s) => (s ? { ...s, rooms: { ...s.rooms, [room]: setQty(s.rooms[room] ?? {}, id, 0) } } : s));
  const nameOf = (id: string) => items.find((i) => i.id === id)?.name ?? "품목";
  return (
    <div className="space-y-4 text-base">
      <h2 className="text-xl font-black">입력 내용 확인</h2>
      <div className="rounded-2xl bg-[#F7F8F5] p-4 space-y-1">
        <div><b>{form.customerName}</b> · {form.phone}</div>
        <div>이사 날짜: {form.moveDate || "아직 미정"} {form.moveTime}</div>
        <div>나가는 곳: {form.fromAddress || "-"} {form.fromDetail}</div>
        <div>들어가는 곳: {form.toAddress || "-"} {form.toDetail}</div>
      </div>
      <div className="rounded-2xl bg-[#F7F8F5] p-4 space-y-1">
        {Object.entries(form.rooms).filter(([, p]) => Object.keys(p).length).map(([room, picks]) => (
          <div key={room}>
            <b>{room}</b>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(picks).map(([id, p]) => (
                <span key={id} className={`inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-sm font-bold ${p.disposal ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-white"}`}>
                  {nameOf(id)}{p.disposal ? "(버림)" : ""} {p.qty}
                  <button type="button" onClick={() => drop(room, id)} className="rounded-full p-1" aria-label={`${nameOf(id)} 삭제`}><X className="h-4 w-4" /></button>
                </span>
              ))}
            </div>
          </div>
        ))}
        <div className="pt-1 text-sm text-[#6B7280]">{form.fromSize ? `출발지 평수: ${form.fromSize} · ` : ""}수량을 바꾸려면 「이전」을 눌러 주세요.</div>
        {!Object.values(form.rooms).some((p) => Object.keys(p).length) && <div className="text-[#6B7280]">선택한 가구·가전이 없습니다. 방문 시 확인해 드립니다.</div>}
      </div>
      <div className="rounded-2xl border p-4 text-sm leading-relaxed text-[#4B5563]">
        <b className="text-base text-[#25282D]">개인정보 수집·이용 동의</b><br />
        수집 항목: 이름, 휴대전화 번호, 이사 날짜·시간, 주소, 이삿짐 정보<br />
        이용 목적: 방문견적 안내와 이사 견적 작성<br />
        보유 기간: 견적·계약 업무 종료 시까지(관련 법령에 따른 보관 기간은 예외)<br />
        동의하지 않으셔도 되며, 이 경우 전화로 안내해 드립니다.
      </div>
      <label className="flex items-center gap-3 rounded-2xl bg-[#EFF6FF] p-4 text-lg font-bold">
        <input type="checkbox" className="h-6 w-6" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> 개인정보 수집·이용에 동의합니다
      </label>
    </div>
  );
}
