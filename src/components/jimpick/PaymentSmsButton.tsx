import { useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { preparePaymentSms } from "@/lib/payment-sms.functions";
import { createComposerGate, intakeSmsHref } from "@/lib/intake-sms";
import { hasSmsApp } from "@/lib/sms";

export function PaymentSmsButton({ estimateId, receiptId }: { estimateId: string; receiptId?: string }) {
  const gate = useRef(createComposerGate());
  const [busy, setBusy] = useState(false);
  return <Button variant="outline" className="mt-2 w-full" disabled={busy} onClick={async () => {
    setBusy(true);
    try {
      await gate.current(async () => {
        const message = await preparePaymentSms({ data: { estimateId, receiptId } });
        const href = intakeSmsHref(message.phone,message.body);
        if (!hasSmsApp()) { await navigator.clipboard.writeText(message.body); toast.info("문자 내용을 복사했습니다"); return null; }
        return href;
      }, (href) => { window.location.href = href; });
    } catch (error) { toast.error(error instanceof Error ? error.message : "문자 내용을 불러오지 못했습니다."); }
    finally { setBusy(false); }
  }}><MessageSquare className="size-4" />고객 결제 문자 보내기</Button>;
}