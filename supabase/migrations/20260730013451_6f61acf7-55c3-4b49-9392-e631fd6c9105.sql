-- 1. Explicit admin-only write policies for payments
CREATE POLICY "payments_insert_admin" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "payments_update_admin" ON public.payments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "payments_delete_admin" ON public.payments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Explicit admin-only write policies for user_roles (prevents privilege escalation)
CREATE POLICY "roles_insert_admin" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "roles_update_admin" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "roles_delete_admin" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.payments TO service_role;

-- 3. SECURITY DEFINER functions must not be directly callable by API roles
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
