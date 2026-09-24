UPDATE public.move_reminders
SET view_token = replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')
WHERE view_token IS NULL AND status IN ('scheduled','processing');

CREATE OR REPLACE FUNCTION public.claim_move_reminders(_limit integer DEFAULT 20)
 RETURNS SETOF move_reminders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  kst timestamp := now() AT TIME ZONE 'Asia/Seoul';
BEGIN
  -- 한국시간 18:00~18:09 에만 발송합니다
  IF kst::time < time '18:00' OR kst::time >= time '18:10' THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH due AS (
    SELECT m.id, m.status AS old_status
    FROM public.move_reminders m
    WHERE m.scheduled_at <= now()
      AND m.delivery_type = 'move_day_reminder'
      AND m.move_date ~ '^\d{4}-\d{2}-\d{2}$'
      AND m.move_date::date = (kst::date + 1)
      AND (
        m.status = 'scheduled'
        OR (
          m.status = 'processing'
          AND COALESCE(m.processing_at, m.updated_at) < now() - interval '5 minutes'
          AND COALESCE(m.auto_retried, false) = false
        )
      )
      AND (
        m.estimate_terms_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.estimate_terms t
          WHERE t.id = m.estimate_terms_id
            AND t.deleted_at IS NULL
            AND COALESCE(t.payment_status, '') NOT IN ('canceled','refunded')
        )
      )
    ORDER BY m.scheduled_at
    LIMIT GREATEST(1, LEAST(_limit, 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.move_reminders m
  SET status = 'processing',
      processing_at = now(),
      auto_retried = CASE WHEN due.old_status = 'processing' THEN true ELSE COALESCE(m.auto_retried, false) END,
      missed_reason = CASE WHEN due.old_status = 'processing'
        THEN '이전 발송이 끝나지 않아 한 번 다시 처리했습니다.' ELSE m.missed_reason END,
      updated_at = now()
  FROM due
  WHERE m.id = due.id
  RETURNING m.*;
END;
$function$;