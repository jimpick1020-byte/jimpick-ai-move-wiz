CREATE OR REPLACE FUNCTION public.soft_delete_estimate(_estimate_id text, _source text DEFAULT 'unknown'::text, _reason text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _owner uuid;
  _owners int := 0;
  _already boolean := false;
  _terms int := 0; _drafts int := 0; _acc int := 0; _shares int := 0; _reminders int := 0;
BEGIN
  IF _caller IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_auth'); END IF;
  IF _estimate_id IS NULL OR length(trim(_estimate_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- 1순위: 로그인한 업체(company_id = user_id) 본인 소유 행
  IF EXISTS (SELECT 1 FROM estimate_terms WHERE estimate_id=_estimate_id AND user_id=_caller)
     OR EXISTS (SELECT 1 FROM estimate_drafts WHERE estimate_id=_estimate_id AND user_id=_caller) THEN
    _owner := _caller;
  ELSE
    SELECT count(DISTINCT u) INTO _owners FROM (
      SELECT user_id u FROM estimate_terms WHERE estimate_id=_estimate_id
      UNION SELECT user_id FROM estimate_drafts WHERE estimate_id=_estimate_id) x;
    IF _owners = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
    IF NOT public.is_super_admin(_caller) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
    END IF;
    IF _owners > 1 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'ambiguous');
    END IF;
    SELECT u INTO _owner FROM (
      SELECT user_id u FROM estimate_terms WHERE estimate_id=_estimate_id
      UNION SELECT user_id FROM estimate_drafts WHERE estimate_id=_estimate_id) x LIMIT 1;
  END IF;

  SELECT EXISTS (SELECT 1 FROM estimate_terms WHERE estimate_id=_estimate_id AND user_id=_owner AND deleted_at IS NOT NULL)
      OR (NOT EXISTS (SELECT 1 FROM estimate_terms WHERE estimate_id=_estimate_id AND user_id=_owner)
          AND EXISTS (SELECT 1 FROM estimate_drafts WHERE estimate_id=_estimate_id AND user_id=_owner AND deleted_at IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM estimate_drafts WHERE estimate_id=_estimate_id AND user_id=_owner AND deleted_at IS NULL))
    INTO _already;

  UPDATE estimate_terms SET deleted_at=now(), deleted_by=_caller, deletion_source=_source, deletion_reason=_reason, updated_at=now()
   WHERE estimate_id=_estimate_id AND user_id=_owner AND deleted_at IS NULL;
  GET DIAGNOSTICS _terms = ROW_COUNT;
  UPDATE estimate_drafts SET deleted_at=now(), deleted_by=_caller, deletion_source=_source, deletion_reason=_reason, updated_at=now()
   WHERE estimate_id=_estimate_id AND user_id=_owner AND deleted_at IS NULL;
  GET DIAGNOSTICS _drafts = ROW_COUNT;
  UPDATE terms_acceptances SET reservation_status='canceled'
   WHERE estimate_id=_estimate_id AND user_id=_owner AND coalesce(reservation_status,'confirmed') <> 'canceled';
  GET DIAGNOSTICS _acc = ROW_COUNT;
  UPDATE estimate_staff_shares SET revoked_at=now(), updated_at=now()
   WHERE estimate_id=_estimate_id AND company_id=_owner AND revoked_at IS NULL;
  GET DIAGNOSTICS _shares = ROW_COUNT;
  UPDATE move_reminders SET status='canceled', updated_at=now()
   WHERE estimate_id=_estimate_id AND company_id=_owner AND sent_at IS NULL AND status <> 'canceled';
  GET DIAGNOSTICS _reminders = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'already', _already, 'owner_id', _owner,
    'terms', _terms, 'drafts', _drafts, 'acceptances', _acc, 'shares', _shares, 'reminders', _reminders);
END;
$function$;