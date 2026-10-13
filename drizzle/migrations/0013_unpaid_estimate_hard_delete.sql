DROP FUNCTION IF EXISTS public.list_auto_archived_estimates();
DROP FUNCTION IF EXISTS public.restore_auto_archived_estimate(uuid, text);

CREATE OR REPLACE FUNCTION public.auto_archive_past_estimate_notices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_kst timestamp := now() AT TIME ZONE 'Asia/Seoul';
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  c record; v_cnt int := 0; v_kept int := 0; n1 int; n2 int;
BEGIN
  FOR c IN
    SELECT DISTINCT user_id, estimate_id FROM (
      SELECT user_id, estimate_id FROM estimate_drafts
       WHERE (deleted_at IS NULL OR archive_reason = 'unpaid_on_move_date')
         AND (payload->>'moveDate') ~ '^\d{4}-\d{2}-\d{2}' AND left(payload->>'moveDate',10)::date <= v_today
      UNION
      SELECT user_id, estimate_id FROM estimate_terms
       WHERE (deleted_at IS NULL OR archive_reason = 'unpaid_on_move_date')
         AND move_date ~ '^\d{4}-\d{2}-\d{2}' AND left(move_date,10)::date <= v_today
    ) x
  LOOP
    -- 입금 확인과 겹치지 않도록 잠근 뒤 조건을 다시 확인합니다
    PERFORM 1 FROM estimate_terms WHERE user_id=c.user_id AND estimate_id=c.estimate_id FOR UPDATE;
    PERFORM 1 FROM estimate_drafts WHERE user_id=c.user_id AND estimate_id=c.estimate_id FOR UPDATE;
    -- 이미 자동 정리로 숨겨진 건도 같은 기준으로 확인합니다
    IF EXISTS (SELECT 1 FROM estimate_terms t WHERE t.user_id=c.user_id AND t.estimate_id=c.estimate_id
                AND t.deleted_at IS NOT NULL AND coalesce(t.archive_reason,'') <> 'unpaid_on_move_date')
       OR EXISTS (SELECT 1 FROM estimate_drafts d WHERE d.user_id=c.user_id AND d.estimate_id=c.estimate_id
                AND d.deleted_at IS NOT NULL AND coalesce(d.archive_reason,'') <> 'unpaid_on_move_date') THEN
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM estimate_terms t WHERE t.user_id=c.user_id AND t.estimate_id=c.estimate_id
                 AND (coalesce(t.deposit_paid,0) > 0 OR coalesce(t.balance_paid,0) > 0 OR t.paid_at IS NOT NULL
                   OR t.payment_status IN ('deposit_paid','partial','balance_paid','completed','refunded','canceled')
                   OR t.contract_status = 'cancelled'))
       OR EXISTS (SELECT 1 FROM terms_acceptances a WHERE a.user_id=c.user_id AND a.estimate_id=c.estimate_id
                 AND a.accepted_at IS NOT NULL AND coalesce(a.reservation_status,'') <> 'canceled')
       OR EXISTS (SELECT 1 FROM deposit_records r WHERE r.user_id=c.user_id AND r.estimate_id=c.estimate_id
                 AND r.status IN ('pending_review','confirmed'))
       OR NOT EXISTS (
         SELECT 1 FROM (
           SELECT t.move_date md FROM estimate_terms t WHERE t.user_id=c.user_id AND t.estimate_id=c.estimate_id
             ORDER BY t.sheet_version DESC, t.created_at DESC LIMIT 1) z
          WHERE z.md ~ '^\d{4}-\d{2}-\d{2}' AND left(z.md,10)::date <= v_today
         UNION ALL
         SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM estimate_terms t WHERE t.user_id=c.user_id AND t.estimate_id=c.estimate_id))
    THEN CONTINUE; END IF;

    -- 계약 동의·안내 문자 기록이 연결된 견적서는 기록 보존을 위해 지우지 않고 숨김만 유지합니다
    IF EXISTS (SELECT 1 FROM terms_acceptances a JOIN estimate_terms t ON t.id=a.estimate_terms_id
                WHERE t.user_id=c.user_id AND t.estimate_id=c.estimate_id)
       OR EXISTS (SELECT 1 FROM move_reminders m JOIN estimate_terms t ON t.id=m.estimate_terms_id
                WHERE t.user_id=c.user_id AND t.estimate_id=c.estimate_id) THEN
      UPDATE estimate_terms SET deleted_at=coalesce(deleted_at, now()), archived_at=coalesce(archived_at, now()),
        archive_reason='unpaid_on_move_date', deletion_source='auto_cleanup_estimate_notice', updated_at=now()
       WHERE user_id=c.user_id AND estimate_id=c.estimate_id AND deleted_at IS NULL;
      DELETE FROM estimate_drafts WHERE user_id=c.user_id AND estimate_id=c.estimate_id;
      v_kept := v_kept + 1;
      CONTINUE;
    END IF;

    DELETE FROM estimate_drafts WHERE user_id=c.user_id AND estimate_id=c.estimate_id;
    GET DIAGNOSTICS n1 = ROW_COUNT;
    DELETE FROM estimate_terms WHERE user_id=c.user_id AND estimate_id=c.estimate_id;
    GET DIAGNOSTICS n2 = ROW_COUNT;
    IF n1 + n2 > 0 THEN v_cnt := v_cnt + 1; END IF;
  END LOOP;
  INSERT INTO reminder_job_runs (job, picked, sent, failed, missed, checked, note)
  VALUES ('auto_cleanup_estimate_notice', v_cnt + v_kept, 0, 0, 0, v_cnt + v_kept,
    format('견적 %s건 영구 삭제, 연결 기록 보존 %s건 (KST %s)', v_cnt, v_kept, v_kst));
  RETURN v_cnt + v_kept;
END $$;
REVOKE EXECUTE ON FUNCTION public.auto_archive_past_estimate_notices() FROM PUBLIC, anon, authenticated;