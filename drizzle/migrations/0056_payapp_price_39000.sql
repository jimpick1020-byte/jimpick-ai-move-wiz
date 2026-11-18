-- Subscription price 39,000원 (VAT included) for new consents; existing orders keep their own consented amount.
ALTER TABLE public.payapp_orders DROP CONSTRAINT IF EXISTS payapp_orders_amount_check;
ALTER TABLE public.payapp_orders ADD CONSTRAINT payapp_orders_amount_check CHECK (amount IN (30000, 39000));
ALTER TABLE public.payapp_orders ALTER COLUMN amount SET DEFAULT 39000;
ALTER TABLE public.payapp_events DROP CONSTRAINT IF EXISTS payapp_events_amount_check;
ALTER TABLE public.payapp_events ADD CONSTRAINT payapp_events_amount_check CHECK (amount IN (30000, 39000));
ALTER TABLE public.payapp_notice_audit DROP CONSTRAINT IF EXISTS payapp_notice_audit_amount_check;
ALTER TABLE public.payapp_notice_audit ADD CONSTRAINT payapp_notice_audit_amount_check CHECK (amount BETWEEN 1 AND 39000);

CREATE OR REPLACE FUNCTION public.reserve_payapp_order_v2(p_user uuid, p_request date, p_expire date, p_policy text, p_resume uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.payapp_orders; s public.subscriptions; stamp timestamptz; today date;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 stamp:=clock_timestamp(); today:=(stamp AT TIME ZONE 'Asia/Seoul')::date;
 SELECT * INTO s FROM public.subscriptions WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing subscription'; END IF;
 IF s.plan<>'free' AND s.status='active' AND s.current_period_end>stamp THEN RAISE EXCEPTION 'Already subscribed'; END IF;
 IF EXISTS(SELECT 1 FROM public.billing_keys WHERE user_id=p_user) THEN RAISE EXCEPTION 'Legacy billing requires reconciliation'; END IF;
 SELECT * INTO o FROM public.payapp_orders WHERE user_id=p_user AND status IN('creating','pending','active','review') FOR UPDATE;
 IF FOUND THEN
  IF p_resume IS DISTINCT FROM o.id OR p_request IS DISTINCT FROM o.request_date OR p_expire IS DISTINCT FROM o.rebill_expire OR p_policy IS DISTINCT FROM coalesce(o.policy_version,'legacy-same-day') THEN RAISE EXCEPTION 'Review original order consent'; END IF;
  IF o.status<>'pending' OR o.first_paid_at IS NOT NULL OR o.payurl IS NULL THEN RAISE EXCEPTION 'Existing request unresolved'; END IF;
  IF o.policy_version IN ('card-fixed-kst-2026-11-16','card-fixed-kst-39000-2026-11-18') THEN
   IF stamp<coalesce(o.requested_at,o.created_at) OR stamp>=coalesce(o.requested_at,o.created_at)+interval '24 hours' THEN RAISE EXCEPTION 'Reopen limit reached; provider status requires reconciliation'; END IF;
  ELSIF coalesce(o.request_date,(o.created_at AT TIME ZONE 'Asia/Seoul')::date)<>today THEN RAISE EXCEPTION 'Legacy request requires reconciliation'; END IF;
  RETURN jsonb_build_object('order',to_jsonb(o),'created',false);
 END IF;
 IF p_resume IS NOT NULL OR p_policy IS DISTINCT FROM 'card-fixed-kst-39000-2026-11-18' OR p_request IS DISTINCT FROM today OR p_expire IS DISTINCT FROM (today+interval '5 years')::date THEN RAISE EXCEPTION 'Consent quote changed'; END IF;
 INSERT INTO public.payapp_orders(user_id,amount,requested_day,request_date,rebill_expire,requested_at,consented_at,policy_version,consent_snapshot)
 VALUES(p_user,39000,extract(day FROM today)::integer,today,p_expire,stamp,stamp,p_policy,jsonb_build_object('version',p_policy,'amount',39000,'vatIncluded',true,'requestDate',today,'requestedDay',extract(day FROM today)::integer,'expire',p_expire,'cardOnly',true,'firstCharge','on-card-approval','reopenHours',24,'exclusiveExpiry',true)) RETURNING * INTO o;
 RETURN jsonb_build_object('order',to_jsonb(o),'created',true);
END $function$;