CREATE OR REPLACE FUNCTION public.claim_move_reminders(_limit integer DEFAULT 20)
RETURNS SETOF public.move_reminders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT m.id, m.status AS old_status
    FROM public.move_reminders m
    WHERE m.scheduled_at <= now()
      -- 이사일이 지난 건은 다시 보내지 않습니다 (한국시간 기준)
      AND (
        m.move_date IS NULL
        OR (m.move_date ~ '^\d{4}-\d{2}-\d{2}$'
            AND m.move_date::date >= ((now() AT TIME ZONE 'Asia/Seoul')::date))
      )
      AND (
        m.status = 'scheduled'
        -- 처리 중으로 멈춘 건은 원인을 남기고 딱 한 번만 다시 처리합니다
        OR (
          m.status = 'processing'
          AND COALESCE(m.processing_at, m.updated_at) < now() - interval '15 minutes'
          AND COALESCE(m.auto_retried, false) = false
        )
      )
      -- 삭제·취소된 계약은 보내지 않습니다
      AND (
        m.estimate_terms_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.estimate_terms t
          WHERE t.id = m.estimate_terms_id
            AND t.deleted_at IS NULL
            AND COALESCE(t.payment_status, '') <> 'canceled'
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
$$;