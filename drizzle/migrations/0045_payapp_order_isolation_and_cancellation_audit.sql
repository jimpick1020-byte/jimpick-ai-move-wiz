ALTER TABLE public.subscriptions ADD COLUMN payapp_order_id uuid REFERENCES public.payapp_orders(id);
UPDATE public.subscriptions s SET payapp_order_id=o.id FROM public.payapp_orders o WHERE o.user_id=s.user_id AND o.status='active' AND o.last_paid_at=s.current_period_start AND s.plan='pro';
CREATE TABLE public.payapp_notice_audit (
 mul_no text NOT NULL, pay_state text NOT NULL, order_id uuid NOT NULL REFERENCES public.payapp_orders(id), amount integer NOT NULL CHECK(amount BETWEEN 1 AND 30000), orig_mul_no text, orig_price integer, paid_at timestamptz, received_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(mul_no,pay_state)
);
GRANT SELECT ON public.payapp_notice_audit TO authenticated;
GRANT ALL ON public.payapp_notice_audit TO service_role;
ALTER TABLE public.payapp_notice_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY payapp_notice_owner_read ON public.payapp_notice_audit FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.payapp_orders o WHERE o.id=order_id AND o.user_id=auth.uid()));
CREATE OR REPLACE FUNCTION public.apply_payapp_notice(p_order uuid,p_user uuid,p_rebill text,p_mul text,p_state text,p_amount integer,p_paid timestamptz DEFAULT NULL,p_next timestamptz DEFAULT NULL,p_orig_mul text DEFAULT NULL,p_orig_price integer DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.payapp_orders; target text; partial boolean; canceled boolean; outcome text; eligible boolean; existing public.payments; n integer;
BEGIN
 target:=coalesce(p_orig_mul,p_mul); partial:=p_state IN('70','71');
 PERFORM pg_advisory_xact_lock(hashtextextended('payapp-transaction:'||target,0));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 SELECT * INTO o FROM public.payapp_orders WHERE id=p_order AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR o.rebill_no IS DISTINCT FROM p_rebill OR p_mul !~ '^\d+$' OR target !~ '^\d+$' THEN RAISE EXCEPTION 'Payment mismatch'; END IF;
 IF p_state NOT IN('1','4','8','32','9','64','10','70','71','99') THEN RAISE EXCEPTION 'Unsupported payment state'; END IF;
 IF partial THEN
  IF p_orig_mul IS NULL OR p_orig_price IS DISTINCT FROM o.amount OR p_amount<=0 OR p_amount>=o.amount THEN RAISE EXCEPTION 'Cancellation mismatch'; END IF;
 ELSIF p_amount IS DISTINCT FROM o.amount OR p_orig_mul IS NOT NULL OR p_orig_price IS NOT NULL THEN RAISE EXCEPTION 'Payment mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM public.payapp_notice_audit WHERE (mul_no IN(p_mul,target) OR orig_mul_no IN(p_mul,target)) AND order_id<>p_order) OR EXISTS(SELECT 1 FROM public.payapp_events WHERE mul_no IN(p_mul,target) AND order_id<>p_order) THEN RAISE EXCEPTION 'Transaction belongs to another order'; END IF;
 IF EXISTS(SELECT 1 FROM public.payapp_notice_audit WHERE mul_no=p_mul AND pay_state=p_state AND (order_id<>p_order OR amount<>p_amount OR orig_mul_no IS DISTINCT FROM p_orig_mul OR orig_price IS DISTINCT FROM p_orig_price OR paid_at IS DISTINCT FROM p_paid)) THEN RAISE EXCEPTION 'Conflicting duplicate'; END IF;
 IF EXISTS(SELECT 1 FROM public.payapp_notice_audit WHERE mul_no=p_mul AND pay_state=p_state) THEN RETURN jsonb_build_object('duplicate',true); END IF;
 IF p_state='4' AND (p_paid IS NULL OR p_next IS NULL OR p_next<=p_paid OR p_paid>now()+interval '15 minutes' OR p_paid<o.consented_at-interval '15 minutes') THEN RAISE EXCEPTION 'Invalid payment date'; END IF;
 INSERT INTO public.payapp_notice_audit(mul_no,pay_state,order_id,amount,orig_mul_no,orig_price,paid_at) VALUES(p_mul,p_state,p_order,p_amount,p_orig_mul,p_orig_price,p_paid);
 IF NOT partial THEN INSERT INTO public.payapp_events(mul_no,pay_state,order_id,amount,paid_at) VALUES(p_mul,p_state,p_order,p_amount,p_paid) ON CONFLICT DO NOTHING; END IF;
 SELECT * INTO existing FROM public.payments WHERE provider='payapp' AND payment_key=target AND user_id=p_user ORDER BY CASE WHEN status='failed' THEN 1 ELSE 0 END,created_at LIMIT 1 FOR UPDATE;
 canceled:=EXISTS(SELECT 1 FROM public.payapp_notice_audit WHERE (mul_no=target OR orig_mul_no=target) AND pay_state IN('9','64','70','71')) OR EXISTS(SELECT 1 FROM public.payapp_events WHERE mul_no=target AND pay_state IN('9','64','70','71'));
 eligible:=o.canceled_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.payapp_orders WHERE user_id=p_user AND (created_at,id)>(o.created_at,o.id));
 IF p_state IN('4','9','64','70','71','99') THEN
  outcome:=CASE WHEN EXISTS(SELECT 1 FROM public.payapp_notice_audit WHERE mul_no=target AND pay_state IN('9','64')) OR existing.status='canceled' THEN 'canceled' WHEN canceled OR existing.status='partially_canceled' THEN 'partially_canceled' WHEN p_state='4' OR existing.status='paid' THEN 'paid' ELSE 'failed' END;
  IF existing.id IS NULL THEN
   INSERT INTO public.payments(user_id,plan,amount,method,status,provider,order_id,payment_key,paid_at,next_billing_at,test_mode,receipt_no,fail_reason) VALUES(p_user,'pro',o.amount,'card',outcome,'payapp','payapp:'||target,target,coalesce(p_paid,now()),CASE WHEN p_state='4' THEN p_next ELSE NULL END,false,target,CASE WHEN outcome='failed' THEN '정기결제 승인 실패' ELSE NULL END);
  ELSE
   UPDATE public.payments SET status=outcome,fail_reason=CASE WHEN outcome='failed' THEN '정기결제 승인 실패' ELSE NULL END,paid_at=CASE WHEN p_state='4' THEN p_paid ELSE paid_at END,next_billing_at=CASE WHEN p_state='4' THEN p_next ELSE next_billing_at END WHERE id=existing.id;
  END IF;
 END IF;
 IF p_state='4' THEN
  IF eligible AND NOT canceled AND (o.last_paid_at IS NULL OR p_paid>o.last_paid_at) THEN
   UPDATE public.subscriptions SET payapp_order_id=p_order,plan='pro',status='active',price=o.amount,interval='month',current_period_start=p_paid,current_period_end=p_next,cancel_at_period_end=false WHERE user_id=p_user AND (payapp_order_id IS NULL OR payapp_order_id=p_order OR EXISTS(SELECT 1 FROM public.payapp_orders old WHERE old.id=payapp_order_id AND (old.created_at,old.id)<(o.created_at,o.id)));
   GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Subscription order mismatch'; END IF;
   UPDATE public.payapp_orders SET status='active',first_paid_at=coalesce(first_paid_at,p_paid),last_paid_at=p_paid WHERE id=p_order;
  ELSIF canceled OR NOT eligible THEN
   UPDATE public.payapp_orders SET status=CASE WHEN canceled_at IS NULL AND eligible THEN 'review' ELSE status END WHERE id=p_order;
  END IF;
 ELSIF p_state IN('9','64','70','71') THEN
  IF eligible THEN UPDATE public.payapp_orders SET status='review' WHERE id=p_order; END IF;
  UPDATE public.subscriptions SET status='past_due' WHERE user_id=p_user AND payapp_order_id=p_order AND EXISTS(SELECT 1 FROM public.payments pay WHERE pay.provider='payapp' AND pay.payment_key=target AND pay.user_id=p_user AND pay.paid_at=current_period_start);
 ELSIF p_state IN('8','32') AND o.first_paid_at IS NULL THEN
  UPDATE public.payapp_orders SET status='canceled',canceled_at=coalesce(canceled_at,now()) WHERE id=p_order;
 END IF;
 RETURN jsonb_build_object('duplicate',false,'isolated',NOT eligible,'review',canceled);
