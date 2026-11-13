CREATE OR REPLACE FUNCTION public.adjust_estimate_total(p_estimate_id text, p_total integer, p_expected_total integer, p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE d public.estimate_drafts; t public.estimate_terms; payload jsonb; parts jsonb; psum integer; diff integer; idx integer; result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'error','로그인이 필요합니다.'); END IF;
 IF p_total IS NULL OR p_total <= 0 OR p_revision <= 0 THEN RETURN jsonb_build_object('ok',false,'error','견적 금액을 확인해 주세요.'); END IF;
 SELECT * INTO d FROM public.estimate_drafts WHERE user_id=auth.uid() AND estimate_id=p_estimate_id FOR UPDATE;
 IF NOT FOUND OR d.deleted_at IS NOT NULL OR d.archived_at IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'error','저장된 견적서를 찾지 못했습니다.'); END IF;
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=auth.uid() AND estimate_id=p_estimate_id AND deleted_at IS NULL AND cancelled_at IS NULL ORDER BY sheet_version DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','고객 견적서를 찾지 못했습니다.'); END IF;
 -- Repeat call with the already-saved amount: nothing to change.
 IF t.total = p_total AND (d.payload->>'total')::integer = p_total AND (d.payload->'sheetSnapshot'->>'total')::integer = p_total THEN
  RETURN jsonb_build_object('ok',true,'changed',false,'revision',d.revision,'payload',d.payload);
 END IF;
 IF t.total IS DISTINCT FROM p_expected_total THEN RETURN jsonb_build_object('ok',false,'stale',true,'error','견적 금액이 다른 곳에서 바뀌었습니다. 다시 열어 확인해 주세요.'); END IF;
 IF d.revision >= p_revision THEN RETURN jsonb_build_object('ok',false,'stale',true,'error','견적이 변경되었습니다. 다시 열어 주세요.'); END IF;
 payload := d.payload;
 IF payload->'sheetSnapshot' IS NULL OR jsonb_typeof(payload->'sheetSnapshot') <> 'object' THEN
  payload := payload || jsonb_build_object('sheetSnapshot', coalesce((t.sheet_snapshot::jsonb) - 'draft', '{}'::jsonb));
 END IF;
 parts := coalesce(payload->'sheetSnapshot'->'parts','[]'::jsonb);
 IF jsonb_typeof(parts) <> 'array' THEN parts := '[]'::jsonb; END IF;
 SELECT coalesce(sum((p->>'amount')::integer),0) INTO psum FROM jsonb_array_elements(parts) p;
 diff := p_total - psum;
 IF diff <> 0 THEN
  SELECT (o - 1)::integer INTO idx FROM jsonb_array_elements(parts) WITH ORDINALITY AS x(p,o) WHERE p->>'label' = '할인·조정' LIMIT 1;
  IF idx IS NULL THEN parts := parts || jsonb_build_array(jsonb_build_object('label','할인·조정','amount',diff));
  ELSE parts := jsonb_set(parts, ARRAY[idx::text,'amount'], to_jsonb((parts->idx->>'amount')::integer + diff)); END IF;
 END IF;
 payload := payload || jsonb_build_object('total',p_total,'totalOverride',p_total,'sheetSavedRevision',p_revision);
 payload := jsonb_set(jsonb_set(payload,'{sheetSnapshot,parts}',parts),'{sheetSnapshot,total}',to_jsonb(p_total));
 result := public.save_edited_estimate_sheet(p_estimate_id, payload, p_revision);
 RETURN jsonb_build_object('ok',true,'changed',true,'revision',p_revision,'payload',payload);
END $$;
REVOKE ALL ON FUNCTION public.adjust_estimate_total(text,integer,integer,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_estimate_total(text,integer,integer,bigint) TO authenticated;