-- 1) 지정자 기록 컬럼
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS created_by uuid;

-- 2) 한 사용자 = 기본 역할 1개 (중복이 있으면 가장 오래된 것만 남김)
DELETE FROM public.user_roles r
USING public.user_roles keep
WHERE r.user_id = keep.user_id
  AND keep.created_at <= r.created_at
  AND keep.id <> r.id
  AND (keep.created_at < r.created_at OR keep.id < r.id);

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_key ON public.user_roles (user_id);

-- 3) 기존 일반 계정 -> subscriber
UPDATE public.user_roles SET role = 'subscriber' WHERE role = 'user';

-- 4) 개발자 계정 1개만 super_admin
INSERT INTO public.user_roles (user_id, role, created_by)
VALUES ('046d8b75-90a3-40c2-8f5c-6881b56f9145', 'super_admin', '046d8b75-90a3-40c2-8f5c-6881b56f9145')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin', created_by = EXCLUDED.created_by;

-- 5) 최고관리자 확인 함수 (RLS를 우회해 안전하게 확인)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

-- 6) 접근 규칙 재정비
DROP POLICY IF EXISTS roles_select_own ON public.user_roles;
DROP POLICY IF EXISTS roles_insert_admin ON public.user_roles;
DROP POLICY IF EXISTS roles_update_admin ON public.user_roles;
DROP POLICY IF EXISTS roles_delete_admin ON public.user_roles;

CREATE POLICY roles_select_own_or_super ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY roles_insert_super ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY roles_update_super ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY roles_delete_super ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 7) 신규 가입자는 subscriber + 7일 체험
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_now timestamptz := now();
BEGIN
  INSERT INTO public.profiles (
    id, company_name, owner_name, phone,
    terms_accepted_at, privacy_accepted_at,
    marketing_accepted, marketing_accepted_at, consent_version
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'company_name',
    NEW.raw_user_meta_data ->> 'owner_name',
    NEW.raw_user_meta_data ->> 'phone',
    CASE WHEN COALESCE((NEW.raw_user_meta_data ->> 'terms_accepted')::boolean, false) THEN COALESCE((NEW.raw_user_meta_data ->> 'consent_accepted_at')::timestamptz, v_now) ELSE NULL END,
    CASE WHEN COALESCE((NEW.raw_user_meta_data ->> 'privacy_accepted')::boolean, false) THEN COALESCE((NEW.raw_user_meta_data ->> 'consent_accepted_at')::timestamptz, v_now) ELSE NULL END,
    COALESCE((NEW.raw_user_meta_data ->> 'marketing_accepted')::boolean, false),
    CASE WHEN COALESCE((NEW.raw_user_meta_data ->> 'marketing_accepted')::boolean, false) THEN COALESCE((NEW.raw_user_meta_data ->> 'consent_accepted_at')::timestamptz, v_now) ELSE NULL END,
    NEW.raw_user_meta_data ->> 'consent_version'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'subscriber')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.subscriptions (
    user_id, plan, status, price,
    current_period_start, current_period_end,
    trial_started_at, trial_ends_at
  )
  VALUES (
    NEW.id, 'free', 'trialing', 0,
    v_now, v_now + interval '7 days',
    v_now, v_now + interval '7 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END; $function$;