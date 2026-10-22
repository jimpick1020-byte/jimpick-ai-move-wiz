import { useEffect, useRef, useState } from "react";
import { Copy, Download, MessageSquare, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { canShareIntakeMms, intakeMmsPayload, type IntakeMmsMessage } from "@/lib/intake-mms";
import { intakeSmsHref } from "@/lib/intake-sms";
import { formatTel } from "@/lib/format-input";

export function IntakeMmsComposer({ message, file, imageError, onOpened }: { message: IntakeMmsMessage; file: File | null; imageError: string | null; onOpened: () => void }) {
  const [url, setUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (!file) return;
    const value = URL.createObjectURL(file); setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  const supported = !!file && canShareIntakeMms(navigator, file, message.body);
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("복사했습니다."); }
    catch { toast.error("복사하지 못했습니다. 아래 내용을 길게 눌러 복사해 주세요."); }
  };
  const share = async () => {
    if (!file || !supported || lock.current) return;
    lock.current = true; setSharing(true);
    try { await navigator.share(intakeMmsPayload(file, message.body)); onOpened(); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("그림과 문구를 함께 공유하지 못했습니다. 그림을 저장해 직접 첨부해 주세요."); }
    finally { lock.current = false; setSharing(false); }
  };
  return <section className="space-y-3 border-t border-border pt-4" aria-label="사전정보 그림 문자 준비">
    <div className="flex items-center justify-between gap-2"><span className="select-text font-bold">{formatTel(message.to)}</span><Button variant="outline" size="sm" onClick={() => void copy(message.to)}><Copy className="size-4" />번호 복사</Button></div>
    {url && <img src={url} alt="달력과 초록 캐릭터, 집이 있는 사전정보 안내 그림" className="aspect-[1200/630] w-full object-contain" />}
    {imageError && <p role="alert" className="text-sm text-destructive">{imageError}</p>}
    <div className="select-text whitespace-pre-wrap break-words text-sm">{message.body}</div>
    <Button className="w-full" disabled={!supported || sharing} onClick={() => void share()}><Share2 className="size-4" />{sharing ? "공유 중…" : "그림·문구 공유"}</Button>
    <p className="text-xs text-muted-foreground">{supported ? "문자 앱을 선택한 뒤 그림·링크·받는 번호를 확인하고 보내 주세요. 번호는 자동 입력되지 않을 수 있습니다." : "이 기기는 그림과 문구 동시 공유를 지원하지 않습니다. 그림을 저장한 뒤 문자에 직접 첨부해 주세요."}</p>
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" disabled={!url} onClick={() => { const anchor = document.createElement("a"); anchor.href = url; anchor.download = file?.name ?? "짐픽-사전정보-안내.jpg"; anchor.click(); }}><Download className="size-4" />그림 저장</Button>
      <Button variant="outline" onClick={() => void copy(message.body)}><Copy className="size-4" />문구·링크 복사</Button>
      <Button variant="outline" className="col-span-2" onClick={() => { window.location.href = intakeSmsHref(message.to, message.body); onOpened(); }}><MessageSquare className="size-4" />문자 앱 열기</Button>
    </div>
    <p className="text-xs text-muted-foreground">문자 앱 열기는 그림을 자동 첨부하지 않습니다. 공유하거나 앱을 열어도 발송 완료로 기록하지 않습니다.</p>
  </section>;
}