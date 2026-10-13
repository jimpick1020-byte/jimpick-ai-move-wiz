ALTER TABLE public.estimate_drafts ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archive_reason text, ADD COLUMN IF NOT EXISTS archive_restored_at timestamptz;
ALTER TABLE public.estimate_terms ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archive_reason text, ADD COLUMN IF NOT EXISTS archive_restored_at timestamptz;

CREATE OR REPLACE FUNCTION public.estimate_unpaid_notice_due(_user uuid, _est text, _today date)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_date text;
BEGIN
  SELECT t.move_date INTO v_date FROM estimate_terms t
   WHERE t.user_id=_user AND t.estimate_id=_est AND t.deleted_at IS NULL
   ORDER BY t.sheet_version DESC, t.created_at DESC LIMIT 1;
  IF v_date IS NULL OR v_date !~ '^\d{4}-\d{2}-\d{2}' THEN
    SELECT d.payload->>'moveDate' INTO v_date FROM estimate_drafts d
     WHERE d.user_id=_user AND d.estimate_id=_est AND d.deleted_at IS NULL LIMIT 1;
  END IF;
  IF v_date IS NULL OR v_date !~ '^\d{4}-\d{2}-\d{2}' THEN RETURN false; END IF;
  IF left(v_date,10)::date > _today THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM estimate_drafts d WHERE d.user_id=_user AND d.estimate_id=_est AND d.archive_restored_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM estimate_terms t WHERE t.user_id=_user AND t.estimate_id=_est AND (t.archive_restored_at IS NOT NULL
        OR coalesce(t.deposit_paid,0) > 0 OR coalesce(t.balance_paid,0) > 0
        OR t.payment_status IN ('deposit_paid','partial','balance_paid','completed','refunded','canceled')
        OR t.paid_at IS NOT NULL OR t.contract_status = 'cancelled'))
     OR EXISTS (SELECT 1 FROM terms_acceptances a WHERE a.user_id=_user AND a.estimate_id=_est
        AND a.accepted_at IS NOT NULL AND coalesce(a.reservation_status,'') <> 'canceled')
     OR EXISTS (SELECT 1 FROM deposit_records r WHERE r.user_id=_user AND r.estimate_id=_est AND r.status IN ('pending_review','confirmed'))
     OR EXISTS (SELECT 1 FROM payments p WHERE p.order_id = _est AND p.status IN ('done','paid','completed'))
  THEN RETURN false; END IF;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.estimate_unpaid_notice_due(uuid,text,date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.auto_archive_past_estimate_notices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_kst timestamp := now() AT TIME ZONE 'Asia/Seoul';
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  c record; v_cnt int := 0; v_terms int := 0; n int;
BEGIN
  FOR c IN
    SELECT DISTINCT user_id, estimate_id FROM (
      SELECT user_id, estimate_id FROM estimate_drafts WHERE deleted_at IS NULL
        AND (payload->>'moveDate') ~ '^\d{4}-\d{2}-\d{2}' AND left(payload->>'moveDate',10)::date <= v_today
      UNION
      SELECT user_id, estimate_id FROM estimate_terms WHERE deleted_at IS NULL
        AND move_date ~ '^\d{4}-\d{2}-\d{2}' AND left(move_date,10)::date <= v_today
    ) x
  LOOP
    -- 입금 확인과 겹치지 않도록 행을 잠근 뒤 조건을 다시 확인합니다
    PERFORM 1 FROM estimate_terms WHERE user_id=c.user_id AND estimate_id=c.estimate_id FOR UPDATE;
    PERFORM 1 FROM estimate_drafts WHERE user_id=c.user_id AND estimate_id=c.estimate_id FOR UPDATE;
    IF NOT public.estimate_unpaid_notice_due(c.user_id, c.estimate_id, v_today) THEN CONTINUE; END IF;
    UPDATE estimate_drafts SET deleted_at=now(), archived_at=now(), archive_reason='unpaid_on_move_date',
      deletion_source='auto_cleanup_estimate_notice', deletion_reason='이사일까지 예약금 미입금 견적 안내 자동 정리', updated_at=now()
     WHERE user_id=c.user_id AND estimate_id=c.estimate_id AND deleted_at IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    UPDATE estimate_terms SET deleted_at=now(), archived_at=now(), archive_reason='unpaid_on_move_date',
      deletion_source='auto_cleanup_estimate_notice', deletion_reason='이사일까지 예약금 미입금 견적 안내 자동 정리', updated_at=now()
     WHERE user_id=c.user_id AND estimate_id=c.estimate_id AND deleted_at IS NULL;
    GET DIAGNOSTICS v_terms = ROW_COUNT;
    IF n > 0 OR v_terms > 0 THEN v_cnt := v_cnt + 1; END IF;
  END LOOP;
  INSERT INTO reminder_job_runs (job, picked, sent, failed, missed, checked, note)
  VALUES ('auto_cleanup_estimate_notice', v_cnt, 0, 0, 0, v_cnt, format('견적 %s건 자동 정리 (KST %s)', v_cnt, v_kst));
  RETURN v_cnt;
END $$;
REVOKE EXECUTE ON FUNCTION public.auto_archive_past_estimate_notices() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_auto_archived_estimates()
RETURNS TABLE(user_id uuid, company_name text, estimate_id text, customer_name text, move_date text, archived_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT k.user_id, p.company_name, k.estimate_id,
    coalesce((SELECT t.customer_name FROM estimate_terms t WHERE t.user_id=k.user_id AND t.estimate_id=k.estimate_id ORDER BY t.sheet_version DESC LIMIT 1),
             (SELECT d.payload->>'customerName' FROM estimate_drafts d WHERE d.user_id=k.user_id AND d.estimate_id=k.estimate_id LIMIT 1)),
    coalesce((SELECT t.move_date FROM estimate_terms t WHERE t.user_id=k.user_id AND t.estimate_id=k.estimate_id ORDER BY t.sheet_version DESC LIMIT 1),
             (SELECT left(d.payload->>'moveDate',10) FROM estimate_drafts d WHERE d.user_id=k.user_id AND d.estimate_id=k.estimate_id LIMIT 1)),
    k.archived_at
  FROM (SELECT x.user_id, x.estimate_id, max(x.archived_at) archived_at FROM (
          SELECT d.user_id, d.estimate_id, d.archived_at FROM estimate_drafts d WHERE d.archive_reason='unpaid_on_move_date' AND d.deleted_at IS NOT NULL
          UNION ALL
          SELECT t.user_id, t.estimate_id, t.archived_at FROM estimate_terms t WHERE t.archive_reason='unpaid_on_move_date' AND t.deleted_at IS NOT NULL) x
        GROUP BY x.user_id, x.estimate_id) k
  LEFT JOIN profiles p ON p.id=k.user_id
  ORDER BY k.archived_at DESC LIMIT 500;
END $$;
GRANT EXECUTE ON FUNCTION public.list_auto_archived_estimates() TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_auto_archived_estimate(_user_id uuid, _estimate_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a int; b int;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
  UPDATE estimate_drafts SET deleted_at=NULL, deleted_by=NULL, deletion_source=NULL, deletion_reason=NULL,
    archive_restored_at=now(), updated_at=now()
   WHERE user_id=_user_id AND estimate_id=_estimate_id AND archive_reason='unpaid_on_move_date' AND deleted_at IS NOT NULL;
  GET DIAGNOSTICS a = ROW_COUNT;
  UPDATE estimate_terms SET deleted_at=NULL, deleted_by=NULL, deletion_source=NULL, deletion_reason=NULL,
    archive_restored_at=now(), updated_at=now()
   WHERE user_id=_user_id AND estimate_id=_estimate_id AND archive_reason='unpaid_on_move_date' AND deleted_at IS NOT NULL;
  GET DIAGNOSTICS b = ROW_COUNT;
  RETURN jsonb_build_object('ok', a + b > 0, 'drafts', a, 'terms', b);
END $$;
GRANT EXECUTE ON FUNCTION public.restore_auto_archived_estimate(uuid,text) TO authenticated;