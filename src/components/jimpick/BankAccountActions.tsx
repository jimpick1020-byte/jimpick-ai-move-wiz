import { useState } from "react";
import { Check, Copy, ExternalLink, Landmark, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface BankAccountActionsProps {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  className?: string;
}

const bankAppScheme = (bankName: string): string | null => {
  const name = bankName.replace(/\s/g, "").toLowerCase();
  if (name.includes("카카오")) return "kakaobank://";
  if (name.includes("토스")) return "supertoss://";
  if (name.includes("국민") || name.includes("kb")) return "kbbank://";
  if (name.includes("신한")) return "shinhan-sbank://";
  if (name.includes("우리")) return "wooribank://";
  if (name.includes("하나")) return "hanabank://";
  if (name.includes("농협") || name.includes("nh")) return "nhappcash://";
  if (name.includes("기업") || name.includes("ibk")) return "ibkonebank://";
  if (name.includes("부산") || name.includes("경남")) return "bnkbank://";
  return null;
};

export function BankAccountActions({
  bankName,
  accountNumber,
  accountHolder,
  className = "",
}: BankAccountActionsProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(accountNumber);
    } catch {
      const input = document.createElement("textarea");
      input.value = accountNumber;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    toast.success("계좌번호가 복사되었습니다");
  };

  const openBankApp = () => {
    const scheme = bankAppScheme(bankName);
    if (!scheme) {
      void copyAccount();
      return;
    }
    let leftPage = false;
    const onVisibility = () => {
      if (document.hidden) leftPage = true;
    };
    document.addEventListener("visibilitychange", onVisibility, { once: true });
    window.location.href = scheme;
    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (!leftPage && document.visibilityState === "visible") void copyAccount();
    }, 1200);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className={`h-auto min-w-0 justify-end whitespace-normal p-0 text-right font-bold underline decoration-dotted underline-offset-4 ${className}`}
      >
        {accountNumber}
      </Button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end bg-foreground/30" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="입금 계좌 선택"
            className="mx-auto w-full max-w-[430px] rounded-t-2xl bg-background p-4 pb-[max(20px,env(safe-area-inset-bottom))] shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-base font-black text-foreground">
                  <Landmark className="h-5 w-5" /> 입금 계좌
                </div>
                <div className="mt-2 break-all text-lg font-black tabular-nums text-foreground">
                  {bankName} {accountNumber}
                </div>
                {accountHolder && (
                  <div className="mt-1 text-sm font-semibold text-muted-foreground">
                    예금주 {accountHolder}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="닫기"
                onClick={() => setOpen(false)}
              >
                <X />
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-12" onClick={openBankApp}>
                <ExternalLink /> 은행 앱 열기
              </Button>
              <Button type="button" className="h-12" onClick={() => void copyAccount()}>
                {copied ? <Check /> : <Copy />} 계좌번호 복사
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}