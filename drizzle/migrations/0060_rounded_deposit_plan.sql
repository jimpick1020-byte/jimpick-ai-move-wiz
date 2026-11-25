CREATE OR REPLACE FUNCTION public.sync_storage_payment_plan() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE d jsonb; q integer; snap jsonb;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT max(storage_origin_completed_at) INTO NEW.storage_origin_completed_at FROM public.estimate_terms WHERE user_id=NEW.user_id AND estimate_id=NEW.estimate_id AND deleted_at IS NULL;
 END IF;
 IF TG_OP='INSERT' OR NEW.sheet_snapshot IS DISTINCT FROM OLD.sheet_snapshot OR NEW.total IS DISTINCT FROM OLD.total THEN
  BEGIN snap:=NEW.sheet_snapshot::jsonb; d:=coalesce(snap->'draft','{}'::jsonb); EXCEPTION WHEN invalid_text_representation THEN snap:=NULL; d:='{}'::jsonb; END;
  NEW.storage_payment_enabled:=coalesce(d->>'moveType','')='보관이사' OR coalesce((d->>'storageEnabled')::boolean,false);
  NEW.planned_interim:=CASE WHEN NEW.storage_payment_enabled THEN coalesce((d->>'plannedInterim')::integer,0) ELSE 0 END;
  q:=round(greatest(NEW.total,0)::numeric/100000)*10000;
  IF NEW.planned_interim<0 OR (NEW.planned_interim>0 AND q+NEW.planned_interim>NEW.total) THEN RAISE EXCEPTION '예정 예약금과 중도금의 합계는 총 견적금액을 초과할 수 없습니다.'; END IF;
  IF jsonb_typeof(snap->'draft')='object' THEN NEW.sheet_snapshot:=jsonb_set(snap,'{draft,deposit}',to_jsonb(q))::text; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.sync_rounded_draft_deposit() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE amount numeric;
BEGIN
 IF jsonb_typeof(NEW.payload)='object' AND (NEW.payload->>'total') ~ '^[0-9]+$' THEN
  amount:=(NEW.payload->>'total')::numeric;
  NEW.payload:=jsonb_set(NEW.payload,'{deposit}',to_jsonb(round(amount/100000)*10000));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_rounded_draft_deposit BEFORE INSERT OR UPDATE OF payload ON public.estimate_drafts FOR EACH ROW EXECUTE FUNCTION public.sync_rounded_draft_deposit();
REVOKE ALL ON FUNCTION public.sync_rounded_draft_deposit() FROM PUBLIC, anon;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.adjust_estimate_total(text,integer,integer,bigint)'::regprocedure) INTO definition;
 definition:=replace(definition,'''totalOverride'',p_total,''sheetSavedRevision'',p_revision)', '''totalOverride'',p_total,''sheetSavedRevision'',p_revision,''deposit'',round(p_total::numeric/100000)*10000)');
 EXECUTE definition;
END $migration$;