ALTER TABLE public.estimate_terms
  ADD COLUMN IF NOT EXISTS contract_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;
ALTER TABLE public.terms_acceptances
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;

CREATE OR REPLACE FUNCTION public.cancel_contract(_terms_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid; v_estimate text;
  v_terms int := 0; v_acc int := 0; v_rem int := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_auth'); END IF;
  SELECT user_id, estimate_id INTO v_owner, v_estimate
    FROM public.estimate_terms WHERE id = _terms_id AND deleted_at IS NULL;
  IF v_owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF v_owner <> v_uid AND NOT public.is_super_admin(v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  UPDATE public.estimate_terms
     SET contract_status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid, updated_at = now()
   WHERE user_id = v_owner AND estimate_id = v_estimate AND contract_status <> 'cancelled';
  GET DIAGNOSTICS v_terms = ROW_COUNT;

  UPDATE public.terms_acceptances
     SET reservation_status = 'canceled', cancelled_at = now(), cancelled_by = v_uid
   WHERE user_id = v_owner AND estimate_id = v_estimate
     AND coalesce(reservation_status, '') <> 'canceled';
  GET DIAGNOSTICS v_acc = ROW_COUNT;

  UPDATE public.move_reminders
     SET status = 'canceled', missed_reason = '계약 취소로 발송하지 않습니다.', updated_at = now()
   WHERE company_id = v_owner AND estimate_id = v_estimate
     AND sent_at IS NULL AND status IN ('scheduled', 'failed', 'unknown');
  GET DIAGNOSTICS v_rem = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'estimate_id', v_estimate,
    'terms', v_terms, 'acceptances', v_acc, 'reminders', v_rem);
END $$;

REVOKE ALL ON FUNCTION public.cancel_contract(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_contract(uuid) TO authenticated;