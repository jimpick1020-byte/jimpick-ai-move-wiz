CREATE TABLE public.company_sms_senders (
  company_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_number text NOT NULL CHECK (sender_number ~ '^0[0-9]{8,10}$'),
  approved_at timestamptz NOT NULL,
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  provider text NOT NULL DEFAULT 'aligo' CHECK (provider = 'aligo'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_sms_senders TO authenticated;
GRANT ALL ON public.company_sms_senders TO service_role;
ALTER TABLE public.company_sms_senders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Companies can see their approved SMS sender" ON public.company_sms_senders FOR SELECT TO authenticated USING (company_id = auth.uid());
CREATE TRIGGER company_sms_senders_updated_at BEFORE UPDATE ON public.company_sms_senders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();