CREATE OR REPLACE FUNCTION public.sync_storage_payment_plan() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE d jsonb; q integer;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT max(storage_origin_completed_at) INTO NEW.storage_origin_completed_at FROM public.estimate_terms WHERE user_id=NEW.user_id AND estimate_id=NEW.estimate_id AND deleted_at IS NULL;
 END IF;
 IF TG_OP='INSERT' OR NEW.sheet_snapshot IS DISTINCT FROM OLD.sheet_snapshot OR NEW.total IS DISTINCT FROM OLD.total THEN
  BEGIN d:=coalesce(NEW.sheet_snapshot::jsonb->'draft','{}'::jsonb); EXCEPTION WHEN invalid_text_representation THEN d:='{}'::jsonb; END;
  NEW.storage_payment_enabled:=coalesce(d->>'moveType','')='보관이사' OR coalesce((d->>'storageEnabled')::boolean,false);
  NEW.planned_interim:=CASE WHEN NEW.storage_payment_enabled THEN coalesce((d->>'plannedInterim')::integer,0) ELSE 0 END;
  q:=coalesce((d->>'depositOverride')::integer,(d->>'deposit')::integer,round(NEW.total::numeric/100000)*10000);
  IF NEW.planned_interim<0 OR (NEW.planned_interim>0 AND q+NEW.planned_interim>NEW.total) THEN RAISE EXCEPTION '예정 예약금과 중도금의 합계는 총 견적금액을 초과할 수 없습니다.'; END IF;
 END IF;
 RETURN NEW;
END $$;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.complete_estimate_payment(text,text,uuid,text,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'IF due=0 THEN RETURN jsonb_build_object(''ok'',true,''already'',true,''completed'',true,''balancePaid'',m.balance_paid); END IF;', 'IF due=0 THEN IF t.interim_paid>0 AND t.payment_status<>''completed'' THEN UPDATE public.estimate_terms SET payment_status=''completed'',paid_at=coalesce(paid_at,n),payment_confirmed_at=n,payment_confirmed_by=auth.uid(),calendar_archived=true,calendar_archived_at=coalesce(calendar_archived_at,n),calendar_archived_by=auth.uid(),calendar_selected=false WHERE id=t.id AND user_id=auth.uid(); END IF; RETURN jsonb_build_object(''ok'',true,''already'',true,''completed'',true,''balancePaid'',m.balance_paid); END IF;');
 EXECUTE definition;
END $migration$;