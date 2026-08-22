CREATE TABLE public.estimate_staff_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id text NOT NULL,
  company_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secure_token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  share_method text NOT NULL DEFAULT 'kakao',
  shared_at timestamp with time zone,
  opened_at timestamp with time zone,
  last_opened_at timestamp with time zone,
  open_count integer NOT NULL DEFAULT 0,
  staff_name text,
  staff_snapshot text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_staff_shares TO authenticated;
GRANT ALL ON public.estimate_staff_shares TO service_role;

ALTER TABLE public.estimate_staff_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_shares_select_own" ON public.estimate_staff_shares
  FOR SELECT TO authenticated
  USING (company_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "staff_shares_insert_own" ON public.estimate_staff_shares
  FOR INSERT TO authenticated
  WITH CHECK (company_id = auth.uid() AND created_by = auth.uid());

CREATE POLICY "staff_shares_update_own" ON public.estimate_staff_shares
  FOR UPDATE TO authenticated
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

CREATE POLICY "staff_shares_delete_own" ON public.estimate_staff_shares
  FOR DELETE TO authenticated
  USING (company_id = auth.uid());

CREATE INDEX estimate_staff_shares_company_estimate_idx
  ON public.estimate_staff_shares (company_id, estimate_id, created_at DESC);

CREATE TRIGGER update_estimate_staff_shares_updated_at
  BEFORE UPDATE ON public.estimate_staff_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();