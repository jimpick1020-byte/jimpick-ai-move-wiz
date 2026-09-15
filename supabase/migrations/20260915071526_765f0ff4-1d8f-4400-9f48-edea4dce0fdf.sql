-- ===== 1. 무료 문자 사용량 =====
CREATE TABLE public.sms_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  free_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sms_usage TO authenticated;
GRANT ALL ON public.sms_usage TO service_role;
ALTER TABLE public.sms_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms_usage_select_own_or_super" ON public.sms_usage
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE TRIGGER sms_usage_updated_at BEFORE UPDATE ON public.sms_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sms_usage_events (
  idempotency_key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipients integer NOT NULL DEFAULT 1,
  state text NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sms_usage_events_user_idx ON public.sms_usage_events (user_id, created_at DESC);
GRANT SELECT ON public.sms_usage_events TO authenticated;
GRANT ALL ON public.sms_usage_events TO service_role;
ALTER TABLE public.sms_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms_usage_events_select_own_or_super" ON public.sms_usage_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE TRIGGER sms_usage_events_updated_at BEFORE UPDATE ON public.sms_usage_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 2. 재가입 악용 방지 =====
CREATE TABLE public.trial_identities (
  identity_hash text PRIMARY KEY,
  kind text NOT NULL,
  first_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.trial_identities TO service_role;
GRANT SELECT ON public.trial_identities TO authenticated;
ALTER TABLE public.trial_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trial_identities_select_super" ON public.trial_identities
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE TABLE public.trial_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  identity_hash text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trial_reviews_user_idx ON public.trial_reviews (user_id);
GRANT ALL ON public.trial_reviews TO service_role;
GRANT SELECT ON public.trial_reviews TO authenticated;
ALTER TABLE public.trial_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trial_reviews_select_own_or_super" ON public.trial_reviews
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trial_reviews_updated_at BEFORE UPDATE ON public.trial_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 3. 무료 문자 상한 =====
CREATE OR REPLACE FUNCTION public.sms_free_limit()
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT 20 $$;

CREATE OR REPLACE FUNCTION public.sms_quota(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
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

REVOKE ALL ON FUNCTION public.sms_quota(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sms_quota(uuid) TO authenticated, service_role;

-- 발송 직전 원자적 예약: 20건을 절대 넘지 않습니다.
CREATE OR REPLACE FUNCTION public.reserve_free_sms(_user_id uuid, _key text, _count integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  q jsonb;
  v_key text := NULLIF(btrim(COALESCE(_key, '')), '');
  v_cnt integer := GREATEST(1, COALESCE(_count, 1));
  v_limit integer := public.sms_free_limit();
  v_used integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_user');
  END IF;
  IF v_key IS NULL THEN
    v_key := 'auto:' || _user_id::text || ':' || gen_random_uuid()::text;
  END IF;

  q := public.sms_quota(_user_id);
  IF NOT ((q->>'is_admin')::boolean OR (q->>'paid')::boolean OR (q->>'trial_ok')::boolean) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'expired',
      'used', (q->>'free_sms_used')::int, 'limit', v_limit, 'remaining', 0);
  END IF;

  INSERT INTO public.sms_usage (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;

  BEGIN
    INSERT INTO public.sms_usage_events (idempotency_key, user_id, recipients, state)
    VALUES (v_key, _user_id, v_cnt, 'reserved');
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('allowed', false, 'duplicate', true, 'reason', 'duplicate',
      'used', (q->>'free_sms_used')::int, 'limit', v_limit);
  END;

  IF (q->>'limited')::boolean THEN
    UPDATE public.sms_usage
      SET free_used = free_used + v_cnt, updated_at = now()
      WHERE user_id = _user_id AND free_used + v_cnt <= v_limit
      RETURNING free_used INTO v_used;
    IF v_used IS NULL THEN
      DELETE FROM public.sms_usage_events WHERE idempotency_key = v_key;
      RETURN jsonb_build_object('allowed', false, 'reason', 'limit',
        'used', (q->>'free_sms_used')::int, 'limit', v_limit, 'remaining', 0);
    END IF;
  ELSE
    UPDATE public.sms_usage
      SET free_used = free_used + v_cnt, updated_at = now()
      WHERE user_id = _user_id
      RETURNING free_used INTO v_used;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'key', v_key, 'used', v_used,
    'limit', v_limit, 'remaining', GREATEST(0, v_limit - v_used),
    'limited', (q->>'limited')::boolean);
END $$;

REVOKE ALL ON FUNCTION public.reserve_free_sms(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_free_sms(uuid, text, integer) TO service_role;

-- 발송이 실제로 실패했을 때만 예약을 되돌립니다 (실패는 차감하지 않습니다).
CREATE OR REPLACE FUNCTION public.release_free_sms(_user_id uuid, _key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cnt integer;
BEGIN
  DELETE FROM public.sms_usage_events
    WHERE idempotency_key = _key AND user_id = _user_id AND state = 'reserved'
    RETURNING recipients INTO v_cnt;
  IF v_cnt IS NULL THEN
    RETURN jsonb_build_object('released', false);
  END IF;
  UPDATE public.sms_usage
    SET free_used = GREATEST(0, free_used - v_cnt), updated_at = now()
    WHERE user_id = _user_id;
  RETURN jsonb_build_object('released', true, 'count', v_cnt);
END $$;

REVOKE ALL ON FUNCTION public.release_free_sms(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_free_sms(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_free_sms(_user_id uuid, _key text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.sms_usage_events SET state = 'confirmed', updated_at = now()
  WHERE idempotency_key = _key AND user_id = _user_id
$$;

REVOKE ALL ON FUNCTION public.confirm_free_sms(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_free_sms(uuid, text) TO service_role;

-- ===== 4. 재가입 이력 확인 =====
CREATE OR REPLACE FUNCTION public.claim_trial_identity_for(
  _user_id uuid, _business text, _phone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_biz text := NULLIF(regexp_replace(COALESCE(_business, ''), '[^0-9]', '', 'g'), '');
  v_phone text := NULLIF(regexp_replace(COALESCE(_phone, ''), '[^0-9]', '', 'g'), '');
  v_biz_hash text;
  v_phone_hash text;
  v_biz_owner uuid;
  v_phone_owner uuid;
  v_reused boolean := false;
  v_review boolean := false;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  IF v_biz IS NOT NULL AND length(v_biz) <> 10 THEN v_biz := NULL; END IF;
  IF v_phone IS NOT NULL AND length(v_phone) < 10 THEN v_phone := NULL; END IF;

  IF v_biz IS NOT NULL THEN
    v_biz_hash := encode(extensions.digest('jimpick:biz:' || v_biz, 'sha256'), 'hex');
    SELECT first_user_id INTO v_biz_owner FROM public.trial_identities WHERE identity_hash = v_biz_hash;
    IF v_biz_owner IS NULL THEN
      INSERT INTO public.trial_identities (identity_hash, kind, first_user_id)
      VALUES (v_biz_hash, 'business', _user_id) ON CONFLICT DO NOTHING;
    ELSIF v_biz_owner <> _user_id THEN
      v_reused := true;
    END IF;
  END IF;

  IF v_phone IS NOT NULL THEN
    v_phone_hash := encode(extensions.digest('jimpick:phone:' || v_phone, 'sha256'), 'hex');
    SELECT first_user_id INTO v_phone_owner FROM public.trial_identities WHERE identity_hash = v_phone_hash;
    IF v_phone_owner IS NULL THEN
      INSERT INTO public.trial_identities (identity_hash, kind, first_user_id)
      VALUES (v_phone_hash, 'phone', _user_id) ON CONFLICT DO NOTHING;
    ELSIF v_phone_owner <> _user_id THEN
      IF v_biz IS NULL THEN
        -- 사업자번호가 없으면 인증된 휴대전화번호를 보조 기준으로 씁니다.
        v_reused := true;
      ELSIF NOT v_reused THEN
        -- 번호만 같고 사업자번호가 다르면 자동 차단하지 않고 관리자 확인 대상으로 둡니다.
        v_review := true;
      END IF;
    END IF;
  END IF;

  IF v_reused THEN
    -- 무료체험(기간·문자)을 다시 지급하지 않습니다. 유료 구독·결제 정보는 건드리지 않습니다.
    UPDATE public.subscriptions
      SET trial_started_at = COALESCE(trial_started_at, now()),
          trial_ends_at = now(),
          updated_at = now()
      WHERE user_id = _user_id AND plan = 'free' AND status = 'trialing';
    INSERT INTO public.sms_usage (user_id, free_used)
      VALUES (_user_id, public.sms_free_limit())
      ON CONFLICT (user_id) DO UPDATE SET free_used = public.sms_free_limit(), updated_at = now();
  END IF;

  IF v_review THEN
    INSERT INTO public.trial_reviews (user_id, reason, identity_hash, status)
    SELECT _user_id, '휴대전화번호가 기존 가입 업체와 같고 사업자등록번호는 다릅니다. 관리자 확인이 필요합니다.', v_phone_hash, 'pending'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.trial_reviews
      WHERE user_id = _user_id AND identity_hash = v_phone_hash AND status = 'pending'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'trial_reused', v_reused, 'review_needed', v_review);
END $$;

REVOKE ALL ON FUNCTION public.claim_trial_identity_for(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_trial_identity_for(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_trial_identity(_business text, _phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  RETURN public.claim_trial_identity_for(auth.uid(), _business, _phone);
END $$;

REVOKE ALL ON FUNCTION public.claim_trial_identity(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_trial_identity(text, text) TO authenticated, service_role;

-- ===== 5. 신규 가입 처리에 연결 =====
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
    v_now, v_now + interval '7 days',
    v_now, v_now + interval '7 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.sms_usage (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;

  -- 같은 사업자·휴대전화번호로 무료체험을 두 번 받지 못하게 합니다.
  PERFORM public.claim_trial_identity_for(
    NEW.id,
    NEW.raw_user_meta_data ->> 'business_number',
    NEW.raw_user_meta_data ->> 'phone'
  );

  RETURN NEW;
END; $$;