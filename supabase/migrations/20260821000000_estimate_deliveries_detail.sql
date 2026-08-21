-- 발송내역에 필요한 칸을 더합니다.
--
-- 이미 있는 estimate_deliveries 표를 넓히기만 합니다.
-- 새 표를 만들지 않고, 기존 발송 기록도 그대로 둡니다.
ALTER TABLE public.estimate_deliveries
  ADD COLUMN IF NOT EXISTS estimate_version integer,
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'link',
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'aligo',
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS provider_result jsonb;

COMMENT ON COLUMN public.estimate_deliveries.estimate_version IS '보낸 견적서 차수';
COMMENT ON COLUMN public.estimate_deliveries.delivery_method IS 'link | image | pdf';
COMMENT ON COLUMN public.estimate_deliveries.provider_message_id IS '문자 회사가 준 발송번호';
COMMENT ON COLUMN public.estimate_deliveries.provider_result IS '문자 회사 응답에서 민감정보를 뺀 내용';

-- 같은 견적·같은 차수·같은 열쇠로는 성공 기록이 하나만 남게 합니다
CREATE UNIQUE INDEX IF NOT EXISTS estimate_deliveries_once_idx
  ON public.estimate_deliveries (estimate_id, estimate_version, idempotency_key)
  WHERE status IN ('queued', 'sent') AND idempotency_key IS NOT NULL;
