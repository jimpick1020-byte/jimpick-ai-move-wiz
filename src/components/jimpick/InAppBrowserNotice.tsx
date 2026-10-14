import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** 고객 화면은 기기·앱의 다크모드와 상관없이 항상 밝은 흰 배경으로 고정합니다. */
export function useForceLightPage() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = { cls: html.className, scheme: html.style.colorScheme, bg: html.style.background, body: document.body.style.background };
    html.classList.remove("dark");
    html.classList.add("jp-force-light");
    html.style.colorScheme = "light";
    html.style.background = "#ffffff";
    document.body.style.background = "#ffffff";
    return () => {
      html.className = prev.cls;
      html.style.colorScheme = prev.scheme;
      html.style.background = prev.bg;
      document.body.style.background = prev.body;
    };
  }, []);
}

function detectInApp(ua: string): "kakao" | "naver" | "other" | null {
  if (/KAKAOTALK/i.test(ua)) return "kakao";
  if (/NAVER\(inapp/i.test(ua)) return "naver";
  if (/(Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp)/i.test(ua)) return "other";
  return null;
}

/** 카카오톡 등 앱 안 브라우저일 때만 「Chrome으로 열기」 안내를 보여 줍니다. 링크는 어느 브라우저에서나 그대로 동작합니다. */
export function InAppBrowserNotice() {
  const [kind, setKind] = useState<ReturnType<typeof detectInApp>>(null);
  const [android, setAndroid] = useState(false);
  const [hide, setHide] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    setKind(detectInApp(ua));
    setAndroid(/Android/i.test(ua));
  }, []);
  if (!kind || hide) return null;
  const url = window.location.href;
  const open = () => {
    if (kind === "kakao") {
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
      return;
    }
    if (android) {
      const u = new URL(url);
      window.location.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`;
    }
  };
  return (
    <div className="sticky top-0 z-50 flex items-center gap-2 border-b bg-card px-4 py-3 text-sm text-foreground">
      <span className="flex-1">
        {android || kind === "kakao" ? "더 편하게 입력하려면 Chrome에서 열어 주세요." : "오른쪽 아래 메뉴에서 「Safari로 열기」를 눌러 주세요."}
      </span>
      {(android || kind === "kakao") && <Button size="sm" onClick={open}>Chrome으로 열기</Button>}
      <Button size="sm" variant="ghost" onClick={() => setHide(true)}>닫기</Button>
    </div>
  );
}
