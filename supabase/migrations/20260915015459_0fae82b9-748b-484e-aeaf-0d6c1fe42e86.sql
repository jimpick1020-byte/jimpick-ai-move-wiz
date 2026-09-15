CREATE TABLE IF NOT EXISTS public.billing_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_key text NOT NULL UNIQUE,
  billing_key text NOT NULL,
  card_company text,
  card_number_masked text,
  card_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.billing_keys TO authenticated;
GRANT ALL ON public.billing_keys TO service_role;

ALTER TABLE public.billing_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='billing_keys' AND policyname='billing_keys_select_own') THEN
    CREATE POLICY "billing_keys_select_own" ON public.billing_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS billing_keys_updated_at ON public.billing_keys;
CREATE TRIGGER billing_keys_updated_at BEFORE UPDATE ON public.billing_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS order_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_key text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS fail_reason text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider text;
CREATE UNIQUE INDEX IF NOT EXISTS payments_order_id_key ON public.payments(order_id) WHERE order_id IS NOT NULL;