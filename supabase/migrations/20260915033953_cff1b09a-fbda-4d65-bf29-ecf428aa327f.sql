ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- 기존 체험 중 업체: 시작일 기준 7일로 재계산 (유료 구독 행은 건드리지 않음)
UPDATE public.subscriptions s
SET trial_started_at = COALESCE(s.trial_started_at, s.current_period_start, s.created_at),
    trial_ends_at = COALESCE(s.trial_started_at, s.current_period_start, s.created_at) + interval '7 days',
    current_period_end = COALESCE(s.trial_started_at, s.current_period_start, s.created_at) + interval '7 days'
WHERE s.status = 'trialing' AND s.plan = 'free';

-- 신규 가입자: 가입 시각 + 168시간
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
BEGIN
  INSERT INTO public.profiles (
    id,
    company_name,
    owner_name,
    phone,
    terms_accepted_at,
    privacy_accepted_at,
    marketing_accepted,
    marketing_accepted_at,
    consent_version
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

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

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