CREATE TABLE public.deposit_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimate_id text NOT NULL,
  sheet_no text,
  estimate_version integer NOT NULL DEFAULT 1,
  depositor_name text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  amount integer NOT NULL DEFAULT 0,
  deposited_at timestamp with time zone,
  source text NOT NULL DEFAULT 'sms_paste',
  raw_text text,
  name_matched boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending_review',
  review_note text,
  confirmed_at timestamp with time zone,
  confirmed_by uuid,
  notified_at timestamp with time zone,
  notify_error text,
  dedupe_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposit_records TO authenticated;
GRANT ALL ON public.deposit_records TO service_role;

ALTER TABLE public.deposit_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY deposit_records_select_own ON public.deposit_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY deposit_records_insert_own ON public.deposit_records
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY deposit_records_update_own ON public.deposit_records
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY deposit_records_delete_own ON public.deposit_records
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE UNIQUE INDEX deposit_records_dedupe_idx ON public.deposit_records (user_id, dedupe_key);
CREATE INDEX deposit_records_estimate_idx ON public.deposit_records (user_id, estimate_id);

CREATE TRIGGER deposit_records_updated_at
  BEFORE UPDATE ON public.deposit_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.estimate_terms
  ADD COLUMN IF NOT EXISTS deposit_paid integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid_at timestamp with time zone;