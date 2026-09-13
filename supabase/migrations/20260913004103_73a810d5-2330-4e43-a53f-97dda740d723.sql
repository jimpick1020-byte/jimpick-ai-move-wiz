ALTER TABLE public.estimate_terms
  ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS terms_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS balance_paid integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_note text,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.estimate_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimate_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, estimate_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_drafts TO authenticated;
GRANT ALL ON public.estimate_drafts TO service_role;

ALTER TABLE public.estimate_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimate_drafts_select_own" ON public.estimate_drafts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "estimate_drafts_insert_own" ON public.estimate_drafts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "estimate_drafts_update_own" ON public.estimate_drafts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "estimate_drafts_delete_own" ON public.estimate_drafts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER estimate_drafts_updated_at BEFORE UPDATE ON public.estimate_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();