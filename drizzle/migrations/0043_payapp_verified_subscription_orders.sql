CREATE TABLE public.payapp_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), amount integer NOT NULL DEFAULT 30000 CHECK(amount=30000), consented_at timestamptz NOT NULL DEFAULT now(), requested_day integer NOT NULL CHECK(requested_day between 1 and 31), status text NOT NULL DEFAULT 'creating' CHECK(status IN ('creating','pending','active','failed','canceled','review')), rebill_no text UNIQUE, payurl text, first_paid_at timestamptz, last_paid_at timestamptz, canceled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payapp_orders TO authenticated;
GRANT ALL ON public.payapp_orders TO service_role;
ALTER TABLE public.payapp_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY payapp_orders_owner_read ON public.payapp_orders FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE UNIQUE INDEX payapp_one_open_order ON public.payapp_orders(user_id) WHERE status IN ('creating','pending','active','review');
CREATE TABLE public.payapp_events (
 mul_no text NOT NULL, pay_state text NOT NULL, order_id uuid NOT NULL REFERENCES public.payapp_orders(id), amount integer NOT NULL CHECK(amount=30000), paid_at timestamptz, received_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(mul_no,pay_state)
);
GRANT SELECT ON public.payapp_events TO authenticated;
GRANT ALL ON public.payapp_events TO service_role;
ALTER TABLE public.payapp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY payapp_events_owner_read ON public.payapp_events FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.payapp_orders o WHERE o.id=order_id AND o.user_id=auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;
CREATE OR REPLACE FUNCTION public.reserve_payapp_order(p_user uuid,p_day integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.payapp_orders; s public.subscriptions;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 SELECT * INTO s FROM public.subscriptions WHERE user_id=p_user FOR UPDATE;
 IF s.plan <> 'free' AND s.status='active' AND s.current_period_end>now() THEN RAISE EXCEPTION 'Already subscribed'; END IF;
 IF EXISTS(SELECT 1 FROM public.billing_keys WHERE user_id=p_user) THEN RAISE EXCEPTION 'Legacy billing requires reconciliation'; END IF;
 SELECT * INTO o FROM public.payapp_orders WHERE user_id=p_user AND status IN('creating','pending','active','review') FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('order',to_jsonb(o),'created',false); END IF;
 INSERT INTO public.payapp_orders(user_id,requested_day) VALUES(p_user,p_day) RETURNING * INTO o;
 RETURN jsonb_build_object('order',to_jsonb(o),'created',true);
END $$;
REVOKE ALL ON FUNCTION public.reserve_payapp_order(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_payapp_order(uuid,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.apply_payapp_event(p_order uuid,p_user uuid,p_rebill text,p_mul text,p_state text,p_amount integer,p_paid timestamptz,p_next timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.payapp_orders; n integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 SELECT * INTO o FROM public.payapp_orders WHERE id=p_order AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR o.rebill_no IS DISTINCT FROM p_rebill OR p_amount IS DISTINCT FROM o.amount THEN RAISE EXCEPTION 'Payment mismatch'; END IF;
 IF p_state NOT IN('1','4','8','32','9','64','10','70','71','99') THEN RAISE EXCEPTION 'Unsupported payment state'; END IF;
 IF EXISTS(SELECT 1 FROM public.payapp_events WHERE mul_no=p_mul AND order_id<>p_order) THEN RAISE EXCEPTION 'Transaction belongs to another order'; END IF;
 IF EXISTS(SELECT 1 FROM public.payapp_events WHERE mul_no=p_mul AND pay_state=p_state) THEN RETURN jsonb_build_object('duplicate',true); END IF;
 IF p_state='4' AND EXISTS(SELECT 1 FROM public.payapp_events WHERE mul_no=p_mul AND pay_state IN('9','64','70','71')) THEN RAISE EXCEPTION 'Canceled transaction'; END IF;
 IF p_state='4' AND (p_paid IS NULL OR p_next IS NULL OR p_next<=p_paid OR p_paid>now()+interval '15 minutes' OR p_paid<o.consented_at-interval '15 minutes') THEN RAISE EXCEPTION 'Invalid payment date'; END IF;
 IF p_state='4' AND o.first_paid_at IS NULL AND o.canceled_at IS NOT NULL THEN RAISE EXCEPTION 'Canceled order'; END IF;
 INSERT INTO public.payapp_events(mul_no,pay_state,order_id,amount,paid_at) VALUES(p_mul,p_state,p_order,p_amount,p_paid);
 IF p_state='4' THEN
  INSERT INTO public.payments(user_id,plan,amount,method,status,provider,order_id,payment_key,paid_at,next_billing_at,test_mode,receipt_no) VALUES(p_user,'pro',p_amount,'card','paid','payapp','payapp:'||p_mul,p_mul,p_paid,p_next,false,p_mul);
  IF o.last_paid_at IS NULL OR p_paid>o.last_paid_at THEN
   UPDATE public.subscriptions SET plan='pro',status='active',price=p_amount,interval='month',current_period_start=p_paid,current_period_end=p_next,cancel_at_period_end=(o.canceled_at IS NOT NULL) WHERE user_id=p_user;
   GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Missing subscription'; END IF;
   UPDATE public.payapp_orders SET status=CASE WHEN canceled_at IS NULL THEN 'active' ELSE 'canceled' END, first_paid_at=coalesce(first_paid_at,p_paid),last_paid_at=p_paid WHERE id=p_order;
  END IF;
 ELSIF p_state IN('9','64','70','71') THEN
  UPDATE public.payments SET status=CASE WHEN p_state IN('70','71') THEN 'partially_canceled' ELSE 'canceled' END WHERE provider='payapp' AND payment_key=p_mul AND user_id=p_user;
  UPDATE public.payapp_orders SET status='review' WHERE id=p_order;
  IF o.last_paid_at=p_paid THEN UPDATE public.subscriptions SET status='past_due' WHERE user_id=p_user; END IF;
 ELSIF p_state IN('8','32') AND o.first_paid_at IS NULL THEN
  UPDATE public.payapp_orders SET status='canceled',canceled_at=now() WHERE id=p_order;
 ELSIF p_state='99' THEN
  INSERT INTO public.payments(user_id,plan,amount,method,status,provider,order_id,payment_key,test_mode,fail_reason) VALUES(p_user,'pro',p_amount,'card','failed','payapp','payapp:failed:'||p_mul,p_mul,false,'정기결제 승인 실패');
 END IF;
 RETURN jsonb_build_object('duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.apply_payapp_event(uuid,uuid,text,text,text,integer,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payapp_event(uuid,uuid,text,text,text,integer,timestamptz,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.finish_payapp_cancel(p_order uuid,p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.payapp_orders;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 SELECT * INTO o FROM public.payapp_orders WHERE id=p_order AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 UPDATE public.payapp_orders SET canceled_at=coalesce(canceled_at,now()),status='canceled' WHERE id=p_order;
 IF o.first_paid_at IS NOT NULL THEN UPDATE public.subscriptions SET cancel_at_period_end=true WHERE user_id=p_user; END IF;
END $$;
REVOKE ALL ON FUNCTION public.finish_payapp_cancel(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_payapp_cancel(uuid,uuid) TO service_role;