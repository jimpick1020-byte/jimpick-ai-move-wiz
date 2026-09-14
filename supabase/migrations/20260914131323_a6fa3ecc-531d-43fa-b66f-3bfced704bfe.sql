CREATE TABLE public.move_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  estimate_id text NOT NULL,
  estimate_terms_id uuid REFERENCES public.estimate_terms(id) ON DELETE CASCADE,
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  move_date text NOT NULL,
  start_time text,
  from_address text,
  company_phone text,
  scheduled_at timestamp with time zone NOT NULL,
  sent_at timestamp with time zone,
  status text NOT NULL DEFAULT 'scheduled',
  aligo_message_id text,
  error_reason text,
  retry_count integer NOT NULL DEFAULT 0,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT move_reminders_status_check CHECK (status IN ('scheduled','sending','success','failed','canceled')),
  CONSTRAINT move_reminders_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE INDEX move_reminders_due_idx ON public.move_reminders (status, scheduled_at);
CREATE INDEX move_reminders_estimate_idx ON public.move_reminders (company_id, estimate_id);

GRANT SELECT ON public.move_reminders TO authenticated;
GRANT ALL ON public.move_reminders TO service_role;

ALTER TABLE public.move_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their reminders"
  ON public.move_reminders FOR SELECT TO authenticated
  USING (auth.uid() = company_id OR auth.uid() = user_id);

CREATE TRIGGER move_reminders_updated_at
  BEFORE UPDATE ON public.move_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_move_reminders(_limit integer DEFAULT 20)
RETURNS SETOF public.move_reminders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT id FROM public.move_reminders
    WHERE status = 'scheduled' AND scheduled_at <= now()
    ORDER BY scheduled_at
    LIMIT GREATEST(1, LEAST(_limit, 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.move_reminders m
  SET status = 'sending', updated_at = now()
  FROM due
  WHERE m.id = due.id
  RETURNING m.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_move_reminders(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_move_reminders(integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_move_reminders(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_move_reminders(integer) TO service_role;