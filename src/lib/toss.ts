/**
 * 토스페이먼츠 카드 등록창 띄우기 (화면 쪽).
 *
 * 공개용 클라이언트 키만 사용합니다. 비밀 키는 서버에서만 씁니다.
 */
const SDK_URL = "https://js.tosspayments.com/v1/payment";

interface TossPayment {
  requestBillingAuth: (
    method: "카드",
    options: { customerKey: string; successUrl: string; failUrl: string },
  ) => Promise<void>;
}

type TossFactory = (clientKey: string) => TossPayment;

function loadScript(): Promise<TossFactory> {
  const w = window as unknown as { TossPayments?: TossFactory };
  if (w.TossPayments) return Promise.resolve(w.TossPayments);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    const el = existing ?? document.createElement("script");
    const onLoad = () => {
      const f = (window as unknown as { TossPayments?: TossFactory }).TossPayments;
      if (f) resolve(f);
      else reject(new Error("결제창을 불러오지 못했습니다."));
    };
    el.addEventListener("load", onLoad, { once: true });
    el.addEventListener("error", () => reject(new Error("결제창을 불러오지 못했습니다.")), { once: true });
    if (!existing) {
      el.src = SDK_URL;
      el.async = true;
      document.head.appendChild(el);
    }
  });
}

/** 카드 등록창을 띄웁니다. 등록을 마치면 /billing/callback 으로 돌아옵니다. */
export async function openTossCardRegister(clientKey: string, customerKey: string): Promise<void> {
  const factory = await loadScript();
  const toss = factory(clientKey);
  const base = `${window.location.origin}/billing/callback`;
  await toss.requestBillingAuth("카드", {
    customerKey,
    successUrl: base,
    failUrl: base,
  });
}
