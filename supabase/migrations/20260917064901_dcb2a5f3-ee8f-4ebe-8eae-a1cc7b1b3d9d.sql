DROP POLICY IF EXISTS "own error logs readable" ON public.error_logs;

CREATE POLICY "own error logs readable" ON public.error_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);