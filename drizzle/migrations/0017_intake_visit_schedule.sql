ALTER TABLE public.intake_requests
  ADD COLUMN IF NOT EXISTS visit_date date,
  ADD COLUMN IF NOT EXISTS visit_time text,
  ADD COLUMN IF NOT EXISTS visit_status text NOT NULL DEFAULT 'none';
CREATE INDEX IF NOT EXISTS intake_requests_company_visit_idx ON public.intake_requests (company_id, visit_date) WHERE visit_date IS NOT NULL;