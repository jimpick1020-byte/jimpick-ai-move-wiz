CREATE TABLE public.bank_sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  dedupe_key text NOT NULL,
  event_id text,
  channel text NOT NULL DEFAULT 'paste' CHECK (channel IN ('paste','forward')),
  sender text,
  raw_text text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  looks_like_deposit boolean NOT NULL DEFAULT false,
  depositor_name text,
  amount integer,
  deposited_at timestamptz,
  bank text,
  match_status text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('matched','review','unmatched','ignored')),
  match_note text,
  candidate_estimate_ids text[] NOT NULL DEFAULT '{}',
  matched_estimate_id text,
  payment_kind text CHECK (payment_kind IS NULL OR payment_kind IN ('deposit','balance')),
  deposit_record_id uuid REFERENCES public.deposit_records(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bank_sms_messages_dedupe_idx ON public.bank_sms_messages (company_id, dedupe_key);
CREATE INDEX bank_sms_messages_company_received_idx ON public.bank_sms_messages (company_id, received_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.bank_sms_messages TO authenticated;
GRANT ALL ON public.bank_sms_messages TO service_role;
ALTER TABLE public.bank_sms_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY bank_sms_messages_select_own ON public.bank_sms_messages FOR SELECT TO authenticated USING (company_id = auth.uid());
CREATE POLICY bank_sms_messages_insert_own ON public.bank_sms_messages FOR INSERT TO authenticated WITH CHECK (company_id = auth.uid());
CREATE POLICY bank_sms_messages_update_own ON public.bank_sms_messages FOR UPDATE TO authenticated USING (company_id = auth.uid()) WITH CHECK (company_id = auth.uid());
CREATE TRIGGER bank_sms_messages_updated_at BEFORE UPDATE ON public.bank_sms_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bank_sms_ingest_tokens (
  company_id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_received_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_sms_ingest_tokens TO authenticated;
GRANT ALL ON public.bank_sms_ingest_tokens TO service_role;
ALTER TABLE public.bank_sms_ingest_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY bank_sms_tokens_select_own ON public.bank_sms_ingest_tokens FOR SELECT TO authenticated USING (company_id = auth.uid());
CREATE POLICY bank_sms_tokens_insert_own ON public.bank_sms_ingest_tokens FOR INSERT TO authenticated WITH CHECK (company_id = auth.uid());
CREATE POLICY bank_sms_tokens_update_own ON public.bank_sms_ingest_tokens FOR UPDATE TO authenticated USING (company_id = auth.uid()) WITH CHECK (company_id = auth.uid());
CREATE POLICY bank_sms_tokens_delete_own ON public.bank_sms_ingest_tokens FOR DELETE TO authenticated USING (company_id = auth.uid());