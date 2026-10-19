import { calcDeposit } from "./deposit-rule";
import { remainingPayment } from "./payment-method";

export function customerPaymentDue(total: number, deposit: number, balance: number, status: string) {
  const kind = deposit > 0 ? "balance" as const : "deposit" as const;
  const remaining = remainingPayment(total, deposit, balance);
  const amount = ["completed", "canceled", "refunded"].includes(status) ? 0 : kind === "balance" ? remaining : Math.min(remaining, calcDeposit(total));
  return { kind, amount };
}

export function paymentText(name: string, amount: number, kind: string, confirmed: boolean, completed = false) {
  const label = kind === "balance" ? "잔금" : "예약금";
  const money = `${amount.toLocaleString("ko-KR")}원`;
  return confirmed
    ? `[짐픽] ${name} 고객님, ${label} ${money} 계좌 입금을 확인했습니다.${completed ? " 전액 결제가 완료되었습니다. 감사합니다." : ""}`
    : `[짐픽 입금 알림] ${name} 고객이 ${label} ${money}을 계좌로 입금했다고 신고했습니다. 실제 입금 문자를 확인해 주세요.`;
}