END $$;
REVOKE ALL ON FUNCTION public.apply_payapp_notice(uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payapp_notice(uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.apply_payapp_event_internal(p_order uuid,p_user uuid,p_rebill text,p_mul text,p_state text,p_amount integer,p_paid timestamptz,p_next timestamptz) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.apply_payapp_notice(p_order,p_user,p_rebill,p_mul,p_state,p_amount,p_paid,p_next) $$;
CREATE OR REPLACE FUNCTION public.finish_payapp_cancel(p_order uuid,p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.payapp_orders;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 SELECT * INTO o FROM public.payapp_orders WHERE id=p_order AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 UPDATE public.payapp_orders SET canceled_at=coalesce(canceled_at,now()),status='canceled' WHERE id=p_order;
 UPDATE public.subscriptions SET cancel_at_period_end=true WHERE user_id=p_user AND payapp_order_id=p_order;
END $$;
CREATE OR REPLACE FUNCTION public.reject_payapp_registration(p_order uuid,p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 UPDATE public.payapp_orders SET status='failed' WHERE id=p_order AND user_id=p_user AND status='creating' AND rebill_no IS NULL AND NOT EXISTS(SELECT 1 FROM public.payapp_notice_audit WHERE order_id=p_order);
END $$;
REVOKE ALL ON FUNCTION public.reject_payapp_registration(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reject_payapp_registration(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.finish_payapp_cancel(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_payapp_cancel(uuid,uuid) TO service_role;