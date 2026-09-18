-- 1) 확정 주체 기록 컬럼 (기존 행은 고객 확정으로 유지)
ALTER TABLE public.terms_acceptances
  ADD COLUMN IF NOT EXISTS confirmed_by text NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS confirmed_by_user_id uuid;

-- 2) 고객 확정 — 하루 2건 상한 제거 (같은 견적서 중복만 방지)
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

  -- 같은 링크로 두 번 눌러도 한 건만 남습니다
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
    t.sent_at, t.sent_msg_id, _estimate_snapshot, _user_agent, 'confirmed',
    'customer'
  )
  ON CONFLICT (estimate_terms_id) DO NOTHING;

  SELECT accepted_at INTO existing
    FROM public.terms_acceptances
   WHERE estimate_terms_id = t.id;

  RETURN jsonb_build_object('ok', true, 'accepted_at', coalesce(existing.accepted_at, now_ts));
END;
$function$;

-- 3) 업체(사장님) 직접 계약완료 처리
CREATE OR REPLACE FUNCTION public.owner_confirm_contract(
  _estimate_id text,
  _move_date text,
  _customer_name text,
  _total integer,
  _sheet_no text,
  _sheet_version integer,
  _estimate_snapshot text,
  _contact_phone text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  t record;
  existing record;
  now_ts timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_auth');
  END IF;
  IF _estimate_id IS NULL OR length(trim(_estimate_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_estimate');
  END IF;
  IF _move_date IS NULL OR length(trim(_move_date)) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_move_date');
  END IF;

  -- 같은 견적을 동시에 두 번 눌러도 한 건만 만들어지도록 견적 단위로 잠급니다
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || _estimate_id, 0));

  -- 내 업체의 해당 견적서(최신 차수)를 찾습니다
  SELECT id, estimate_id, sheet_version, terms_name, terms_version, terms_effective_at,
         sent_at, sent_msg_id
    INTO t
    FROM public.estimate_terms
   WHERE user_id = v_uid AND estimate_id = _estimate_id
   ORDER BY sheet_version DESC, created_at DESC
   LIMIT 1;

  IF t.id IS NULL THEN
    -- 약관 문자를 보내지 않은 견적도 사장님이 계약완료할 수 있게 계약 기준 행을 만듭니다
    INSERT INTO public.estimate_terms (
      user_id, estimate_id, sheet_no, sheet_version, customer_name, move_date, total,
      contact_phone, terms_name, terms_version, access_token, sheet_snapshot
    ) VALUES (
      v_uid, _estimate_id, _sheet_no, coalesce(_sheet_version, 1),
      coalesce(_customer_name, ''), left(_move_date, 10), coalesce(_total, 0),
      _contact_phone, '업체 확정(약관 미발송)', 'owner-confirm',
      encode(gen_random_bytes(24), 'hex'), _estimate_snapshot
    )
    RETURNING id, estimate_id, sheet_version, terms_name, terms_version, terms_effective_at,
              sent_at, sent_msg_id
      INTO t;
  ELSE
    -- 이사 날짜·금액·고객명은 최신 견적 내용으로 맞춰 둡니다 (기존 값 삭제 없음)
    UPDATE public.estimate_terms
       SET move_date = left(_move_date, 10),
           customer_name = coalesce(nullif(trim(_customer_name), ''), customer_name),
           total = coalesce(_total, total),
           sheet_no = coalesce(_sheet_no, sheet_no),
           sheet_snapshot = coalesce(_estimate_snapshot, sheet_snapshot),
           contact_phone = coalesce(_contact_phone, contact_phone),
           updated_at = now()
     WHERE id = t.id;
  END IF;

  SELECT accepted_at, confirmed_by INTO existing
    FROM public.terms_acceptances
   WHERE estimate_terms_id = t.id;
  IF existing.accepted_at IS NOT NULL THEN
    -- 이미 확정된 계약이면 취소 상태만 되살리고 중복 생성은 하지 않습니다
    UPDATE public.terms_acceptances
       SET reservation_status = 'confirmed'
     WHERE estimate_terms_id = t.id AND coalesce(reservation_status, 'confirmed') = 'canceled';
    RETURN jsonb_build_object('ok', true, 'duplicate', true,
      'terms_id', t.id, 'accepted_at', existing.accepted_at,
      'confirmed_by', coalesce(existing.confirmed_by, 'customer'),
      'move_date', left(_move_date, 10));
  END IF;

  INSERT INTO public.terms_acceptances (
    estimate_terms_id, user_id, estimate_id, sheet_version,
    terms_name, terms_version, terms_effective_at, terms_snapshot,
    accepted, accepted_at, accept_method, sent_at, sent_msg_id,
    estimate_snapshot, reservation_status, confirmed_by, confirmed_by_user_id
  ) VALUES (
    t.id, v_uid, t.estimate_id, t.sheet_version,
    t.terms_name, t.terms_version, t.terms_effective_at,
    '업체 사장님이 직접 계약완료 처리한 건입니다(고객 웹 동의 없음).',
    true, now_ts, 'owner_confirm', t.sent_at, t.sent_msg_id,
    _estimate_snapshot, 'confirmed', 'company_admin', v_uid
  )
  ON CONFLICT (estimate_terms_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'terms_id', t.id, 'accepted_at', now_ts,
    'confirmed_by', 'company_admin', 'move_date', left(_move_date, 10));
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_confirm_contract(text, text, text, integer, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_confirm_contract(text, text, text, integer, text, integer, text, text) TO authenticated, service_role;