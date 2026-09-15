-- 1) 본인 것만 조회하도록 소유권 검사 추가 (search_path 고정 유지)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_me uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  -- 남의 계정 권한은 조회할 수 없습니다 (최고관리자만 가능)
  IF v_me IS NOT NULL AND _user_id <> v_me THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_me AND role = 'super_admin') THEN
      RETURN false;
    END IF;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
  );
END $$;

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

  -- 다른 업체의 사용량은 볼 수 없습니다 (최고관리자만 예외)
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
      COALESCE(v_sub.trial_started_at, v_sub.current_period_start, v_sub.created_at) + interval '7 days'
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
    'limited', NOT (v_admin OR v_paid)
  );
END $$;

-- 2) 쓰이지 않는 단건 취소 함수는 일반 사용자 실행 권한을 회수합니다
REVOKE EXECUTE ON FUNCTION public.cancel_reservation(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_reservation(uuid) FROM anon;

-- 3) 남은 함수도 anon(비로그인)은 실행할 수 없게 합니다
REVOKE EXECUTE ON FUNCTION public.cancel_reservation_all(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_trial_identity(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sms_quota(uuid) FROM anon;