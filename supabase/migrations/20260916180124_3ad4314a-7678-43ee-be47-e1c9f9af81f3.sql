-- 1. 신규 가입 체험 기간: 7일 → 30일
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    v_now, v_now + interval '30 days',
    v_now, v_now + interval '30 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.sms_usage (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;

  PERFORM public.claim_trial_identity_for(
    NEW.id,
    NEW.raw_user_meta_data ->> 'business_number',
    NEW.raw_user_meta_data ->> 'phone'
  );

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 2. 문자 사용량 조회: 체험 기간은 30일, 체험 중에는 문자 상한 없음 (사용량 기록은 유지)
CREATE OR REPLACE FUNCTION public.sms_quota(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_admin boolean := false;
  v_sub public.subscriptions;
  v_used integer := 0;
  v_paid boolean := false;
  v_trial_ok boolean := false;
  v_trial_end timestamptz;
  v_limit integer := public.sms_free_limit();
  v_now timestamptz := now();
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_user');
  END IF;

  IF v_me IS NOT NULL AND _user_id <> v_me THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_me AND role = 'super_admin') THEN
      RETURN jsonb_build_object('error', 'forbidden');
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'admin')
  ) INTO v_admin;

  SELECT * INTO v_sub FROM public.subscriptions WHERE user_id = _user_id LIMIT 1;
  SELECT COALESCE(free_used, 0) INTO v_used FROM public.sms_usage WHERE user_id = _user_id;
  v_used := COALESCE(v_used, 0);

  IF v_sub.user_id IS NOT NULL THEN
    v_paid := v_sub.plan <> 'free' AND v_sub.status = 'active' AND v_sub.current_period_end > v_now;
    v_trial_end := COALESCE(
      v_sub.trial_ends_at,
      COALESCE(v_sub.trial_started_at, v_sub.current_period_start, v_sub.created_at) + interval '30 days'
    );
    v_trial_ok := v_sub.status = 'trialing' AND v_trial_end > v_now;
  END IF;

  RETURN jsonb_build_object(
    'is_admin', v_admin,
    'paid', v_paid,
    'trial_ok', v_trial_ok,
    'trial_ends_at', v_trial_end,
    'free_sms_used', v_used,
    'free_sms_limit', v_limit,
    'free_sms_remaining', GREATEST(0, v_limit - v_used),
    'limited', NOT (v_admin OR v_paid OR v_trial_ok)
  );
END $$;

REVOKE ALL ON FUNCTION public.sms_quota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sms_quota(uuid) TO authenticated, service_role;

-- 3. 이미 체험 중인 무료 업체도 가입일 기준 30일로 다시 계산 (유료 구독·결제 정보는 변경하지 않음)
UPDATE public.subscriptions
SET trial_ends_at = COALESCE(trial_started_at, current_period_start, created_at) + interval '30 days',
    current_period_end = COALESCE(trial_started_at, current_period_start, created_at) + interval '30 days',
    updated_at = now()
WHERE plan = 'free' AND status = 'trialing';