CREATE TABLE public.intake_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  source_estimate_id text,
  estimate_id text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','sent','opened','editing','submitted','confirmed','cancelled')),
  expires_at timestamptz NOT NULL,
  submission jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  editing_started_at timestamptz,
  first_submitted_at timestamptz,
  last_submitted_at timestamptz,
  submit_count integer NOT NULL DEFAULT 0,
  consent_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  owner_seen_at timestamptz,
  last_sent_at timestamptz,
  last_send_method text,
  last_send_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, estimate_id)
);
CREATE INDEX intake_requests_company_idx ON public.intake_requests (company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.intake_requests TO authenticated;
GRANT ALL ON public.intake_requests TO service_role;
ALTER TABLE public.intake_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company reads own intake requests" ON public.intake_requests
  FOR SELECT TO authenticated
  USING (company_id = auth.uid() OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Company creates own intake requests" ON public.intake_requests
  FOR INSERT TO authenticated
  WITH CHECK (company_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY "Company updates own intake requests" ON public.intake_requests
  FOR UPDATE TO authenticated
  USING (company_id = auth.uid()) WITH CHECK (company_id = auth.uid());

CREATE TRIGGER intake_requests_updated_at BEFORE UPDATE ON public.intake_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.item_icons
  ADD COLUMN intake_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN intake_disposal_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN intake_rooms text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN intake_sort integer NOT NULL DEFAULT 1000;

ALTER TABLE public.profiles
  ADD COLUMN intake_item_settings jsonb NOT NULL DEFAULT '{}'::jsonb;