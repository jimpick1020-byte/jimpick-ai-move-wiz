-- 고객의 약관 동의는 예약 확정이 아니라 예약 요청으로 기록합니다.
-- 기존 기록은 결제·취소 이력 보존을 위해 변경하지 않습니다.
CREATE OR REPLACE FUNCTION public.confirm_reservation_atomic(
  _terms_id uuid, _terms_snapshot text, _estimate_snapshot text,
  _accept_method text, _token_hint text, _user_agent text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t record;
  existing record;
  now_ts timestamptz := now();
BEGIN
  SELECT id, user_id, estimate_id, sheet_version, terms_name, terms_version,
         terms_effective_at, sent_at, sent_msg_id, move_date
    INTO t
    FROM public.estimate_terms
   WHERE id = _terms_id;
  IF t.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT accepted_at INTO existing
    FROM public.terms_acceptances
   WHERE estimate_terms_id = t.id;
  IF existing.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'accepted_at', existing.accepted_at);
  END IF;

  INSERT INTO public.terms_acceptances (
    estimate_terms_id, user_id, estimate_id, sheet_version,
    terms_name, terms_version, terms_effective_at, terms_snapshot,
    accepted, accepted_at, accept_method, token_hint,
    sent_at, sent_msg_id, estimate_snapshot, user_agent, reservation_status,
    confirmed_by
  ) VALUES (
    t.id, t.user_id, t.estimate_id, t.sheet_version,
    t.terms_name, t.terms_version, t.terms_effective_at, _terms_snapshot,
    true, now_ts, coalesce(_accept_method, 'web_checkbox'), _token_hint,
    t.sent_at, t.sent_msg_id, _estimate_snapshot, _user_agent, 'requested',
    'customer'
  )
  ON CONFLICT (estimate_terms_id) DO NOTHING;

  SELECT accepted_at INTO existing
    FROM public.terms_acceptances
   WHERE estimate_terms_id = t.id;

  RETURN jsonb_build_object('ok', true, 'accepted_at', coalesce(existing.accepted_at, now_ts));
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_reservation_atomic(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_reservation_atomic(uuid, text, text, text, text, text) TO service_role;