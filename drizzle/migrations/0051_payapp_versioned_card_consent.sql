ALTER TABLE public.payapp_orders ADD COLUMN requested_at timestamptz;
ALTER TABLE public.payapp_orders ADD COLUMN policy_version text;
ALTER TABLE public.payapp_orders ADD COLUMN consent_snapshot jsonb;
COMMENT ON COLUMN public.payapp_orders.policy_version IS 'NULL preserves legacy consent; card-fixed-kst-2026-11-16 permits cross-midnight approval and fixed requested_day billing.';
COMMENT ON COLUMN public.payapp_orders.requested_at IS 'Server reservation instant; app reopen limit is strictly less than 24h, not a claim of provider expiry.';
CREATE OR REPLACE FUNCTION public.payapp_fixed_next(p_request date,p_day integer,p_paid timestamptz) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE base date; candidate date; paid_date date;
BEGIN
 IF p_request IS NULL OR p_day NOT BETWEEN 1 AND 31 OR p_paid IS NULL THEN RAISE EXCEPTION 'Invalid fixed billing anchor'; END IF;
 paid_date:=(p_paid AT TIME ZONE 'Asia/Seoul')::date;
 base:=greatest((date_trunc('month',p_request)+interval '1 month')::date,date_trunc('month',paid_date)::date);
 LOOP
  candidate:=base+(least(p_day,extract(day FROM base+interval '1 month'-interval '1 day')::integer)-1);
  EXIT WHEN candidate>paid_date;
  base:=(base+interval '1 month')::date;
 END LOOP;
 RETURN candidate::timestamp AT TIME ZONE 'Asia/Seoul';
END $$;
REVOKE ALL ON FUNCTION public.payapp_fixed_next(date,integer,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payapp_fixed_next(date,integer,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.reserve_payapp_order_v2(p_user uuid,p_request date,p_expire date,p_policy text,p_resume uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.payapp_orders; s public.subscriptions; r jsonb; stamp timestamptz; today date;
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
  IF o.policy_version='card-fixed-kst-2026-11-16' THEN
   IF stamp<coalesce(o.requested_at,o.created_at) OR stamp>=coalesce(o.requested_at,o.created_at)+interval '24 hours' THEN RAISE EXCEPTION 'Reopen limit reached; provider status requires reconciliation'; END IF;
  ELSIF coalesce(o.request_date,(o.created_at AT TIME ZONE 'Asia/Seoul')::date)<>today THEN RAISE EXCEPTION 'Legacy request requires reconciliation'; END IF;
  RETURN jsonb_build_object('order',to_jsonb(o),'created',false);
 END IF;
 IF p_resume IS NOT NULL OR p_policy IS DISTINCT FROM 'card-fixed-kst-2026-11-16' OR p_request IS DISTINCT FROM today OR p_expire IS DISTINCT FROM (today+interval '5 years')::date THEN RAISE EXCEPTION 'Consent quote changed'; END IF;
 INSERT INTO public.payapp_orders(user_id,requested_day,request_date,rebill_expire,requested_at,consented_at,policy_version,consent_snapshot)
 VALUES(p_user,extract(day FROM today)::integer,today,p_expire,stamp,stamp,p_policy,jsonb_build_object('version',p_policy,'amount',30000,'requestDate',today,'requestedDay',extract(day FROM today)::integer,'expire',p_expire,'cardOnly',true,'firstCharge','on-card-approval','reopenHours',24,'exclusiveExpiry',true)) RETURNING * INTO o;
 RETURN jsonb_build_object('order',to_jsonb(o),'created',true);
END $$;
REVOKE ALL ON FUNCTION public.reserve_payapp_order_v2(uuid,date,date,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_payapp_order_v2(uuid,date,date,text,uuid) TO service_role;
-- Keep the existing audited, locked application function byte-for-byte except
-- for authoritative new-policy scheduling; old RPC entry points delegate here.
DO $migration$
DECLARE definition text; marker text:=' IF p_state=''4'' AND (p_paid IS NULL';
BEGIN
 definition:=pg_get_functiondef('public.apply_payapp_notice(uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,integer)'::regprocedure);
 IF position(marker in definition)=0 THEN RAISE EXCEPTION 'Payment validation anchor missing'; END IF;
 definition:=replace(definition,marker,E' IF o.policy_version=''card-fixed-kst-2026-11-16'' AND p_state=''4'' AND p_paid IS NOT NULL THEN\n  p_next:=public.payapp_fixed_next(o.request_date,o.requested_day,p_paid);\n END IF;\n'||marker);
 EXECUTE definition;
END $migration$;