import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, CheckCircle2, AlertTriangle, Loader2, RotateCcw, XCircle, Clock, Upload, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp, guessCategory } from "@/lib/jimpick";
import { registerCustomIcons } from "@/lib/jimpick-icon3d";
import { MobileShell, TopBar, PrimaryButton, BottomButtonBar } from "./ui";
import { tap } from "@/lib/feedback";
import { analyzeRoomScan, saveCroppedItem, type ScanDetection } from "@/lib/room-scan.functions";
import { preparePhoto, hashDistance } from "@/lib/photo-prep-core";
import { buildCatalog, matchCatalog, normScanName, AUTO_CONF, CHECK_CONF, type CatalogEntry } from "@/lib/scan-match";

const BUCKET = "room-scans";
const STALE_MS = 4 * 60 * 1000;
const DEFAULT_ROOMS = ["안방", "작은방", "입구방", "거실", "부엌", "베란다"];

type Decision = "added" | "skipped" | "saved";
interface ScanRow {
  id: string;
  room: string;
  photo_path: string;
  photo_hash: string | null;
  status: string;
  error_message: string | null;
  result: { items?: ScanDetection[]; decisions?: Record<string, Decision> } | null;
  applied_at: string | null;
  updated_at: string;
  created_at: string;
}
interface LocalJob {
  localId: string;
  room: string;
  dataUrl?: string;
  hash?: string;
  status: "uploading" | "upload_failed" | "retake";
  reason?: string;
}

type View = { label: string; tone: "blue" | "amber" | "red" | "green" | "gray"; pct: number };

function concurrencyLimit() {
  // 한 장씩 차례대로 분석합니다 (속도·오류 안정)
  return 1;
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("사진 저장 실패"));
    r.readAsDataURL(b);
  });
}
async function dataUrlToBlob(u: string): Promise<Blob> {
  return (await fetch(u)).blob();
}

function classify(det: ScanDetection, catalog: CatalogEntry[]): { kind: "low" | "auto" | "check" | "candidate"; match: CatalogEntry | null } {
  const match = matchCatalog(det.name, catalog);
  if (det.confidence < CHECK_CONF) return { kind: "low" as const, match };
  // 자동 등록하지 않고 사장님이 이름·수량을 확인한 뒤 추가합니다
  if (match) return { kind: "check" as const, match };
  return { kind: "candidate" as const, match: null };
}

async function cropFromUrl(url: string, box: ScanDetection["box"]): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("사진을 불러오지 못했습니다."));
    i.src = url;
  });
  const b = box ?? { x: 0, y: 0, w: 1000, h: 1000 };
  const sx = (b.x / 1000) * img.width;
  const sy = (b.y / 1000) * img.height;
  const sw = Math.max(8, Math.min(img.width - sx, (b.w / 1000) * img.width));
  const sh = Math.max(8, Math.min(img.height - sy, (b.h / 1000) * img.height));
  const scale = Math.min(1, 512 / Math.max(sw, sh));
  const c = document.createElement("canvas");
  c.width = Math.round(sw * scale);
  c.height = Math.round(sh * scale);
  c.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

