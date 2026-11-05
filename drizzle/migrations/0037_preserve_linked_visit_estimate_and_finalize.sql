ALTER TABLE public.intake_requests ADD COLUMN IF NOT EXISTS estimate_completed_at timestamptz;
CREATE OR REPLACE FUNCTION public.resume_intake_estimate(p_request_id uuid, p_initial jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r public.intake_requests; d public.estimate_drafts; n integer; target text; body jsonb;
BEGIN
 SELECT * INTO r FROM public.intake_requests WHERE id=p_request_id AND company_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR r.status='cancelled' THEN RETURN jsonb_build_object('ok',false,'error','요청을 찾지 못했습니다.'); END IF;
 SELECT count(DISTINCT estimate_id) INTO n FROM public.estimate_drafts WHERE user_id=auth.uid() AND deleted_at IS NULL AND (estimate_id=r.estimate_id OR (r.source_estimate_id IS NOT NULL AND estimate_id=r.source_estimate_id) OR payload->>'intakeRequestId'=r.id::text);
 IF n>1 THEN RETURN jsonb_build_object('ok',false,'error','연결된 견적이 여러 개입니다. 견적 내역에서 확인해 주세요.'); END IF;
 SELECT * INTO d FROM public.estimate_drafts WHERE user_id=auth.uid() AND deleted_at IS NULL AND (estimate_id=r.estimate_id OR (r.source_estimate_id IS NOT NULL AND estimate_id=r.source_estimate_id) OR payload->>'intakeRequestId'=r.id::text) FOR UPDATE;
 IF FOUND THEN
  target:=d.estimate_id; body:=d.payload;
  IF body->>'id' IS DISTINCT FROM target OR (nullif(body->>'intakeRequestId','') IS NOT NULL AND body->>'intakeRequestId'<>r.id::text) THEN RETURN jsonb_build_object('ok',false,'error','견적 연결 정보가 일치하지 않습니다. 기존 내용을 보존했습니다.'); END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.estimate_drafts WHERE user_id=auth.uid() AND estimate_id=r.estimate_id) THEN RETURN jsonb_build_object('ok',false,'error','삭제된 견적은 다시 생성하지 않습니다.'); END IF;
  target:=r.estimate_id; body:=p_initial;
 END IF;
 body:=body || jsonb_build_object('id',target,'intakeRequestId',r.id,'intakeOwnerStartedAt',coalesce(body->>'intakeOwnerStartedAt',now()::text));
 INSERT INTO public.estimate_drafts(user_id,estimate_id,payload,revision) VALUES(auth.uid(),target,body,(extract(epoch from now())*1000)::bigint)
 ON CONFLICT(user_id,estimate_id) DO UPDATE SET payload=excluded.payload,revision=greatest(public.estimate_drafts.revision+1,excluded.revision);
 RETURN jsonb_build_object('ok',true,'payload',body);
END $$;
GRANT EXECUTE ON FUNCTION public.resume_intake_estimate(uuid,jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.resume_intake_estimate(uuid,jsonb) FROM anon;
CREATE OR REPLACE FUNCTION public.finalize_intake_estimate(p_estimate_id text,p_payload jsonb,p_revision bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.intake_requests; d public.estimate_drafts;
BEGIN
 IF auth.uid() IS NULL OR p_payload->>'id' IS DISTINCT FROM p_estimate_id THEN RETURN jsonb_build_object('ok',false,'error','견적 정보를 확인해 주세요.'); END IF;
 IF nullif(p_payload->>'intakeRequestId','') IS NOT NULL THEN
  SELECT * INTO r FROM public.intake_requests WHERE id=(p_payload->>'intakeRequestId')::uuid AND company_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','연결된 요청을 확인하지 못했습니다.'); END IF;
  IF p_estimate_id<>r.estimate_id AND p_estimate_id IS DISTINCT FROM r.source_estimate_id THEN
   IF NOT EXISTS(SELECT 1 FROM public.estimate_drafts WHERE user_id=auth.uid() AND estimate_id=p_estimate_id AND payload->>'intakeRequestId'=r.id::text) THEN RETURN jsonb_build_object('ok',false,'error','요청과 견적 연결이 일치하지 않습니다.'); END IF;
  END IF;
 END IF;
 SELECT * INTO d FROM public.estimate_drafts WHERE user_id=auth.uid() AND estimate_id=p_estimate_id FOR UPDATE;
 IF FOUND AND (d.deleted_at IS NOT NULL OR d.revision>=p_revision) THEN RETURN jsonb_build_object('ok',false,'error','더 최신 저장 내용이 있습니다. 다시 확인해 주세요.'); END IF;
 INSERT INTO public.estimate_drafts(user_id,estimate_id,payload,revision) VALUES(auth.uid(),p_estimate_id,p_payload||jsonb_build_object('status','완료'),p_revision) ON CONFLICT(user_id,estimate_id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision;
 IF r.id IS NOT NULL THEN UPDATE public.intake_requests SET estimate_completed_at=coalesce(estimate_completed_at,now()) WHERE id=r.id AND company_id=auth.uid(); END IF;
 RETURN jsonb_build_object('ok',true,'revision',p_revision);
END $$;
GRANT UPDATE(estimate_completed_at) ON public.intake_requests TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_intake_estimate(text,jsonb,bigint) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_intake_estimate(text,jsonb,bigint) FROM anon;