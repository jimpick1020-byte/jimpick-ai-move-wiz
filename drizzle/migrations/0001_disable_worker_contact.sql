CREATE OR REPLACE FUNCTION public.disable_worker_contact(_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE contacts jsonb; idx integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 SELECT worker_contacts INTO contacts FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 IF contacts IS NULL THEN RETURN false; END IF;
 SELECT (ordinality-1)::integer INTO idx FROM jsonb_array_elements(contacts) WITH ORDINALITY WHERE value->>'id' = _id;
 IF idx IS NULL THEN RETURN false; END IF;
 -- 과거 계약·작업지시서 기록 보존을 위해 실제로 지우지 않고 사용 중지만 표시합니다
 contacts := jsonb_set(contacts, ARRAY[idx::text], (contacts->idx) || jsonb_build_object('disabled', true, 'disabled_at', now()));
 UPDATE public.profiles SET worker_contacts=contacts, updated_at=now() WHERE id=auth.uid();
 RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.disable_worker_contact(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.disable_worker_contact(text) TO authenticated;