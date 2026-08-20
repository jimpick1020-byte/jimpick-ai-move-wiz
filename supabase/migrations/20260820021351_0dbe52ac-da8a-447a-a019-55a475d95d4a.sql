ALTER TABLE public.terms_acceptances
  ADD COLUMN IF NOT EXISTS estimate_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS reservation_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS user_agent TEXT;