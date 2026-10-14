CREATE OR REPLACE FUNCTION public.soft_delete_estimate_with_intake(_estimate_id text, _source text DEFAULT 'unknown', _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb; v_owner uuid; v_ids jsonb;
BEGIN
  res := public.soft_delete_estimate(_estimate_id, _source, _reason);
  IF coalesce((res->>'ok')::boolean, false) IS NOT TRUE THEN RETURN res; END IF;
  v_owner := (res->>'owner_id')::uuid;
  -- 같은 견적 ID에 연결된 사전 요청만 (이름·날짜로 찾지 않음): 방문 일정 비우고 요청 취소
  WITH u AS (
    UPDATE public.intake_requests
       SET status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()),
           visit_date = NULL, visit_time = NULL, visit_status = 'none', visit_memo = NULL,
           visit_sms_opened_at = NULL, visit_sms_confirmed_at = NULL, visit_customer_confirmed_at = NULL
     WHERE company_id = v_owner AND estimate_id = _estimate_id
    RETURNING id)
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM u;
  RETURN res || jsonb_build_object('intake_ids', v_ids);
END $$;
REVOKE ALL ON FUNCTION public.soft_delete_estimate_with_intake(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_estimate_with_intake(text, text, text) TO authenticated;