CREATE OR REPLACE FUNCTION public.save_edited_estimate_sheet(p_estimate_id text, p_payload jsonb, p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE d public.estimate_drafts; t public.estimate_terms; amount integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
 IF p_payload->>'id' IS DISTINCT FROM p_estimate_id OR p_revision <= 0 THEN RAISE EXCEPTION '견적 저장 정보를 확인해 주세요.'; END IF;
 amount := (p_payload->>'total')::integer;
 IF amount IS NULL OR amount < 0 OR p_payload->'sheetSnapshot'->>'total' IS DISTINCT FROM amount::text THEN RAISE EXCEPTION '견적 금액을 확인해 주세요.'; END IF;
 SELECT * INTO d FROM public.estimate_drafts WHERE user_id=auth.uid() AND estimate_id=p_estimate_id FOR UPDATE;
 IF FOUND AND (d.deleted_at IS NOT NULL OR d.archived_at IS NOT NULL OR d.revision >= p_revision) THEN RAISE EXCEPTION '견적이 변경되었습니다. 다시 열어 저장해 주세요.'; END IF;
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=auth.uid() AND estimate_id=p_estimate_id AND deleted_at IS NULL AND cancelled_at IS NULL ORDER BY sheet_version DESC LIMIT 1 FOR UPDATE;
 INSERT INTO public.estimate_drafts(user_id,estimate_id,payload,revision) VALUES(auth.uid(),p_estimate_id,p_payload,p_revision)
 ON CONFLICT(user_id,estimate_id) DO UPDATE SET payload=EXCLUDED.payload,revision=EXCLUDED.revision;
 IF t.id IS NOT NULL THEN
 UPDATE public.estimate_terms SET total=amount,customer_name=p_payload->>'customerName',contact_phone=p_payload->>'phone',move_date=NULLIF(p_payload->>'moveDate',''),company_phone=NULLIF(p_payload->>'staffPhone',''),sheet_snapshot=jsonb_build_object('draft',p_payload,'rooms',p_payload->'sheetSnapshot'->'rooms','parts',p_payload->'sheetSnapshot'->'parts','total',amount)::text WHERE id=t.id AND user_id=auth.uid();
 END IF;
 RETURN jsonb_build_object('ok',true,'revision',p_revision);
END $$;
REVOKE ALL ON FUNCTION public.save_edited_estimate_sheet(text,jsonb,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_edited_estimate_sheet(text,jsonb,bigint) TO authenticated;