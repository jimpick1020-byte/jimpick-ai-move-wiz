ALTER TABLE public.estimate_terms
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deletion_source text,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

ALTER TABLE public.estimate_drafts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deletion_source text,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

CREATE INDEX IF NOT EXISTS estimate_terms_user_deleted_idx
  ON public.estimate_terms (user_id, deleted_at);
CREATE INDEX IF NOT EXISTS estimate_drafts_user_deleted_idx
  ON public.estimate_drafts (user_id, deleted_at);

CREATE OR REPLACE FUNCTION public.soft_delete_estimate(
  _estimate_id text,
  _source text DEFAULT 'unknown',
  _reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _owner uuid;
  _already boolean := false;
  _terms int := 0;
  _drafts int := 0;
  _acc int := 0;
  _shares int := 0;
  _reminders int := 0;
BEGIN
  IF _caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_auth');
  END IF;
  IF _estimate_id IS NULL OR length(trim(_estimate_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT user_id INTO _owner
  FROM public.estimate_terms
  WHERE estimate_id = _estimate_id
  ORDER BY created_at
  LIMIT 1;

  IF _owner IS NULL THEN
    SELECT user_id INTO _owner
    FROM public.estimate_drafts
    WHERE estimate_id = _estimate_id
    LIMIT 1;
  END IF;

  IF _owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF _owner <> _caller AND NOT public.is_super_admin(_caller) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.estimate_terms
    WHERE estimate_id = _estimate_id AND user_id = _owner AND deleted_at IS NOT NULL
  ) INTO _already;

  UPDATE public.estimate_terms
     SET deleted_at = now(), deleted_by = _caller,
         deletion_source = _source, deletion_reason = _reason, updated_at = now()
   WHERE estimate_id = _estimate_id AND user_id = _owner AND deleted_at IS NULL;
  GET DIAGNOSTICS _terms = ROW_COUNT;

  UPDATE public.estimate_drafts
     SET deleted_at = now(), deleted_by = _caller,
         deletion_source = _source, deletion_reason = _reason, updated_at = now()
   WHERE estimate_id = _estimate_id AND user_id = _owner AND deleted_at IS NULL;
  GET DIAGNOSTICS _drafts = ROW_COUNT;

  -- 확정 기록(스냅샷)은 분쟁 대비로 남기고 예약 상태만 취소로 바꿉니다.
  UPDATE public.terms_acceptances
     SET reservation_status = 'canceled'
   WHERE estimate_id = _estimate_id AND user_id = _owner
     AND coalesce(reservation_status, 'confirmed') <> 'canceled';
  GET DIAGNOSTICS _acc = ROW_COUNT;

  -- 직원용 공유 링크는 즉시 폐기합니다.
  UPDATE public.estimate_staff_shares
     SET revoked_at = now(), updated_at = now()
   WHERE estimate_id = _estimate_id AND company_id = _owner AND revoked_at IS NULL;
  GET DIAGNOSTICS _shares = ROW_COUNT;

  -- 아직 보내지 않은 이사 안내 문자 예약만 취소합니다(보낸 기록은 남깁니다).
  UPDATE public.move_reminders
     SET status = 'canceled', updated_at = now()
   WHERE estimate_id = _estimate_id AND company_id = _owner
     AND sent_at IS NULL AND status <> 'canceled';
  GET DIAGNOSTICS _reminders = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'already', _already,
    'owner_id', _owner,
    'terms', _terms,
    'drafts', _drafts,
    'acceptances', _acc,
    'shares', _shares,
    'reminders', _reminders
  );
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_estimate(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_estimate(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_estimate(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_estimate(text, text, text) TO service_role;