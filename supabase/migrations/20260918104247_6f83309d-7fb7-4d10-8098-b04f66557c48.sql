DROP POLICY IF EXISTS "super admin reads error logs" ON public.error_logs;
DROP POLICY IF EXISTS "super admin updates error logs" ON public.error_logs;
CREATE POLICY "super admin reads error logs" ON public.error_logs
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin')
  );
CREATE POLICY "super admin updates error logs" ON public.error_logs
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin')
  );

DROP POLICY IF EXISTS "super admin inserts size presets" ON public.company_size_presets;
DROP POLICY IF EXISTS "super admin updates size presets" ON public.company_size_presets;
DROP POLICY IF EXISTS "super admin deletes size presets" ON public.company_size_presets;
CREATE POLICY "super admin inserts size presets" ON public.company_size_presets
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin')
  );
CREATE POLICY "super admin updates size presets" ON public.company_size_presets
  FOR UPDATE TO authenticated USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin')
  ) WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin')
  );
CREATE POLICY "super admin deletes size presets" ON public.company_size_presets
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin')
  );