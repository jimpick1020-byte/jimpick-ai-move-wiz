CREATE TABLE public.owner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  kind text NOT NULL,
  ref_id text NOT NULL,
  dedupe_key text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '/',
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  pushed_at timestamptz,
  push_error text,
  UNIQUE (company_id, dedupe_key)
);
CREATE INDEX owner_notifications_unread_idx ON public.owner_notifications (company_id) WHERE read_at IS NULL;
GRANT SELECT, UPDATE ON public.owner_notifications TO authenticated;
GRANT ALL ON public.owner_notifications TO service_role;
ALTER TABLE public.owner_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read own notifications" ON public.owner_notifications FOR SELECT TO authenticated USING (company_id = auth.uid());
CREATE POLICY "owners mark own notifications read" ON public.owner_notifications FOR UPDATE TO authenticated USING (company_id = auth.uid()) WITH CHECK (company_id = auth.uid());

-- 읽음 표시만 바꿀 수 있습니다 (다른 칸 변경 금지)
CREATE OR REPLACE FUNCTION public.guard_owner_notification_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.company_id <> OLD.company_id OR NEW.kind <> OLD.kind OR NEW.ref_id <> OLD.ref_id OR NEW.dedupe_key <> OLD.dedupe_key
       OR NEW.title <> OLD.title OR NEW.body <> OLD.body OR NEW.url <> OLD.url OR NEW.created_at <> OLD.created_at
       OR NEW.pushed_at IS DISTINCT FROM OLD.pushed_at OR NEW.push_error IS DISTINCT FROM OLD.push_error THEN
      RAISE EXCEPTION 'only read_at can change';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER owner_notifications_guard BEFORE UPDATE ON public.owner_notifications FOR EACH ROW EXECUTE FUNCTION public.guard_owner_notification_update();

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read own push" ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "owners delete own push" ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 알림이 생기면 서버에 즉시 푸시 발송을 요청합니다
CREATE OR REPLACE FUNCTION public.dispatch_owner_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://project--9ef0e6b7-7d23-4428-8895-6a82ebf234c8.lovable.app/api/public/hooks/push-dispatch',
      headers := jsonb_build_object('Content-Type','application/json','x-reminder-secret',(SELECT secret FROM public.app_cron_secrets WHERE name='move_reminders')),
      body := jsonb_build_object('id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END $$;
CREATE TRIGGER owner_notifications_push AFTER INSERT ON public.owner_notifications FOR EACH ROW EXECUTE FUNCTION public.dispatch_owner_push();

-- 예약금·잔금 입금(확인 대기) 기록이 새로 생기면 알림 1건
CREATE OR REPLACE FUNCTION public.notify_deposit_record() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; label text;
BEGIN
  IF NEW.status <> 'pending_review' OR COALESCE(NEW.amount,0) <= 0 THEN RETURN NEW; END IF;
  k := CASE WHEN NEW.payment_kind = 'balance' THEN 'balance' ELSE 'deposit' END;
  label := CASE WHEN k = 'balance' THEN '잔금' ELSE '예약금' END;
  INSERT INTO public.owner_notifications (company_id, kind, ref_id, dedupe_key, title, body, url)
  VALUES (NEW.user_id, k, NEW.estimate_id, 'deposit:' || NEW.id::text,
    label || ' 입금 확인 요청',
    COALESCE(NULLIF(NEW.customer_name,''), NEW.depositor_name, '고객') || ' · ' || to_char(NEW.amount, 'FM999,999,999,999') || '원',
    '/?notice=' || k || '&estimate=' || NEW.estimate_id)
  ON CONFLICT (company_id, dedupe_key) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER deposit_records_notify AFTER INSERT ON public.deposit_records FOR EACH ROW EXECUTE FUNCTION public.notify_deposit_record();

-- 고객 사전정보 요청 제출 (제출할 때마다 1건, 같은 제출은 1건)
CREATE OR REPLACE FUNCTION public.notify_intake_submit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.last_submitted_at IS NULL OR NEW.last_submitted_at IS NOT DISTINCT FROM OLD.last_submitted_at THEN RETURN NEW; END IF;
  INSERT INTO public.owner_notifications (company_id, kind, ref_id, dedupe_key, title, body, url)
  VALUES (NEW.company_id, 'intake', NEW.id::text, 'intake:' || NEW.id::text || ':' || NEW.submit_count::text,
    '사전정보 요청 도착', COALESCE(NULLIF(NEW.customer_name,''), '고객') || ' 고객님이 사전정보를 보냈습니다',
    '/?notice=intake&intake=' || NEW.id::text)
  ON CONFLICT (company_id, dedupe_key) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER intake_requests_notify AFTER UPDATE ON public.intake_requests FOR EACH ROW EXECUTE FUNCTION public.notify_intake_submit();