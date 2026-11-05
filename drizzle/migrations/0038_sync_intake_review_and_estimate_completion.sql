CREATE OR REPLACE FUNCTION public.sync_intake_notification_read() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF (NEW.owner_seen_at IS NOT NULL AND NEW.owner_seen_at IS DISTINCT FROM OLD.owner_seen_at) OR (NEW.estimate_completed_at IS NOT NULL AND NEW.estimate_completed_at IS DISTINCT FROM OLD.estimate_completed_at) OR (NEW.deleted_at IS NOT NULL AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) THEN
  UPDATE public.owner_notifications SET read_at=coalesce(read_at,now()) WHERE company_id=NEW.company_id AND kind='intake' AND ref_id=NEW.id::text AND read_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_intake_notification_read() FROM PUBLIC;
CREATE TRIGGER intake_notification_read_sync AFTER UPDATE OF owner_seen_at,estimate_completed_at,deleted_at ON public.intake_requests FOR EACH ROW EXECUTE FUNCTION public.sync_intake_notification_read();
CREATE OR REPLACE FUNCTION public.finalize_intake_estimate(p_estimate_id text,p_payload jsonb,p_revision bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.intake_requests; d public.estimate_drafts; n integer;
BEGIN
 IF auth.uid() IS NULL OR p_payload->>'id' IS DISTINCT FROM p_estimate_id THEN RETURN jsonb_build_object('ok',false,'error','견적 정보를 확인해 주세요.'); END IF;
 IF nullif(p_payload->>'intakeRequestId','') IS NOT NULL THEN
  SELECT * INTO r FROM public.intake_requests WHERE id=(p_payload->>'intakeRequestId')::uuid AND company_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','연결된 요청을 확인하지 못했습니다.'); END IF;
  IF p_estimate_id<>r.estimate_id AND p_estimate_id IS DISTINCT FROM r.source_estimate_id THEN
   IF NOT EXISTS(SELECT 1 FROM public.estimate_drafts WHERE user_id=auth.uid() AND estimate_id=p_estimate_id AND payload->>'intakeRequestId'=r.id::text) THEN RETURN jsonb_build_object('ok',false,'error','요청과 견적 연결이 일치하지 않습니다.'); END IF;
  END IF;
 ELSE
  SELECT count(*) INTO n FROM public.intake_requests WHERE company_id=auth.uid() AND (estimate_id=p_estimate_id OR source_estimate_id=p_estimate_id);
  IF n>1 THEN RETURN jsonb_build_object('ok',false,'error','연결된 요청이 여러 개입니다. 요청에서 견적을 다시 열어 주세요.'); END IF;
  SELECT * INTO r FROM public.intake_requests WHERE company_id=auth.uid() AND (estimate_id=p_estimate_id OR source_estimate_id=p_estimate_id) FOR UPDATE;
 END IF;
 SELECT * INTO d FROM public.estimate_drafts WHERE user_id=auth.uid() AND estimate_id=p_estimate_id FOR UPDATE;
 IF FOUND AND (d.deleted_at IS NOT NULL OR d.revision>=p_revision) THEN RETURN jsonb_build_object('ok',false,'error','더 최신 저장 내용이 있습니다. 다시 확인해 주세요.'); END IF;
 INSERT INTO public.estimate_drafts(user_id,estimate_id,payload,revision) VALUES(auth.uid(),p_estimate_id,p_payload||jsonb_build_object('status','완료')||CASE WHEN r.id IS NOT NULL THEN jsonb_build_object('intakeRequestId',r.id) ELSE '{}'::jsonb END,p_revision) ON CONFLICT(user_id,estimate_id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision;
 IF r.id IS NOT NULL THEN UPDATE public.intake_requests SET estimate_completed_at=coalesce(estimate_completed_at,now()),owner_seen_at=coalesce(owner_seen_at,now()) WHERE id=r.id AND company_id=auth.uid(); END IF;
 RETURN jsonb_build_object('ok',true,'revision',p_revision);
END $$;
GRANT EXECUTE ON FUNCTION public.finalize_intake_estimate(text,jsonb,bigint) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_intake_estimate(text,jsonb,bigint) FROM anon;
CREATE OR REPLACE FUNCTION public.complete_intake_on_estimate_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE company uuid;
BEGIN
 IF NEW.delivery_method IS DISTINCT FROM 'link' OR NEW.status NOT IN ('sent','delivered') OR NEW.test_mode OR NEW.estimate_id IS NULL THEN RETURN NEW; END IF;
 company:=coalesce(NEW.company_id,NEW.user_id);
 IF company IS NULL THEN RETURN NEW; END IF;
 UPDATE public.intake_requests SET estimate_completed_at=coalesce(estimate_completed_at,now()),owner_seen_at=coalesce(owner_seen_at,now()) WHERE company_id=company AND (estimate_id=NEW.estimate_id OR source_estimate_id=NEW.estimate_id OR id::text IN (SELECT payload->>'intakeRequestId' FROM public.estimate_drafts WHERE user_id=company AND estimate_id=NEW.estimate_id AND deleted_at IS NULL));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.complete_intake_on_estimate_delivery() FROM PUBLIC;
CREATE TRIGGER intake_estimate_delivery_complete AFTER INSERT OR UPDATE OF status ON public.estimate_deliveries FOR EACH ROW EXECUTE FUNCTION public.complete_intake_on_estimate_delivery();