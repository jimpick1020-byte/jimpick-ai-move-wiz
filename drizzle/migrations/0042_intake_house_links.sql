ALTER TABLE public.intake_requests ADD COLUMN second_token_hash text, ADD COLUMN second_token_enc text, ADD COLUMN second_draft jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN second_submission jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN shared_destination jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN link_revision bigint NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX intake_second_token_unique ON public.intake_requests(second_token_hash) WHERE second_token_hash IS NOT NULL;
CREATE OR REPLACE FUNCTION public.ensure_intake_house_link(p_request uuid,p_company uuid,p_hash text,p_enc text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.intake_requests;
BEGIN
 SELECT * INTO r FROM public.intake_requests WHERE id=p_request AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR r.deleted_at IS NOT NULL OR r.estimate_completed_at IS NOT NULL OR r.status IN ('cancelled','confirmed') OR r.expires_at<=now() THEN RETURN jsonb_build_object('ok',false,'error','입력 가능한 요청을 찾지 못했습니다.'); END IF;
 IF r.second_token_hash IS NULL THEN UPDATE public.intake_requests SET second_token_hash=p_hash,second_token_enc=p_enc,link_revision=link_revision+1 WHERE id=r.id RETURNING * INTO r; END IF;
 RETURN jsonb_build_object('ok',true,'token_enc',r.second_token_enc);
END $$;
REVOKE ALL ON FUNCTION public.ensure_intake_house_link(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_intake_house_link(uuid,uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.save_intake_house_link(p_request uuid,p_company uuid,p_origin integer,p_expected bigint,p_form jsonb,p_destination jsonb,p_submit boolean,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.intake_requests; d public.estimate_drafts;
BEGIN
 SELECT * INTO r FROM public.intake_requests WHERE id=p_request AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR r.deleted_at IS NOT NULL OR r.estimate_completed_at IS NOT NULL OR r.status IN ('cancelled','confirmed') OR r.expires_at<=now() THEN RETURN jsonb_build_object('ok',false,'closed',true); END IF;
 IF r.link_revision<>p_expected THEN RETURN jsonb_build_object('ok',false,'stale',true); END IF;
 IF p_origin NOT IN (1,2) OR (p_origin=2 AND r.second_token_hash IS NULL) THEN RETURN jsonb_build_object('ok',false); END IF;
 IF p_submit THEN
  SELECT * INTO d FROM public.estimate_drafts WHERE user_id=r.company_id AND estimate_id=r.estimate_id FOR UPDATE;
  IF FOUND AND d.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'error','삭제된 견적은 다시 만들 수 없습니다.'); END IF;
  IF d.id IS NULL THEN
   INSERT INTO public.estimate_drafts(user_id,estimate_id,payload,revision) VALUES(r.company_id,r.estimate_id,p_payload,greatest(1,extract(epoch FROM clock_timestamp())::bigint));
  ELSIF NOT (d.payload ? 'intakeOwnerStartedAt') THEN
   UPDATE public.estimate_drafts SET payload=p_payload,revision=greatest(d.revision+1,extract(epoch FROM clock_timestamp())::bigint) WHERE id=d.id;
  END IF;
 END IF;
 UPDATE public.intake_requests SET
 draft=CASE WHEN p_origin=1 THEN p_form ELSE draft END,
 second_draft=CASE WHEN p_origin=2 THEN p_form ELSE second_draft END,
 submission=CASE WHEN p_submit AND p_origin=1 THEN p_form ELSE submission END,
 second_submission=CASE WHEN p_submit AND p_origin=2 THEN p_form ELSE second_submission END,
 shared_destination=p_destination,link_revision=link_revision+1,
 editing_started_at=coalesce(editing_started_at,now()),
 status=CASE WHEN p_submit THEN 'submitted' WHEN status='submitted' THEN status ELSE 'editing' END,
 customer_name=CASE WHEN p_submit AND (p_origin=1 OR customer_name='') THEN coalesce(p_form->>'customerName','') ELSE customer_name END,
 consent_at=CASE WHEN p_submit THEN now() ELSE consent_at END,
 first_submitted_at=CASE WHEN p_submit THEN coalesce(first_submitted_at,now()) ELSE first_submitted_at END,
 last_submitted_at=CASE WHEN p_submit THEN now() ELSE last_submitted_at END,
 submit_count=submit_count+CASE WHEN p_submit THEN 1 ELSE 0 END,
 owner_seen_at=CASE WHEN p_submit THEN NULL ELSE owner_seen_at END
 WHERE id=r.id;
 RETURN jsonb_build_object('ok',true,'destination',p_destination);
END $$;
REVOKE ALL ON FUNCTION public.save_intake_house_link(uuid,uuid,integer,bigint,jsonb,jsonb,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_intake_house_link(uuid,uuid,integer,bigint,jsonb,jsonb,boolean,jsonb) TO service_role;