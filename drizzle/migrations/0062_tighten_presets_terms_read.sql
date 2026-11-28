DROP POLICY IF EXISTS "authenticated reads size presets" ON public.company_size_presets;
CREATE POLICY "owner or common size presets readable" ON public.company_size_presets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(user_id));
DROP POLICY IF EXISTS "terms_docs_select_all" ON public.terms_documents;
CREATE POLICY "terms_docs_select_signed_in" ON public.terms_documents
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.terms_documents FROM anon;