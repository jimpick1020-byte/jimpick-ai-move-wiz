-- 1) 관리자 확인 함수를 접근 규칙에서 떼어냅니다: 본인 것만 읽는 규칙으로 단순화
DROP POLICY IF EXISTS roles_select_own_or_super ON public.user_roles;
CREATE POLICY roles_select_own ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS roles_insert_super ON public.user_roles;
DROP POLICY IF EXISTS roles_update_super ON public.user_roles;
DROP POLICY IF EXISTS roles_delete_super ON public.user_roles;

DROP POLICY IF EXISTS sms_usage_select_own_or_super ON public.sms_usage;
CREATE POLICY sms_usage_select_own ON public.sms_usage
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS sms_usage_events_select_own_or_super ON public.sms_usage_events;
CREATE POLICY sms_usage_events_select_own ON public.sms_usage_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS trial_reviews_select_own_or_super ON public.trial_reviews;
CREATE POLICY trial_reviews_select_own ON public.trial_reviews
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS trial_identities_select_super ON public.trial_identities;

-- 2) 예약 취소: 서버(관리 권한)에서만 부르는 전용 함수
CREATE OR REPLACE FUNCTION public.cancel_reservation_all_for(_terms_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_estimate text;
  v_cnt int := 0;
BEGIN
  IF _user_id IS NULL OR _terms_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'canceled', 0, 'reason', 'no_user');
  END IF;

  SELECT estimate_id INTO v_estimate
    FROM public.estimate_terms
   WHERE id = _terms_id AND user_id = _user_id;

  IF v_estimate IS NULL THEN
    UPDATE public.terms_acceptances
       SET reservation_status = 'canceled'
     WHERE estimate_terms_id = _terms_id AND user_id = _user_id;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    RETURN jsonb_build_object('ok', v_cnt > 0, 'canceled', v_cnt);
  END IF;

  UPDATE public.terms_acceptances a
     SET reservation_status = 'canceled'
   WHERE a.user_id = _user_id
     AND a.estimate_terms_id IN (
       SELECT e.id FROM public.estimate_terms e
        WHERE e.user_id = _user_id AND e.estimate_id = v_estimate
     );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'canceled', v_cnt, 'estimate_id', v_estimate);
END $function$;

REVOKE ALL ON FUNCTION public.cancel_reservation_all_for(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_reservation_all_for(uuid, uuid) TO service_role;

-- 3) 로그인 사용자가 직접 부를 수 있었던 권한 상승 계열 함수의 실행 권한 회수
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.sms_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_quota(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.claim_trial_identity(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_trial_identity(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_reservation_all(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_reservation_all(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_reservation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_reservation(uuid) TO service_role;