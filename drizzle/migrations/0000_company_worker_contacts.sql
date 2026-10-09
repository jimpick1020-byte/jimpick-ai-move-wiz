ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS worker_contacts jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.profiles SET worker_contacts = jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'name', staff_name, 'phone', coalesce(staff_phone,''), 'role', '담당 작업자', 'photo', '', 'legacy', true)) WHERE worker_contacts = '[]'::jsonb AND coalesce(trim(staff_name),'') <> '';
CREATE OR REPLACE FUNCTION public.list_worker_contacts() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT coalesce((SELECT worker_contacts FROM public.profiles WHERE id = auth.uid()), '[]'::jsonb) $$;
CREATE OR REPLACE FUNCTION public.save_worker_contact(_contact jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE contacts jsonb; item jsonb; idx integer; old_item jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 IF coalesce(_contact->>'id','') = '' OR coalesce(trim(_contact->>'name'),'') = '' OR coalesce(_contact->>'phone','') !~ '^01[016789][0-9]{7,8}$' THEN RAISE EXCEPTION 'Invalid contact'; END IF;
 INSERT INTO public.profiles(id) VALUES(auth.uid()) ON CONFLICT(id) DO NOTHING;
 SELECT worker_contacts INTO contacts FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 SELECT (ordinality-1)::integer, value INTO idx, old_item FROM jsonb_array_elements(contacts) WITH ORDINALITY WHERE value->>'id' = _contact->>'id';
 item := coalesce(old_item,'{}'::jsonb) || _contact;
 IF idx IS NULL THEN contacts := contacts || jsonb_build_array(item); ELSE contacts := jsonb_set(contacts, ARRAY[idx::text], item); END IF;
 UPDATE public.profiles SET worker_contacts=contacts, staff_phone=CASE WHEN coalesce((old_item->>'legacy')::boolean,false) THEN item->>'phone' ELSE staff_phone END, updated_at=now() WHERE id=auth.uid();
 RETURN item;
END $$;
REVOKE ALL ON FUNCTION public.list_worker_contacts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_worker_contact(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_worker_contacts(), public.save_worker_contact(jsonb) TO authenticated;
