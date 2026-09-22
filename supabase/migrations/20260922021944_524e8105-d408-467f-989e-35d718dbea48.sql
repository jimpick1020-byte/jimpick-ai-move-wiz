ALTER TABLE public.estimate_terms
  ADD COLUMN IF NOT EXISTS calendar_selected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calendar_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calendar_archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS calendar_archived_by uuid,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS estimate_terms_calendar_archived_idx
  ON public.estimate_terms (user_id, calendar_archived, move_date);