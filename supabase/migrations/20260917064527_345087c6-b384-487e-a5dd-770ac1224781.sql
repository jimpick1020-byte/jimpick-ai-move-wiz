CREATE TABLE public.error_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  screen text NOT NULL,
  kind text NOT NULL DEFAULT 'render',
  message text NOT NULL,
  detail text,
  recovery text NOT NULL DEFAULT 'none',
  attempts integer NOT NULL DEFAULT 0,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamp with time zone,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX error_logs_user_time_idx ON public.error_logs (user_id, occurred_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own error logs readable" ON public.error_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE POLICY "own error logs insertable" ON public.error_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own error logs updatable" ON public.error_logs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);