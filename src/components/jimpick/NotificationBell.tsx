/**
 * 사장님 알림함 — 예약금·잔금 입금, 사전정보 요청 같은 실제 새 일을 보여 줍니다.
 * 알림을 누르면 그 알림만 읽음 처리하고 관련 견적·요청으로 이동합니다 (입금 확정과는 별개).
 */
import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { deleteOwnerNotifications, listOwnerNotifications, markOwnerNotificationRead, type OwnerNotice } from "@/lib/notifications.functions";
import { currentPushState, enablePush, type PushState } from "@/lib/push-client";
import { updateAppBadge } from "@/lib/app-badge";

export type NoticeTarget = { kind: string; estimateId?: string; intakeId?: string };

const PUSH_COPY: Record<PushState, string> = {
  on: "이 휴대폰에서 앱을 닫아도 알림을 받습니다.",
  off: "앱을 닫아도 알림을 받으려면 알림을 켜 주세요.",
  denied: "알림이 차단되어 있습니다. 휴대폰 브라우저의 사이트 설정에서 알림을 허용해 주세요.",
  unsupported: "이 브라우저는 알림을 지원하지 않습니다. 홈 화면에 설치한 앱에서 켜 주세요.",
  "open-in-app": "홈 화면에 설치한 견적잇 앱(또는 게시된 사이트)에서 알림을 켤 수 있습니다.",
};

export function NotificationBell({ onOpenTarget }: { onOpenTarget: (target: NoticeTarget) => void }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<OwnerNotice[]>([]);
  const [push, setPush] = useState<PushState>("off");
  const [pushBusy, setPushBusy] = useState(false);

  const load = useCallback(() => {
    listOwnerNotifications()
      .then((r) => { setUnread(r.unread); setItems(r.items); updateAppBadge(r.unread); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    void currentPushState().then(setPush).catch(() => {});
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("jimpick:payment-updated", load);
    const timer = window.setInterval(onVisible, 20000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("jimpick:payment-updated", load);
      window.clearInterval(timer);
    };
  }, [load]);

  // 휴대폰 알림을 눌러 들어온 경우 — 그 알림만 읽음 처리하고 이동합니다.
  useEffect(() => {
    const url = new URL(window.location.href);
    const kind = url.searchParams.get("notice");
    if (!kind) return;
    const nid = url.searchParams.get("nid");
    const target: NoticeTarget = { kind, estimateId: url.searchParams.get("estimate") ?? undefined, intakeId: url.searchParams.get("intake") ?? undefined };
    for (const key of ["notice", "nid", "estimate", "intake"]) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url.pathname + (url.search ? url.search : "") + url.hash);
    if (nid && /^[0-9a-f-]{36}$/i.test(nid)) {
      void markOwnerNotificationRead({ data: { id: nid } }).then((r) => { if (r.ok) { setUnread(r.unread); updateAppBadge(r.unread); load(); } }).catch(() => {});
    }
    onOpenTarget(target);
    // 처음 들어올 때 한 번만 처리합니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNotice = async (notice: OwnerNotice) => {
    setOpen(false);
    if (!notice.readAt) {
      const r = await markOwnerNotificationRead({ data: { id: notice.id } }).catch(() => null);
      if (r?.ok) { setUnread(r.unread); updateAppBadge(r.unread); }
      load();
    }
    onOpenTarget(notice.kind === "intake" ? { kind: notice.kind, intakeId: notice.refId } : { kind: notice.kind, estimateId: notice.refId });
  };

  const [deleting, setDeleting] = useState(false);
  // 삭제는 알림 목록에서만 숨깁니다 — 입금 확정·결제·요청 자료는 바꾸지 않습니다.
  const removeNotices = async (payload: { ids?: string[]; unreadOnly?: boolean }, done: string) => {
    setDeleting(true);
    try {
      const r = await deleteOwnerNotifications({ data: payload });
      if (!r.ok) { toast.error("알림을 삭제하지 못했습니다. 다시 시도해 주세요."); return; }
      setUnread(r.unread); updateAppBadge(r.unread);
      setItems((prev) => payload.ids ? prev.filter((n) => !payload.ids!.includes(n.id)) : prev.filter((n) => n.readAt));
      toast.success(done);
      load();
    } catch {
      toast.error("알림을 삭제하지 못했습니다. 다시 시도해 주세요.");
    } finally { setDeleting(false); }
  };
  const removeAllUnread = () => {
    if (unread === 0) return;
    if (!window.confirm(`미확인 알림 ${unread}건을 모두 삭제할까요?\n입금·결제 기록은 그대로 남습니다.`)) return;
    void removeNotices({ unreadOnly: true }, "미확인 알림을 삭제했습니다");
  };

  const turnOnPush = async () => {
    setPushBusy(true);
    try {
      const state = await enablePush();
      setPush(state);
      if (state === "on") toast.success("알림을 켰습니다");
      else toast.error(PUSH_COPY[state]);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "알림을 켜지 못했습니다");
    } finally { setPushBusy(false); }
  };

  return <>
    <Button type="button" variant="outline" size="icon" className="relative size-10 rounded-full" aria-label={`알림 ${unread}건 미확인`} onClick={() => { setOpen(true); load(); }}>
      <Bell className="size-5" />
      {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 h-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-black text-destructive-foreground tabular-nums" data-unread-count>{unread > 99 ? "99+" : unread}</span>}
    </Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader><SheetTitle>알림 · 미확인 {unread}건</SheetTitle></SheetHeader>
        <div className="mt-3 rounded-xl border p-3 text-sm">
          <p className="text-muted-foreground">{PUSH_COPY[push]}</p>
          {push !== "on" && push !== "unsupported" && <Button type="button" className="mt-2 w-full" disabled={pushBusy || push === "denied"} onClick={() => void turnOnPush()}>{pushBusy ? "켜는 중…" : "휴대폰 알림 켜기"}</Button>}
        </div>
        {unread > 0 && <Button type="button" variant="outline" className="mt-3 w-full border-destructive text-destructive" disabled={deleting} onClick={removeAllUnread}>{deleting ? "삭제 중…" : `미확인 알림 ${unread}건 모두 삭제`}</Button>}
        <ul className="mt-3 space-y-2">
          {items.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">새 알림이 없습니다.</li>}
          {items.map((n) => <li key={n.id} className="relative">
            <button type="button" aria-label="이 알림 삭제" disabled={deleting} onClick={() => void removeNotices({ ids: [n.id] }, "알림을 삭제했습니다")} className="absolute right-1 top-1 z-10 grid size-10 place-items-center rounded-full text-muted-foreground active:bg-muted">
              <X className="size-5" />
            </button>
            <button type="button" onClick={() => void openNotice(n)} className={`w-full rounded-xl border p-3 pr-12 text-left ${n.readAt ? "opacity-60" : "border-primary"}`}>
              <div className="flex items-center gap-2 text-sm font-black">{!n.readAt && <span className="size-2 rounded-full bg-destructive" />}{n.title}</div>
              <div className="mt-1 text-sm">{n.body}</div>
              <div className="mt-1 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</div>
            </button>
          </li>)}
        </ul>
      </SheetContent>
    </Sheet>
  </>;
}
