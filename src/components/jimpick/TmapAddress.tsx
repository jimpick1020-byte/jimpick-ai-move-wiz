import { useRef, useState } from "react";
import { Navigation } from "lucide-react";
import { baseAddress, navPlatform, tmapUrl, TMAP_ANDROID_STORE, TMAP_IOS_STORE } from "@/lib/tmap-nav";

/** 주소 글자는 그대로 두고, 누르면 티맵 길안내(현재 위치 → 이 주소)를 엽니다. */
export function TmapAddress({ label, address, x, y, children, className = "" }: {
  label: string; address?: string | null; x?: number | null; y?: number | null;
  children: React.ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const last = useRef(0);
  const url = tmapUrl(address, x, y);
  const name = baseAddress(address);
  if (!url) return <div className={className}>{children}</div>;
  const go = () => {
    const now = Date.now();
    if (now - last.current < 1500) return;
    last.current = now;
    setCopied(false);
    const platform = navPlatform(navigator.userAgent);
    if (platform !== "desktop") window.location.href = url;
    setOpen(true);
  };
  const platform = typeof navigator === "undefined" ? "desktop" : navPlatform(navigator.userAgent);
  return (
    <div className={className}>
      <button type="button" onClick={go} aria-label={`${label} ${name} 티맵 길안내 열기`}
        className="-my-1 flex min-h-[44px] w-full items-center gap-1 text-left">
        <span className="min-w-0 flex-1">{children}</span>
        <Navigation aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>
      {open && (
        <div role="group" aria-label="티맵 대안" className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="opacity-70">{platform === "desktop" ? "휴대폰 티맵에서 열 수 있어요" : "티맵이 안 열리면"}</span>
          <button type="button" className="min-h-[36px] rounded-md border px-2" onClick={async () => {
            try { await navigator.clipboard.writeText(name); setCopied(true); } catch { setCopied(false); }
          }}>{copied ? "복사됨" : "주소 복사"}</button>
          {platform !== "desktop" && (
            <a className="flex min-h-[36px] items-center rounded-md border px-2" href={platform === "ios" ? TMAP_IOS_STORE : TMAP_ANDROID_STORE} target="_blank" rel="noreferrer">티맵 설치</a>
          )}
          <button type="button" className="min-h-[36px] px-1 opacity-60" aria-label="닫기" onClick={() => setOpen(false)}>✕</button>
        </div>
      )}
    </div>
  );
}
