ALTER TABLE public.company_sms_senders
  ADD COLUMN IF NOT EXISTS aligo_status text NOT NULL DEFAULT 'pending' CHECK (aligo_status IN ('pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS aligo_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS aligo_verified_by uuid,
  ADD COLUMN IF NOT EXISTS aligo_last_code integer,
  ADD COLUMN IF NOT EXISTS aligo_last_message text,
  ADD COLUMN IF NOT EXISTS aligo_checked_at timestamptz;
-- 010-7566-2542 는 사장님이 알리고 등록 완료를 직접 확인해 주신 번호입니다.
UPDATE public.company_sms_senders
  SET aligo_status = 'verified', aligo_verified_at = now(), aligo_verified_by = approved_by
  WHERE sender_number = '01075662542';