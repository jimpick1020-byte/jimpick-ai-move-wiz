CREATE OR REPLACE FUNCTION public.cancel_reservation_all(_terms_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_estimate text;
  v_cnt int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'canceled', 0, 'reason', 'no_user');
  END IF;

  SELECT estimate_id INTO v_estimate
    FROM public.estimate_terms
   WHERE id = _terms_id AND user_id = v_uid;

  IF v_estimate IS NULL THEN
    UPDATE public.terms_acceptances
       SET reservation_status = 'canceled'
     WHERE estimate_terms_id = _terms_id AND user_id = v_uid;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    RETURN jsonb_build_object('ok', v_cnt > 0, 'canceled', v_cnt);
  END IF;

  UPDATE public.terms_acceptances a
     SET reservation_status = 'canceled'
   WHERE a.user_id = v_uid
     AND a.estimate_terms_id IN (
       SELECT e.id FROM public.estimate_terms e
        WHERE e.user_id = v_uid AND e.estimate_id = v_estimate
     );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'canceled', v_cnt, 'estimate_id', v_estimate);
END $function$;

REVOKE ALL ON FUNCTION public.cancel_reservation_all(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_reservation_all(uuid) TO authenticated, service_role;