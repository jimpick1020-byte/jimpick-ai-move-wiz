CREATE TABLE public.payapp_test_subscriptions (user_id uuid PRIMARY KEY, state jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.payapp_test_subscriptions TO authenticated;
GRANT ALL ON public.payapp_test_subscriptions TO service_role;
ALTER TABLE public.payapp_test_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY payapp_test_owner ON public.payapp_test_subscriptions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.save_payapp_test_state(p_expected jsonb, p_next jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_state jsonb;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
INSERT INTO public.payapp_test_subscriptions(user_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING;
SELECT state INTO v_state FROM public.payapp_test_subscriptions WHERE user_id=auth.uid() FOR UPDATE;
IF v_state IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Test state changed. Retry.'; END IF;
IF p_next->>'mode' IS DISTINCT FROM 'test' OR (p_next->>'actualCharged')::integer IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Test only'; END IF;
UPDATE public.payapp_test_subscriptions SET state=p_next, updated_at=now() WHERE user_id=auth.uid();
RETURN p_next;
END $$;
REVOKE ALL ON FUNCTION public.save_payapp_test_state(jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_payapp_test_state(jsonb,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.initialize_new_subscription_trial() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
IF NEW.plan='free' AND NEW.status='trialing' THEN
NEW.trial_started_at := COALESCE(NEW.trial_started_at, NEW.current_period_start, now());
NEW.trial_ends_at := NEW.trial_started_at + interval '10 days';
NEW.current_period_end := NEW.trial_ends_at;
END IF;
RETURN NEW;
END $$;
CREATE TRIGGER new_subscription_trial_ten_days BEFORE INSERT ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.initialize_new_subscription_trial();
COMMENT ON TABLE public.payapp_test_subscriptions IS 'Isolated no-charge simulation only. Never used for entitlement or real payment history.';