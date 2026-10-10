CREATE OR REPLACE FUNCTION public.auto_archive_past_estimate_notices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kst timestamp := now() AT TIME ZONE 'Asia/Seoul';
  v_cnt int := 0;
  v_terms int := 0;
BEGIN
  -- '견적 안내' 단계만: 고객 동의·입금 확인·입금 확인 대기·결제 기록이 하나도 없는 견적
  WITH target AS (
    SELECT d.user_id, d.estimate_id
    FROM public.estimate_drafts d
    WHERE d.deleted_at IS NULL
      AND (d.payload->>'moveDate') ~ '^\d{4}-\d{2}-\d{2}'
      AND (left(d.payload->>'moveDate', 10)::date + 1)::timestamp + time '10:00' <= v_kst
      AND NOT EXISTS (
        SELECT 1 FROM public.estimate_terms t
        WHERE t.user_id = d.user_id AND t.estimate_id = d.estimate_id
          AND (t.deposit_paid > 0 OR t.balance_paid > 0
               OR t.payment_status IN ('deposit_paid','partial','balance_paid','completed'))
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.terms_acceptances a
        WHERE a.user_id = d.user_id AND a.estimate_id = d.estimate_id
          AND a.accepted_at IS NOT NULL AND coalesce(a.reservation_status,'') <> 'canceled'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.deposit_records r
        WHERE r.user_id = d.user_id AND r.estimate_id = d.estimate_id
          AND r.status IN ('pending_review','confirmed')
      )
  ), upd AS (
    UPDATE public.estimate_drafts d
       SET deleted_at = now(), deletion_source = 'auto_cleanup_estimate_notice',
           deletion_reason = '이사 날짜가 지난 견적 안내 자동 정리', updated_at = now()
      FROM target
     WHERE d.user_id = target.user_id AND d.estimate_id = target.estimate_id AND d.deleted_at IS NULL
    RETURNING d.user_id, d.estimate_id
  ), upd_terms AS (
    UPDATE public.estimate_terms t
       SET deleted_at = now(), deletion_source = 'auto_cleanup_estimate_notice',
           deletion_reason = '이사 날짜가 지난 견적 안내 자동 정리', updated_at = now()
      FROM upd
     WHERE t.user_id = upd.user_id AND t.estimate_id = upd.estimate_id AND t.deleted_at IS NULL
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM upd), (SELECT count(*) FROM upd_terms) INTO v_cnt, v_terms;

  INSERT INTO public.reminder_job_runs (job, picked, sent, failed, missed, checked, note)
  VALUES ('auto_cleanup_estimate_notice', v_cnt, 0, 0, 0, v_cnt,
          format('견적 %s건, 약관 기록 %s건 소프트 삭제 (KST %s)', v_cnt, v_terms, v_kst));
  RETURN v_cnt;
END $$;

REVOKE EXECUTE ON FUNCTION public.auto_archive_past_estimate_notices() FROM PUBLIC, anon, authenticated;