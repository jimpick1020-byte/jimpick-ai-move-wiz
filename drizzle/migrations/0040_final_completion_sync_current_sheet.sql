CREATE OR REPLACE FUNCTION public.finalize_intake_estimate(p_estimate_id text,p_payload jsonb,p_revision bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.intake_requests; n integer; saved jsonb; result jsonb;
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
 saved:=p_payload||jsonb_build_object('status','완료','sheetSavedRevision',p_revision)||CASE WHEN r.id IS NOT NULL THEN jsonb_build_object('intakeRequestId',r.id) ELSE '{}'::jsonb END;
 -- Older deployed clients do not send a refreshed snapshot. Keep their total valid until publish.
 IF saved->'sheetSnapshot' IS NULL OR saved->'sheetSnapshot'='null'::jsonb THEN
  saved:=saved||jsonb_build_object('sheetSnapshot',jsonb_build_object('total',saved->'total','rooms','[]'::jsonb,'parts','[]'::jsonb));
 ELSE
  saved:=jsonb_set(saved,'{sheetSnapshot,total}',saved->'total');
 END IF;
 result:=public.save_edited_estimate_sheet(p_estimate_id,saved,p_revision);
 IF NOT coalesce((result->>'ok')::boolean,false) THEN RETURN result; END IF;
 IF r.id IS NOT NULL THEN UPDATE public.intake_requests SET estimate_completed_at=coalesce(estimate_completed_at,now()),owner_seen_at=coalesce(owner_seen_at,now()) WHERE id=r.id AND company_id=auth.uid(); END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.finalize_intake_estimate(text,jsonb,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finalize_intake_estimate(text,jsonb,bigint) TO authenticated;