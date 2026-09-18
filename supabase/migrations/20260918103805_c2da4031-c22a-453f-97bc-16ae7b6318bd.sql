-- 오류 기록: 업체는 기록만 남기고 조회·수정은 최고관리자 전용
DROP POLICY IF EXISTS "own error logs readable" ON public.error_logs;
DROP POLICY IF EXISTS "own error logs updatable" ON public.error_logs;
CREATE POLICY "super admin reads error logs" ON public.error_logs
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin updates error logs" ON public.error_logs
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 평수별 기본품목: 읽기는 모든 로그인 사용자, 수정은 최고관리자 전용 (기존 데이터는 유지)
DROP POLICY IF EXISTS "own size presets select" ON public.company_size_presets;
DROP POLICY IF EXISTS "own size presets insert" ON public.company_size_presets;
DROP POLICY IF EXISTS "own size presets update" ON public.company_size_presets;
DROP POLICY IF EXISTS "own size presets delete" ON public.company_size_presets;
CREATE POLICY "authenticated reads size presets" ON public.company_size_presets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin inserts size presets" ON public.company_size_presets
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "super admin updates size presets" ON public.company_size_presets
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()) AND auth.uid() = user_id)
  WITH CHECK (public.is_super_admin(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "super admin deletes size presets" ON public.company_size_presets
  FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()) AND auth.uid() = user_id);