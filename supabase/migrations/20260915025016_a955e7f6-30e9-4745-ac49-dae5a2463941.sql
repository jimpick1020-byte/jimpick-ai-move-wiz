ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS next_billing_at timestamptz,
  ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS payments_order_id_key
  ON public.payments (order_id)
  WHERE order_id IS NOT NULL;