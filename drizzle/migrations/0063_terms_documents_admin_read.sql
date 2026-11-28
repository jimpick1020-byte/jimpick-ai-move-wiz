DROP POLICY IF EXISTS "terms_docs_select_signed_in" ON public.terms_documents;
CREATE POLICY "terms_docs_select_admins" ON public.terms_documents FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));