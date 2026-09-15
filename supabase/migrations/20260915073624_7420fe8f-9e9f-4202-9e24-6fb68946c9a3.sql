CREATE INDEX IF NOT EXISTS estimate_terms_user_movedate_idx ON public.estimate_terms (user_id, move_date);

CREATE OR REPLACE FUNCTION public.confirm_reservation_atomic(
  _terms_id uuid,
  _terms_snapshot text,
  _estimate_snapshot text,
  _accept_method text,
  _token_hint text,
  _user_agent text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  existing record;
  confirmed_count int;
  now_ts timestamptz := now();
  daily_limit int := 2;
BEGIN
  SELECT id, user_id, estimate_id, sheet_version, terms_name, terms_version,
         terms_effective_at, sent_at, sent_msg_id, move_date
    INTO t
    FROM public.estimate_terms
   WHERE id = _terms_id;
  IF t.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- 같은 링크로 두 번 눌러도 한 건만 남습니다
  SELECT accepted_at INTO existing
    FROM public.terms_acceptances
   WHERE estimate_terms_id = t.id;
  IF existing.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'accepted_at', existing.accepted_at);
  END IF;

  IF t.move_date IS NOT NULL AND length(trim(t.move_date)) > 0 THEN
    -- 업체 + 이사 날짜 단위 잠금 (동시 확정 방지)
    PERFORM pg_advisory_xact_lock(
      hashtextextended(t.user_id::text || ':' || left(t.move_date, 10), 0)
    );

    SELECT count(*) INTO confirmed_count
      FROM public.terms_acceptances a
      JOIN public.estimate_terms e ON e.id = a.estimate_terms_id
     WHERE e.user_id = t.user_id
       AND left(e.move_date, 10) = left(t.move_date, 10)
       AND a.accepted_at IS NOT NULL
       AND coalesce(a.reservation_status, 'confirmed') <> 'canceled';

    IF confirmed_count >= daily_limit THEN
      RETURN jsonb_build_object(
        'ok', false, 'reason', 'full',
        'move_date', left(t.move_date, 10), 'confirmed', confirmed_count
      );
    END IF;
  END IF;

  INSERT INTO public.terms_acceptances (
    estimate_terms_id, user_id, estimate_id, sheet_version,
    terms_name, terms_version, terms_effective_at, terms_snapshot,
    accepted, accepted_at, accept_method, token_hint,
    sent_at, sent_msg_id, estimate_snapshot, user_agent, reservation_status
  ) VALUES (
    t.id, t.user_id, t.estimate_id, t.sheet_version,
    t.terms_name, t.terms_version, t.terms_effective_at, _terms_snapshot,
    true, now_ts, coalesce(_accept_method, 'web_checkbox'), _token_hint,
    t.sent_at, t.sent_msg_id, _estimate_snapshot, _user_agent, 'confirmed'
  )
  ON CONFLICT (estimate_terms_id) DO NOTHING;

  SELECT accepted_at INTO existing
    FROM public.terms_acceptances
   WHERE estimate_terms_id = t.id;

  RETURN jsonb_build_object('ok', true, 'accepted_at', coalesce(existing.accepted_at, now_ts));
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_reservation_atomic(uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_reservation_atomic(uuid, text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_reservation_atomic(uuid, text, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_reservation_atomic(uuid, text, text, text, text, text) TO service_role;