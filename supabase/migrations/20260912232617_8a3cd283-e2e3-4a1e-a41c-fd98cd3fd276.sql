ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_accepted boolean,
  ADD COLUMN IF NOT EXISTS marketing_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    CASE WHEN COALESCE((NEW.raw_user_meta_data ->> 'terms_accepted')::boolean, false) THEN COALESCE((NEW.raw_user_meta_data ->> 'consent_accepted_at')::timestamptz, now()) ELSE NULL END,
    CASE WHEN COALESCE((NEW.raw_user_meta_data ->> 'privacy_accepted')::boolean, false) THEN COALESCE((NEW.raw_user_meta_data ->> 'consent_accepted_at')::timestamptz, now()) ELSE NULL END,
    COALESCE((NEW.raw_user_meta_data ->> 'marketing_accepted')::boolean, false),
    CASE WHEN COALESCE((NEW.raw_user_meta_data ->> 'marketing_accepted')::boolean, false) THEN COALESCE((NEW.raw_user_meta_data ->> 'consent_accepted_at')::timestamptz, now()) ELSE NULL END,
    NEW.raw_user_meta_data ->> 'consent_version'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan, status, price)
  VALUES (NEW.id, 'free', 'trialing', 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END; $function$;