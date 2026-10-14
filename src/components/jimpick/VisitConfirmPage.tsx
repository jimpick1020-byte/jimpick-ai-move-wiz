/** 고객 방문 일정 확인 화면 (로그인 없음, 흰 배경·밝은 주황 고정) */
import { useEffect, useState } from "react";
import { useForceLightPage, InAppBrowserNotice } from "./InAppBrowserNotice";
import { openVisit, confirmVisit, type VisitOpen } from "@/lib/intake.functions";

export function VisitConfirmPage({ token }: { token: string }) {
  useForceLightPage();
  const [data, setData] = useState<VisitOpen | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    openVisit({ data: { token } }).then(setData).catch(() => setData({ ok: false, error: "잠시 후 다시 열어 주세요." }));
  }, [token]);
  const ok = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await confirmVisit({ data: { token } });
      if (r.ok) setData((d) => (d ? { ...d, confirmedAt: r.confirmedAt } : d)); else setErr(r.error ?? "저장하지 못했습니다.");
    } catch { setErr("저장하지 못했습니다. 다시 눌러 주세요."); } finally { setBusy(false); }
  };
  const date = data?.date ? (() => { const [, m, d] = data.date.split("-").map(Number); return `${m}월 ${d}일`; })() : "";
  return (
    <div className="jp-visit min-h-screen">
      <InAppBrowserNotice />
      <main className="mx-auto max-w-md px-5 py-8 space-y-5">
        {!data ? <p className="py-24 text-center text-xl">불러오는 중…</p> : !data.ok ? (
          <p className="py-20 text-center text-xl font-bold">{data.error}</p>
        ) : (<>
          <h1 className="text-2xl font-black">{data.companyName}</h1>
          <p className="text-lg font-bold">{data.customerName ? `${data.customerName} 고객님, ` : ""}방문견적 일정을 확인해 주세요.</p>
          <section className="jp-visit-box rounded-2xl p-5 space-y-2 text-lg">
            <div><b>방문 날짜</b> {date}</div>
            <div><b>방문 시간</b> {data.time || "업체가 따로 안내"}</div>
            <div><b>방문 주소</b> {data.address || "방문 시 확인"}</div>
            {data.memo && <div className="break-all"><b>방문 메모</b> {data.memo}</div>}
            <div><b>업체 연락처</b> <a href={`tel:${data.contact}`} className="jp-visit-accent font-black underline">{data.contact}</a></div>
          </section>
          {data.confirmedAt ? (
            <p role="status" className="jp-visit-accent text-center text-xl font-black">확인했습니다. 감사합니다.</p>
          ) : (
            <button type="button" disabled={busy} onClick={ok} className="jp-visit-btn w-full rounded-2xl py-5 text-xl font-black disabled:opacity-60">{busy ? "저장 중…" : "확인했습니다"}</button>
          )}
          {err && <p role="alert" className="font-bold text-destructive">{err}</p>}
        </>)}
      </main>
    </div>
  );
}