export function RoomScanScreen() {
  const { draft, setScreen, patchDraft, companyItems, refreshCompanyItems } = useApp();
  const analyze = useServerFn(analyzeRoomScan);
  const saveCrop = useServerFn(saveCroppedItem);
  const estimateId = draft.id;
  const pendingKey = `jimpick_scan_pending:${estimateId}`;

  const roomNames = useMemo(() => {
    const names = draft.rooms.map((r) => r.name);
    return names.length ? names : DEFAULT_ROOMS;
  }, [draft.rooms]);
  const [room, setRoom] = useState<string>(() => roomNames[0]);
  useEffect(() => {
    if (!roomNames.includes(room)) setRoom(roomNames[0]);
  }, [roomNames, room]);

  const [uid, setUid] = useState("");
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [local, setLocal] = useState<LocalJob[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [online, setOnline] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const captureRoom = useRef(room);
  captureRoom.current = room;

  const catalog = useMemo(() => buildCatalog(companyItems), [companyItems]);
  const knownNames = useMemo(() => [...new Set(catalog.map((c) => c.name))].slice(0, 600), [catalog]);

  // ── 저장된 기록 불러오기 ──────────────────────────────
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("room_scans")
      .select("id, room, photo_path, photo_hash, status, error_message, result, applied_at, updated_at, created_at")
      .eq("estimate_id", estimateId)
      .order("created_at", { ascending: true });
    if (error) return;
    const list = (data ?? []) as unknown as ScanRow[];
    setRows(list);
    const missing = list.filter((r) => !urls[r.id]);
    if (missing.length) {
      const signed = await supabase.storage.from(BUCKET).createSignedUrls(missing.map((r) => r.photo_path), 3600);
      const next: Record<string, string> = {};
      signed.data?.forEach((s, i) => {
        if (s.signedUrl) next[missing[i].id] = s.signedUrl;
      });
      setUrls((u) => ({ ...u, ...next }));
    }
    return list;
  }, [estimateId, urls]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? ""));
    try {
      const saved = JSON.parse(localStorage.getItem(pendingKey) || "[]") as LocalJob[];
      // 새로고침 중 업로드되던 사진은 실패로 남겨 다시 시도할 수 있게 합니다
      setLocal(saved.map((j) => (j.status === "uploading" ? { ...j, status: "upload_failed", reason: "업로드가 중단되었습니다." } : j)));
    } catch {
      /* 없으면 빈 목록 */
    }
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [pendingKey]);

  useEffect(() => {
    try {
      localStorage.setItem(pendingKey, JSON.stringify(local.filter((j) => j.dataUrl)));
    } catch {
      toast.error("기기 저장 공간이 부족해 실패한 사진을 보관하지 못했습니다.");
    }
  }, [local, pendingKey]);

  // ── 분석 대기열 (동시 실행 수 제한) ────────────────────
  const queue = useRef<string[]>([]);
  const running = useRef(new Set<string>());
  const retried = useRef(new Set<string>());
  const loadRef = useRef(load);
  loadRef.current = load;
  const namesRef = useRef(knownNames);
  namesRef.current = knownNames;

  const pump = useCallback(() => {
    const limit = concurrencyLimit();
    while (running.current.size < limit && queue.current.length) {
      const id = queue.current.shift()!;
      if (running.current.has(id)) continue;
      running.current.add(id);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: "analyzing", updated_at: new Date().toISOString() } : r)));
      const run = () => analyze({ data: { scanId: id, knownNames: namesRef.current } });
      void run()
        .then((res) => {
          // 실패한 사진만 한 번 더 시도합니다
          if (!res.ok && !retried.current.has(id)) {
            retried.current.add(id);
            return run();
          }
          return res;
        })
        .catch(async () => {
          if (!retried.current.has(id)) {
            retried.current.add(id);
            try { await run(); return; } catch { /* 아래에서 실패 기록 */ }
          }
          await supabase.from("room_scans").update({ status: "failed", error_message: "인터넷 연결이 끊겨 분석하지 못했습니다." }).eq("id", id);
        })
        .finally(() => {
          running.current.delete(id);
          void loadRef.current();
          pump();
        });
    }
  }, [analyze]);

  const enqueue = useCallback(
    (id: string) => {
      if (!queue.current.includes(id) && !running.current.has(id)) queue.current.push(id);
      pump();
    },
    [pump],
  );

  // 처음 열 때 대기 중이던 작업을 이어서 분석합니다
  const resumed = useRef(false);
  useEffect(() => {
    void load().then((list) => {
      if (resumed.current || !list) return;
      resumed.current = true;
      list.filter((r) => r.status === "queued").forEach((r) => enqueue(r.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId]);

  // 다른 기기·이전 요청에서 진행 중인 분석 상태 갱신
  useEffect(() => {
    const t = window.setInterval(() => {
      setNow(Date.now());
      if (rows.some((r) => r.status === "analyzing" || r.status === "queued")) void load();
    }, 5000);
    return () => window.clearInterval(t);
  }, [rows, load]);

  // ── 신뢰도 90% 이상 품목 자동 선택 (한 사진당 1회) ──────
  const applying = useRef(new Set<string>());
  useEffect(() => {
    const todo = rows.filter((r) => r.status === "done" && !r.applied_at && !applying.current.has(r.id));
    if (!todo.length) return;
    for (const r of todo) {
      applying.current.add(r.id);
      const adds: Record<string, number> = {};
      (r.result?.items ?? []).forEach((det) => {
        const c = classify(det, catalog);
        if (false as boolean && c.match) adds[c.match.id] = (adds[c.match.id] ?? 0) + det.qty;
      });
      patchDraft((d) => {
        let rooms = d.rooms;
        if (!rooms.some((x) => x.name === r.room))
          rooms = [...rooms, { id: `r_${r.room}`, name: r.room, items: {} }];
        return {
          rooms: rooms.map((x) => {
            if (x.name !== r.room) return x;
            const items = { ...x.items };
            for (const [id, q] of Object.entries(adds)) items[id] = (items[id] ?? 0) + q;
            return { ...x, items };
          }),
        };
      });
      void supabase.from("room_scans").update({ applied_at: new Date().toISOString() }).eq("id", r.id).then(() => load());
    }
  }, [rows, catalog, patchDraft, load]);

  // ── 촬영 ─────────────────────────────────────────────
  const uploadJob = useCallback(
    async (job: LocalJob, blob: Blob, hash: string) => {
      let me = uid;
      if (!me) {
        const { data } = await supabase.auth.getSession();
        me = data.session?.user.id ?? "";
        if (me) setUid(me);
      }
      if (!me) throw new Error("로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요.");
      const path = `${me}/${estimateId}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw new Error(up.error.message);
      const ins = await supabase
        .from("room_scans")
        .insert({ user_id: me, estimate_id: estimateId, room: job.room, photo_path: path, photo_hash: hash, status: "queued" })
        .select("id")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      setLocal((l) => l.filter((j) => j.localId !== job.localId));
      await load();
      enqueue(ins.data.id as string);
    },
    [uid, estimateId, load, enqueue],
  );

  const handleFiles = async (files: FileList | null, targetRoom: string, force = false) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const job: LocalJob = { localId: crypto.randomUUID(), room: targetRoom, status: "uploading" };
      setLocal((l) => [...l, job]);
      try {
        const prep = await preparePhoto(file);
        const dup = rows.some((r) => r.room === targetRoom && r.photo_hash && hashDistance(r.photo_hash, prep.hash) <= 4);
        if (dup && !force) {
          setLocal((l) => l.filter((j) => j.localId !== job.localId));
          toast.info(`${targetRoom}: 이미 찍은 사진과 같은 장면이라 건너뛰었습니다.`);
          continue;
        }
        if (!prep.quality.ok && !force) {
          const dataUrl = await blobToDataUrl(prep.blob);
          setLocal((l) => l.map((j) => (j.localId === job.localId ? { ...j, status: "retake", reason: prep.quality.reason, dataUrl, hash: prep.hash } : j)));
          continue;
        }
        try {
          await uploadJob(job, prep.blob, prep.hash);
        } catch (e) {
          const dataUrl = await blobToDataUrl(prep.blob);
          setLocal((l) =>
            l.map((j) =>
              j.localId === job.localId
                ? { ...j, status: "upload_failed", dataUrl, hash: prep.hash, reason: navigator.onLine ? (e instanceof Error ? e.message : "업로드 실패") : "인터넷이 끊겨 업로드하지 못했습니다." }
                : j,
            ),
          );
        }
      } catch (e) {
        setLocal((l) => l.map((j) => (j.localId === job.localId ? { ...j, status: "retake", reason: e instanceof Error ? e.message : "사진을 읽지 못했습니다." } : j)));
      }
    }
  };

  const retryLocal = async (job: LocalJob) => {
    if (!job.dataUrl || !job.hash) {
      setLocal((l) => l.filter((j) => j.localId !== job.localId));
      return;
    }
    setLocal((l) => l.map((j) => (j.localId === job.localId ? { ...j, status: "uploading" } : j)));
    try {
      await uploadJob(job, await dataUrlToBlob(job.dataUrl), job.hash);
    } catch (e) {
      setLocal((l) => l.map((j) => (j.localId === job.localId ? { ...j, status: "upload_failed", reason: e instanceof Error ? e.message : "업로드 실패" } : j)));
    }
  };

  const retryRow = async (r: ScanRow) => {
    await supabase.from("room_scans").update({ status: "queued", error_message: null }).eq("id", r.id);
    await load();
    enqueue(r.id);
  };

  const openCamera = () => {
    captureRoom.current = room;
    tap("click");
    fileRef.current?.click();
  };
  const openPicker = () => {
    captureRoom.current = room;
    pickRef.current?.click();
  };
  const nextRoom = () => {
    const i = roomNames.indexOf(room);
    setRoom(roomNames[(i + 1) % roomNames.length]);
  };

  // ── 상태 표시 ────────────────────────────────────────
  const reviewPending = (r: ScanRow) =>
    (r.result?.items ?? []).some((det, idx) => {
      const k = classify(det, catalog).kind;
      return (k === "check" || k === "candidate") && !r.result?.decisions?.[idx];
    });

  const rowView = (r: ScanRow): View => {
    if (r.status === "queued") return { label: "분석 대기", tone: "gray", pct: 50 };
    if (r.status === "analyzing") {
      if (now - new Date(r.updated_at).getTime() > STALE_MS && !running.current.has(r.id))
        return { label: "시간 초과", tone: "red", pct: 75 };
      return { label: "분석 중", tone: "blue", pct: 75 };
    }
    if (r.status === "retake") return { label: "확인 필요", tone: "amber", pct: 100 };
    if (r.status === "failed") return { label: "실패", tone: "red", pct: 100 };
    if (r.status === "done") return reviewPending(r) ? { label: "확인 필요", tone: "amber", pct: 100 } : { label: "완료", tone: "green", pct: 100 };
    return { label: r.status, tone: "gray", pct: 0 };
  };
  const localView = (j: LocalJob): View =>
    j.status === "uploading"
      ? { label: "업로드 중", tone: "blue", pct: 25 }
      : j.status === "retake"
        ? { label: "확인 필요", tone: "amber", pct: 100 }
        : { label: "실패", tone: "red", pct: 100 };

  const toneCls: Record<View["tone"], string> = {
    blue: "bg-[#E8F0FC] text-[#2A6FD6]",
    amber: "bg-[#FFF4E0] text-[#B26A00]",
    red: "bg-[#FDECEC] text-[#C62828]",
    green: "bg-[#E7F6EC] text-[#1E7B3E]",
    gray: "bg-[#F1F2F4] text-[#5B6270]",
  };
  const barCls: Record<View["tone"], string> = {
    blue: "bg-[#2A6FD6]",
    amber: "bg-[#F2A516]",
    red: "bg-[#E14B4B]",
    green: "bg-[#2E9E57]",
    gray: "bg-[#9AA1AC]",
  };

  const summary = useMemo(() => {
    let recognized = 0;
    let check = 0;
    for (const r of rows)
      (r.result?.items ?? []).forEach((det, idx) => {
        const k = classify(det, catalog).kind;
        recognized += det.qty;
        if ((k === "check" || k === "candidate") && !r.result?.decisions?.[idx]) check += 1;
      });
    return { shots: rows.length + local.length, recognized, check };
  }, [rows, local, catalog]);

  const roomRows = rows.filter((r) => r.room === room);
  const latest = roomRows[roomRows.length - 1];
  const latestUrl = latest ? urls[latest.id] : undefined;

  return (
    <MobileShell className="jp-estimate-flow jp-tone-4">
      <TopBar title="4단계. AI 연속촬영" onBack={() => setScreen("step3")} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files;
          void handleFiles(f, captureRoom.current);
          e.target.value = "";
        }}
      />
      <input
        ref={pickRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files;
          void handleFiles(f, captureRoom.current);
          e.target.value = "";
        }}
      />
      <div className="flex-1 overflow-auto pb-28">
        {!online && (
          <div className="mx-4 mt-3 rounded-xl bg-[#FDECEC] px-3 py-2 text-[13px] font-bold text-[#C62828]">
            인터넷이 끊겼습니다. 찍은 사진은 기기에 보관되며 연결되면 다시 올릴 수 있습니다.
          </div>
        )}
        {/* 방 선택 */}
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-2">
          {roomNames.map((n) => {
            const cnt = rows.filter((r) => r.room === n).length + local.filter((j) => j.room === n).length;
            return (
              <button
                key={n}
                onClick={() => setRoom(n)}
                className={`shrink-0 rounded-full px-4 py-2 text-[14px] font-black border ${
                  n === room ? "bg-[#2A6FD6] text-white border-[#2A6FD6]" : "bg-white text-[#25282D] border-[#E5E7EB]"
                }`}
              >
                {n}
                {cnt > 0 && <span className="ml-1 text-[12px] opacity-80">{cnt}</span>}
              </button>
            );
          })}
        </div>

        {/* 현재 방 사진 */}
        <div className="mx-4 mt-1 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <div className="relative aspect-[4/3] bg-[#EEF2F7]">
            {latestUrl ? (
              <img src={latestUrl} alt={`${room} 사진`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-[#6B7280]">
                <Camera className="h-10 w-10" />
                <p className="text-[14px] font-bold">{room} 사진을 찍어 주세요</p>
              </div>
            )}
            {latest && latestUrl &&
              (latest.result?.items ?? []).map((det, i) =>
                det.box && det.confidence >= CHECK_CONF ? (
                  <div
                    key={i}
                    className={`absolute border-2 rounded-md ${det.confidence >= AUTO_CONF ? "border-[#2E9E57]" : "border-[#F2A516]"}`}
                    style={{ left: `${det.box.x / 10}%`, top: `${det.box.y / 10}%`, width: `${det.box.w / 10}%`, height: `${det.box.h / 10}%` }}
                  >
                    <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-black/70 px-1 text-[11px] font-bold text-white">
                      {det.name} {Math.round(det.confidence * 100)}%
                    </span>
                  </div>
                ) : null,
              )}
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <button onClick={openCamera} className="flex items-center justify-center gap-2 rounded-xl bg-[#2A6FD6] py-3 text-[15px] font-black text-white">
              <Camera className="h-5 w-5" /> {room} 촬영
            </button>
            <button onClick={nextRoom} className="flex items-center justify-center gap-1 rounded-xl border border-[#2A6FD6] bg-white py-3 text-[15px] font-black text-[#2A6FD6]">
              다음 방 촬영 <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <button onClick={openPicker} className="mx-3 mb-2 w-[calc(100%-1.5rem)] rounded-xl border border-[#D1D5DB] bg-white py-2.5 text-[14px] font-bold text-[#25282D]">
            사진 선택 (앨범에서 고르기)
          </button>
          <p className="px-3 pb-3 text-[12px] text-[#6B7280]">분석을 기다리지 않고 다음 방을 계속 찍을 수 있습니다. 카메라가 열리지 않으면 휴대폰 설정 → 애플리케이션 → 브라우저 → 권한에서 카메라를 허용하거나 "사진 선택"을 눌러 주세요.</p>
          {latest && latest.status === "done" && (latest.result?.items ?? []).length === 0 && (
            <p className="mx-3 mb-3 rounded-lg bg-[#F1F2F4] px-3 py-2 text-[13px] font-bold text-[#5B6270]">인식된 대형 품목 없음</p>
          )}
        </div>

        {/* 방별 진행 */}
        <div className="mx-4 mt-4">
          <h2 className="mb-2 text-[16px] font-black text-[#25282D]">방별 분석 진행</h2>
          {rows.length + local.length === 0 && (
            <p className="rounded-xl bg-white p-4 text-center text-[13px] text-[#6B7280] border border-[#E5E7EB]">아직 찍은 사진이 없습니다.</p>
          )}
          <div className="space-y-2">
            {local.map((j) => {
              const v = localView(j);
              return (
                <div key={j.localId} className="rounded-xl border border-[#E5E7EB] bg-white p-3">
                  <div className="flex items-center gap-3">
                    {j.dataUrl ? <img src={j.dataUrl} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#EEF2F7]"><Upload className="h-5 w-5 text-[#6B7280]" /></div>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <b className="text-[15px]">{j.room}</b>
                        <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${toneCls[v.tone]}`}>{v.label}</span>
                      </div>
                      {j.reason && <p className="mt-0.5 text-[12px] text-[#6B7280]">{j.reason}</p>}
                    </div>
                    {j.status === "upload_failed" && (
                      <button onClick={() => void retryLocal(j)} className="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[13px] font-bold text-[#2A6FD6]">
                        <RotateCcw className="h-4 w-4" /> 다시 올리기
                      </button>
                    )}
                    {j.status === "retake" && (
                      <div className="flex flex-col gap-1">
                        <button onClick={() => { captureRoom.current = j.room; setLocal((l) => l.filter((x) => x.localId !== j.localId)); fileRef.current?.click(); }} className="rounded-lg bg-[#2A6FD6] px-2 py-1 text-[12px] font-bold text-white">재촬영</button>
                        {j.dataUrl && j.hash && <button onClick={() => void retryLocal(j)} className="rounded-lg border px-2 py-1 text-[12px] font-bold">그대로 분석</button>}
                      </div>
                    )}
                    {j.status === "uploading" && <Loader2 className="h-5 w-5 animate-spin text-[#2A6FD6]" />}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[#EEF2F7]"><div className={`h-full rounded-full ${barCls[v.tone]}`} style={{ width: `${v.pct}%` }} /></div>
                </div>
              );
            })}
            {[...rows].reverse().map((r) => {
              const v = rowView(r);
              const n = (r.result?.items ?? []).filter((d) => d.confidence >= CHECK_CONF).length;
              const canRetry = v.label === "실패" || v.label === "시간 초과" || r.status === "retake";
              return (
                <div key={r.id} className="rounded-xl border border-[#E5E7EB] bg-white p-3">
                  <div className="flex items-center gap-3">
                    {urls[r.id] ? <img src={urls[r.id]} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="h-12 w-12 rounded-lg bg-[#EEF2F7]" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <b className="text-[15px]">{r.room}</b>
                        <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${toneCls[v.tone]}`}>{v.label}</span>
                      </div>
                      <p className="mt-0.5 text-[12px] text-[#6B7280]">
                        {r.status === "done" ? `품목 ${n}종 인식` : r.error_message || (v.label === "시간 초과" ? "분석 시간이 초과되었습니다." : "")}
                      </p>
                    </div>
                    {v.label === "분석 중" && <Loader2 className="h-5 w-5 animate-spin text-[#2A6FD6]" />}
                    {v.label === "분석 대기" && <Clock className="h-5 w-5 text-[#9AA1AC]" />}
                    {v.label === "완료" && <CheckCircle2 className="h-5 w-5 text-[#2E9E57]" />}
                    {canRetry && (
                      <button onClick={() => void retryRow(r)} className="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[13px] font-bold text-[#2A6FD6]">
                        <RotateCcw className="h-4 w-4" /> 다시 분석
                      </button>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[#EEF2F7]"><div className={`h-full rounded-full ${barCls[v.tone]}`} style={{ width: `${v.pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 요약 */}
        <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
          {[
            ["촬영", summary.shots, "text-[#2A6FD6]"],
            ["인식 대형", summary.recognized, "text-[#2E9E57]"],
            ["확인 필요", summary.check, "text-[#B26A00]"],
          ].map(([l, v, c]) => (
            <div key={String(l)} className="rounded-xl border border-[#E5E7EB] bg-white p-3 text-center">
              <div className={`text-[22px] font-black ${c}`}>{v}</div>
              <div className="text-[12px] font-bold text-[#6B7280]">{l}</div>
            </div>
          ))}
        </div>
        <p className="mx-4 mt-2 text-[11px] text-[#9AA1AC]">
          신뢰도 90% 이상은 자동 선택, 65~89%는 확인 필요, 65% 미만은 추가하지 않습니다. 인식 결과는 반드시 확인해 주세요.
        </p>
        <button onClick={() => setScreen("step6")} className="mx-4 mt-3 w-[calc(100%-2rem)] rounded-xl border border-[#E5E7EB] bg-white py-3 text-[14px] font-bold text-[#25282D]">
          직접 선택으로 품목 고르기·수정
        </button>
      </div>
      <BottomButtonBar>
        <div className="flex gap-2">
          <button onClick={() => setReviewOpen(true)} className="flex-1 rounded-2xl border-2 border-[#2A6FD6] bg-white py-3.5 text-[16px] font-black text-[#2A6FD6]">
            인식 결과 확인{summary.check > 0 ? ` (${summary.check})` : ""}
          </button>
          <div className="flex-1">
            <PrimaryButton onClick={() => setScreen("step6")}>다음</PrimaryButton>
          </div>
        </div>
      </BottomButtonBar>

      {reviewOpen && (
        <ReviewSheet
          rows={rows}
          urls={urls}
          catalog={catalog}
          onClose={() => setReviewOpen(false)}
          onDecide={async (r, idxs, decision, add) => {
            const decisions = { ...(r.result?.decisions ?? {}) };
            idxs.forEach((i) => (decisions[String(i)] = decision));
            if (add)
              patchDraft((d) => {
                let rooms = d.rooms;
                if (!rooms.some((x) => x.name === r.room)) rooms = [...rooms, { id: `r_${r.room}`, name: r.room, items: {} }];
                return { rooms: rooms.map((x) => (x.name === r.room ? { ...x, items: { ...x.items, [add.id]: (x.items[add.id] ?? 0) + add.qty } } : x)) };
              });
            await supabase.from("room_scans").update({ result: JSON.parse(JSON.stringify({ ...(r.result ?? {}), decisions })) }).eq("id", r.id);
            await load();
          }}
          onSaveCandidate={async (r, idxs, name, qty, image) => {
            const cat = guessCategory(name);
            const res = await saveCrop({ data: { name, cat, room: r.room, image } });
            if (!res.ok || !res.itemId || !res.iconUrl) {
              toast.error(res.error || "품목 저장에 실패했습니다.");
              return false;
            }
            registerCustomIcons([{ id: res.itemId, icon: res.iconUrl }]);
            const itemId = res.itemId;
            const iconUrl = res.iconUrl;
            patchDraft((d) => {
              const list = d.customItems || [];
              const entry = { id: itemId, name: res.name || name, cat, extra: 0.5, icon: iconUrl, active: true };
              let rooms = d.rooms;
              if (!rooms.some((x) => x.name === r.room)) rooms = [...rooms, { id: `r_${r.room}`, name: r.room, items: {} }];
              return {
                customItems: list.some((c) => c.id === itemId) ? list : [...list, entry],
                rooms: rooms.map((x) => (x.name === r.room ? { ...x, items: { ...x.items, [itemId]: (x.items[itemId] ?? 0) + qty } } : x)),
              };
            });
            const decisions = { ...(r.result?.decisions ?? {}) };
            idxs.forEach((i) => (decisions[String(i)] = "saved"));
            await supabase.from("room_scans").update({ result: JSON.parse(JSON.stringify({ ...(r.result ?? {}), decisions })) }).eq("id", r.id);
            void refreshCompanyItems().catch(() => {});
            await load();
            toast.success(res.reused ? `이미 있는 「${res.name}」 품목에 담았습니다.` : `「${name}」 품목을 저장했습니다.`);
            return true;
          }}
        />
      )}
    </MobileShell>
  );
}

function ReviewSheet({
  rows,
  urls,
  catalog,
  onClose,
  onDecide,
  onSaveCandidate,
}: {
  rows: ScanRow[];
  urls: Record<string, string>;
  catalog: CatalogEntry[];
  onClose: () => void;
  onDecide: (r: ScanRow, idxs: number[], d: Decision, add?: { id: string; qty: number }) => Promise<void>;
  onSaveCandidate: (r: ScanRow, idxs: number[], name: string, qty: number, image: string) => Promise<boolean>;
}) {
  const rooms = [...new Set(rows.map((r) => r.room))];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="max-h-[88dvh] w-full max-w-md overflow-auto rounded-t-3xl bg-[#F7F8F5] p-4 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-black">인식 결과 확인</h2>
          <button onClick={onClose} aria-label="닫기"><XCircle className="h-7 w-7 text-[#9AA1AC]" /></button>
        </div>
        {rooms.length === 0 && <p className="text-center text-[14px] text-[#6B7280]">분석된 사진이 없습니다.</p>}
        {rooms.map((room) => (
          <RoomReview key={room} room={room} rows={rows.filter((r) => r.room === room && r.status === "done")} urls={urls} catalog={catalog} onDecide={onDecide} onSaveCandidate={onSaveCandidate} />
        ))}
      </div>
    </div>
  );
}

function RoomReview({
  room,
  rows,
  urls,
  catalog,
  onDecide,
  onSaveCandidate,
}: {
  room: string;
  rows: ScanRow[];
  urls: Record<string, string>;
  catalog: CatalogEntry[];
  onDecide: (r: ScanRow, idxs: number[], d: Decision, add?: { id: string; qty: number }) => Promise<void>;
  onSaveCandidate: (r: ScanRow, idxs: number[], name: string, qty: number, image: string) => Promise<boolean>;
}) {
  // 같은 방 여러 사진의 결과를 병합: 같은 품목은 한 줄로, 수량은 합산
  const groups = useMemo(() => {
    const auto = new Map<string, { name: string; qty: number }>();
    const check = new Map<string, { entry: CatalogEntry; qty: number; conf: number; refs: { r: ScanRow; i: number }[] }>();
    const cand = new Map<string, { name: string; qty: number; conf: number; refs: { r: ScanRow; i: number; det: ScanDetection }[] }>();
    let low = 0;
    for (const r of rows)
      (r.result?.items ?? []).forEach((det, i) => {
        const c = classify(det, catalog);
        const decided = r.result?.decisions?.[String(i)];
        if (c.kind === "low") low++;
        else if (c.kind === "auto" && c.match) {
          const g = auto.get(c.match.id) ?? { name: c.match.name, qty: 0 };
          g.qty += det.qty;
          auto.set(c.match.id, g);
        } else if (!decided && c.kind === "check" && c.match) {
          const g = check.get(c.match.id) ?? { entry: c.match, qty: 0, conf: 0, refs: [] };
          g.qty += det.qty;
          g.conf = Math.max(g.conf, det.confidence);
          g.refs.push({ r, i });
          check.set(c.match.id, g);
        } else if (!decided && c.kind === "candidate") {
          const k = normScanName(det.name);
          const g = cand.get(k) ?? { name: det.name, qty: 0, conf: 0, refs: [] };
          g.qty += det.qty;
          g.conf = Math.max(g.conf, det.confidence);
          g.refs.push({ r, i, det });
          cand.set(k, g);
        }
      });
    return { auto: [...auto.values()], check: [...check.values()], cand: [...cand.values()], low };
  }, [rows, catalog]);

  const decideGroup = async (refs: { r: ScanRow; i: number }[], d: Decision, add?: { id: string; qty: number }) => {
    const byRow = new Map<string, { r: ScanRow; idxs: number[] }>();
    refs.forEach(({ r, i }) => {
      const e = byRow.get(r.id) ?? { r, idxs: [] };
      e.idxs.push(i);
      byRow.set(r.id, e);
    });
    let first = true;
    for (const { r, idxs } of byRow.values()) {
      await onDecide(r, idxs, d, first ? add : undefined);
      first = false;
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-[#E5E7EB] bg-white p-3">
      <h3 className="mb-2 text-[16px] font-black">{room}</h3>
      {groups.auto.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-[12px] font-bold text-[#1E7B3E]">자동 선택됨 (신뢰도 90% 이상)</p>
          <div className="flex flex-wrap gap-1.5">
            {groups.auto.map((g) => (
              <span key={g.name} className="rounded-full bg-[#E7F6EC] px-2.5 py-1 text-[13px] font-bold text-[#1E7B3E]">{g.name} ×{g.qty}</span>
            ))}
          </div>
        </div>
      )}
      {groups.check.map((g) => (
        <CheckRow key={g.entry.id} name={g.entry.name} qty={g.qty} conf={g.conf} onAdd={(q) => decideGroup(g.refs, "added", { id: g.entry.id, qty: q })} onSkip={() => decideGroup(g.refs, "skipped")} />
      ))}
      {groups.cand.map((g) => (
        <CandidateRow
          key={g.name}
          name={g.name}
          qty={g.qty}
          conf={g.conf}
          photoUrl={urls[g.refs[0].r.id]}
          box={g.refs[0].det.box}
          onSkip={() => decideGroup(g.refs, "skipped")}
          onSave={async (name, qty, image) => {
            const byRow = new Map<string, { r: ScanRow; idxs: number[] }>();
            g.refs.forEach(({ r, i }) => {
              const e = byRow.get(r.id) ?? { r, idxs: [] };
              e.idxs.push(i);
              byRow.set(r.id, e);
            });
            const [head, ...rest] = [...byRow.values()];
            const ok = await onSaveCandidate(head.r, head.idxs, name, qty, image);
            if (ok) for (const e of rest) await onDecide(e.r, e.idxs, "saved");
          }}
        />
      ))}
      {groups.low > 0 && <p className="mt-2 text-[12px] text-[#9AA1AC]">신뢰도 65% 미만 {groups.low}개는 추가하지 않았습니다.</p>}
      {rows.length === 0 && <p className="text-[13px] text-[#6B7280]">분석이 끝난 사진이 없습니다.</p>}
    </div>
  );
}

function CheckRow({ name, qty, conf, onAdd, onSkip }: { name: string; qty: number; conf: number; onAdd: (q: number) => Promise<void>; onSkip: () => Promise<void> }) {
  const [q, setQ] = useState(qty);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#FFF8EA] p-2">
      <AlertTriangle className="h-5 w-5 shrink-0 text-[#B26A00]" />
      <div className="min-w-0 flex-1">
        <b className="text-[14px]">{name}</b>
        <span className="ml-1 text-[12px] text-[#B26A00]">확인 필요 {Math.round(conf * 100)}%</span>
      </div>
      <input type="number" min={1} max={30} value={q} onChange={(e) => setQ(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} className="w-12 rounded-lg border px-1 py-1 text-center text-[14px]" aria-label="수량" />
      <button disabled={busy} onClick={async () => { setBusy(true); await onAdd(q); setBusy(false); }} className="rounded-lg bg-[#2A6FD6] px-2.5 py-1.5 text-[13px] font-bold text-white">추가</button>
      <button disabled={busy} onClick={async () => { setBusy(true); await onSkip(); setBusy(false); }} className="rounded-lg border px-2 py-1.5 text-[13px] font-bold">제외</button>
    </div>
  );
}

function CandidateRow({
  name: initial,
  qty,
  conf,
  photoUrl,
  box,
  onSave,
  onSkip,
}: {
  name: string;
  qty: number;
  conf: number;
  photoUrl?: string;
  box: ScanDetection["box"];
  onSave: (name: string, qty: number, image: string) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const [name, setName] = useState(initial);
  const [q, setQ] = useState(qty);
  const [crop, setCrop] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!photoUrl) return;
    cropFromUrl(photoUrl, box).then(setCrop).catch(() => setErr("사진 영역을 잘라내지 못했습니다."));
  }, [photoUrl, box]);
  return (
    <div className="mt-2 rounded-xl border border-dashed border-[#2A6FD6] bg-[#F4F8FE] p-2">
      <p className="mb-1 text-[12px] font-bold text-[#2A6FD6]">새 품목 후보 · 신뢰도 {Math.round(conf * 100)}%</p>
      <div className="flex items-center gap-2">
        {crop ? <img src={crop} alt={name} className="h-16 w-16 rounded-lg object-cover bg-white" /> : <div className="h-16 w-16 rounded-lg bg-[#EEF2F7]" />}
        <div className="flex-1 space-y-1">
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} className="w-full rounded-lg border px-2 py-1 text-[14px]" aria-label="품목 이름" />
          <div className="flex items-center gap-1">
            <span className="text-[12px]">수량</span>
            <input type="number" min={1} max={30} value={q} onChange={(e) => setQ(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} className="w-14 rounded-lg border px-1 py-1 text-center text-[14px]" aria-label="수량" />
          </div>
        </div>
      </div>
      {err && <p className="mt-1 text-[12px] text-[#C62828]">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button
          disabled={busy || !crop || name.trim().length < 2}
          onClick={async () => {
            if (!crop) return;
            setBusy(true);
            await onSave(name.trim(), q, crop);
            setBusy(false);
          }}
          className="flex-1 rounded-lg bg-[#2A6FD6] py-2 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {busy ? "저장 중…" : "업체 품목으로 저장"}
        </button>
        <button disabled={busy} onClick={async () => { setBusy(true); await onSkip(); setBusy(false); }} className="rounded-lg border px-3 py-2 text-[13px] font-bold">제외</button>
      </div>
    </div>
  );
}
