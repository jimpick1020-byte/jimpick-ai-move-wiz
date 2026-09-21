ALTER TABLE public.move_reminders
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'move_day_reminder',
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS to_address text,
  ADD COLUMN IF NOT EXISTS to_masked text,
  ADD COLUMN IF NOT EXISTS message_type text,
  ADD COLUMN IF NOT EXISTS message_snapshot text,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'aligo',
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS provider_response jsonb,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS processing_at timestamptz,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS view_token text,
  ADD COLUMN IF NOT EXISTS customer_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missed_reason text,
  ADD COLUMN IF NOT EXISTS auto_retried boolean NOT NULL DEFAULT false;

-- 기존 기록 보정 (값만 채우고 지우지 않습니다)
UPDATE public.move_reminders
   SET scheduled_date = COALESCE(scheduled_date, (scheduled_at AT TIME ZONE 'Asia/Seoul')::date)
 WHERE scheduled_date IS NULL;

UPDATE public.move_reminders
   SET provider_message_id = COALESCE(provider_message_id, aligo_message_id)
 WHERE provider_message_id IS NULL AND aligo_message_id IS NOT NULL;

UPDATE public.move_reminders
   SET to_masked = COALESCE(to_masked, '010-****-' || right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 4))
 WHERE to_masked IS NULL AND length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) >= 4;

UPDATE public.move_reminders
   SET requested_at = COALESCE(requested_at, sent_at),
       accepted_at = COALESCE(accepted_at, sent_at)
 WHERE status = 'success' AND sent_at IS NOT NULL;

ALTER TABLE public.move_reminders ALTER COLUMN scheduled_date SET NOT NULL;

ALTER TABLE public.move_reminders DROP CONSTRAINT IF EXISTS move_reminders_status_check;
ALTER TABLE public.move_reminders
  ADD CONSTRAINT move_reminders_status_check CHECK (status IN (
    'scheduled','sending','processing','accepted','delivered','success','failed','canceled','cancelled','unknown'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS move_reminders_unique_target
  ON public.move_reminders (company_id, estimate_id, delivery_type, scheduled_date);

CREATE UNIQUE INDEX IF NOT EXISTS move_reminders_view_token_key
  ON public.move_reminders (view_token) WHERE view_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS move_reminders_status_sched_idx
  ON public.move_reminders (status, scheduled_at);

-- 작업 실행 기록 (대상이 0건인 날도 남깁니다)
CREATE TABLE IF NOT EXISTS public.reminder_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  picked integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  missed integer NOT NULL DEFAULT 0,
  checked integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reminder_job_runs TO authenticated;
GRANT ALL ON public.reminder_job_runs TO service_role;
ALTER TABLE public.reminder_job_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view job runs" ON public.reminder_job_runs;
CREATE POLICY "Super admins can view job runs"
  ON public.reminder_job_runs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS reminder_job_runs_ran_at_idx ON public.reminder_job_runs (ran_at DESC);

-- 최고관리자는 전체 업체의 전날 문자 기록을 볼 수 있습니다
DROP POLICY IF EXISTS "Super admins can view all reminders" ON public.move_reminders;
CREATE POLICY "Super admins can view all reminders"
  ON public.move_reminders FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 발송 대상 선점: 처리 중 시각을 함께 남깁니다
CREATE OR REPLACE FUNCTION public.claim_move_reminders(_limit integer DEFAULT 20)
 RETURNS SETOF public.move_reminders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT id FROM public.move_reminders
    WHERE status = 'scheduled' AND scheduled_at <= now()
    ORDER BY scheduled_at
    LIMIT GREATEST(1, LEAST(_limit, 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.move_reminders m
  SET status = 'processing', processing_at = now(), updated_at = now()
  FROM due
  WHERE m.id = due.id
  RETURNING m.*;
END;
$function$;

-- 고객이 보안 링크를 열었을 때: 최초 확인 시각은 보존합니다
CREATE OR REPLACE FUNCTION public.mark_reminder_viewed(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.move_reminders;
BEGIN
  IF _token IS NULL OR length(btrim(_token)) < 16 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  UPDATE public.move_reminders
     SET customer_viewed_at = COALESCE(customer_viewed_at, now()),
         last_viewed_at = now(),
         view_count = view_count + 1,
         updated_at = now()
   WHERE view_token = btrim(_token)
  RETURNING * INTO r;
  IF r.id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'estimate_id', r.estimate_id,
    'estimate_terms_id', r.estimate_terms_id,
    'first_viewed_at', r.customer_viewed_at,
    'view_count', r.view_count
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_reminder_viewed(text) TO anon, authenticated;