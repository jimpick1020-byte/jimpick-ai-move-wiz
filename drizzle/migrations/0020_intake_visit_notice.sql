ALTER TABLE public.intake_requests
  ADD COLUMN IF NOT EXISTS visit_memo text,
  ADD COLUMN IF NOT EXISTS visit_sms_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS visit_sms_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS visit_customer_confirmed_at timestamptz;
GRANT UPDATE (visit_memo, visit_sms_opened_at, visit_sms_confirmed_at, visit_customer_confirmed_at) ON public.intake_requests TO authenticated;