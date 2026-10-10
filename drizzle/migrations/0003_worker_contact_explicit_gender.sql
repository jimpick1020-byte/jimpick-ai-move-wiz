CREATE OR REPLACE FUNCTION public.save_worker_contact(_contact jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE contacts jsonb; item jsonb; idx integer; old_item jsonb; digits text; formatted text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 IF _contact ? 'gender' AND (_contact->>'gender' IS NULL OR _contact->>'gender' NOT IN ('male','female','unspecified')) THEN RAISE EXCEPTION 'Invalid gender'; END IF;
 digits := regexp_replace(coalesce(_contact->>'phone',''), '[^0-9]', '', 'g');
 IF coalesce(_contact->>'id','') = '' OR coalesce(trim(_contact->>'name'),'') = '' OR digits !~ '^01[016789][0-9]{7,8}$' THEN RAISE EXCEPTION 'Invalid contact'; END IF;
 formatted := left(digits,3) || '-' || substring(digits from 4 for length(digits)-7) || '-' || right(digits,4);
 INSERT INTO public.profiles(id) VALUES(auth.uid()) ON CONFLICT(id) DO NOTHING;
 SELECT worker_contacts INTO contacts FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 SELECT (ordinality-1)::integer, value INTO idx, old_item FROM jsonb_array_elements(contacts) WITH ORDINALITY WHERE value->>'id' = _contact->>'id';
 item := coalesce(old_item,'{}'::jsonb) || _contact || jsonb_build_object('phone',formatted);
 IF idx IS NULL THEN contacts := contacts || jsonb_build_array(item); ELSE contacts := jsonb_set(contacts, ARRAY[idx::text], item); END IF;
 UPDATE public.profiles SET worker_contacts=contacts, staff_phone=CASE WHEN coalesce((old_item->>'legacy')::boolean,false) THEN formatted ELSE staff_phone END, updated_at=now() WHERE id=auth.uid();
 RETURN item;
END $function$;