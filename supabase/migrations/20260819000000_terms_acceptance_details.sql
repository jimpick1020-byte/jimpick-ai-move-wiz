-- 고객 동의 기록에 세 가지를 더 남깁니다.
--   estimate_snapshot  동의한 그 순간의 견적서 (나중에 견적서를 고쳐도 이건 안 바뀝니다)
--   user_agent         고객이 어떤 기기·브라우저로 눌렀는지 (접속 정보)
--   reservation_status 예약 확정 상태
--
-- 이미 있는 표를 넓히기만 합니다. 새 표를 만들지 않고, 기존 자료도 그대로 둡니다.
-- RLS 정책도 건드리지 않습니다 (업체는 여전히 읽기만 가능 → 대신 동의 불가).
ALTER TABLE public.terms_acceptances
  ADD COLUMN IF NOT EXISTS estimate_snapshot text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS reservation_status text NOT NULL DEFAULT 'confirmed';

COMMENT ON COLUMN public.terms_acceptances.estimate_snapshot IS '동의 당시 견적서 내용 (사후 변경 금지)';
COMMENT ON COLUMN public.terms_acceptances.user_agent IS '고객 접속 정보 (기기·브라우저)';
COMMENT ON COLUMN public.terms_acceptances.reservation_status IS 'confirmed | cancelled';
