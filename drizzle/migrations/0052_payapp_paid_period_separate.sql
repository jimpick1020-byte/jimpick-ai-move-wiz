DO $migration$
DECLARE definition text; marker text:='current_period_end=p_next';
BEGIN
 definition:=pg_get_functiondef('public.apply_payapp_notice(uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,integer)'::regprocedure);
 IF position(marker in definition)=0 THEN RAISE EXCEPTION 'Paid period anchor missing'; END IF;
 definition:=replace(definition,marker,'current_period_end=CASE WHEN o.policy_version=''card-fixed-kst-2026-11-16'' THEN ((p_paid AT TIME ZONE ''Asia/Seoul'')+interval ''1 month'') AT TIME ZONE ''Asia/Seoul'' ELSE p_next END');
 EXECUTE definition;
END $migration$;