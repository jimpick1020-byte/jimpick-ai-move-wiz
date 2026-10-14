GRANT UPDATE (submission, draft, last_submitted_at) ON public.intake_requests TO authenticated;
CREATE OR REPLACE FUNCTION public.remove_customer_selected_item(p_request_id uuid, p_room text, p_item_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r public.intake_requests%ROWTYPE; d public.estimate_drafts%ROWTYPE; next_rooms jsonb; stamp timestamptz := clock_timestamp();
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
 SELECT * INTO r FROM public.intake_requests WHERE id = p_request_id AND company_id = auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '고객 요청을 찾을 수 없습니다.'; END IF;
 IF NOT (coalesce(r.submission->'rooms'->p_room, '{}'::jsonb) ? p_item_id) THEN RAISE EXCEPTION '선택한 품목을 찾을 수 없습니다.'; END IF;
 SELECT * INTO d FROM public.estimate_drafts WHERE user_id = auth.uid() AND estimate_id = r.estimate_id AND deleted_at IS NULL FOR UPDATE;
 UPDATE public.intake_requests SET submission = submission #- ARRAY['rooms',p_room,p_item_id], draft = draft #- ARRAY['rooms',p_room,p_item_id], last_submitted_at = stamp WHERE id = r.id AND company_id = auth.uid();
 IF d.id IS NOT NULL THEN
 SELECT coalesce(jsonb_agg(CASE WHEN room->>'name' = p_room THEN jsonb_set(jsonb_set(room, '{items}', coalesce(room->'items','{}'::jsonb) - p_item_id), '{disposal}', coalesce(room->'disposal','{}'::jsonb) - p_item_id) ELSE room END ORDER BY ordinal), '[]'::jsonb) INTO next_rooms FROM jsonb_array_elements(coalesce(d.payload->'rooms','[]'::jsonb)) WITH ORDINALITY AS x(room, ordinal);
 UPDATE public.estimate_drafts SET payload = jsonb_set(jsonb_set(payload, '{rooms}', next_rooms), '{intakeSubmittedAt}', to_jsonb(stamp)), revision = greatest(revision + 1, floor(extract(epoch FROM stamp))::bigint) WHERE id = d.id AND user_id = auth.uid();
 END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.remove_customer_selected_item(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_customer_selected_item(uuid,text,text) TO authenticated;